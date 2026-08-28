require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");
const db = require("./db");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

const JWT_SECRET =
  process.env.JWT_SECRET || "carethread_hackathon_secret_key_change_in_prod";

const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ============================================================
// AUTH MIDDLEWARE
// ============================================================

function auth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({
        error: "No token provided",
      });
    }

    const token = header.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error: "Invalid authorization header",
      });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);

      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({
          error: `Requires ${requiredRole} role`,
        });
      }

      req.user = decoded;
      next();
    } catch (e) {
      return res.status(401).json({
        error: "Invalid or expired token",
      });
    }
  };
}

// ============================================================
// HELPERS
// ============================================================

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    {
      expiresIn: "7d",
    },
  );
}

function publicUser(user) {
  if (!user) return null;

  const { password_hash, ...rest } = user;

  return rest;
}

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() AS now");

    res.json({
      ok: true,
      database: "connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Health check database error:", error);

    res.status(500).json({
      ok: false,
      database: "disconnected",
    });
  }
});

// ============================================================
// AUTH ROUTES
// ============================================================

app.post("/api/auth/signup", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      gender,
      phone,
      medical_conditions,
      specialization,
    } = req.body;

    const age =
      req.body.age === "" || req.body.age === undefined || req.body.age === null
        ? null
        : Number(req.body.age);

    if (age !== null && (!Number.isInteger(age) || age < 0 || age > 150)) {
      return res.status(400).json({
        error: "Age must be a valid number",
      });
    }

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    if (!["doctor", "patient"].includes(role)) {
      return res.status(400).json({
        error: "Invalid role",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingResult = await db.query(
      "SELECT id FROM users WHERE email = $1",
      [normalizedEmail],
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({
        error: "Email already registered",
      });
    }

    const id = uuidv4();

    const password_hash = await bcrypt.hash(password, 10);

    await db.query(
      `
      INSERT INTO users (
        id,
        name,
        email,
        password_hash,
        role,
        age,
        gender,
        phone,
        medical_conditions,
        specialization
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      `,
      [
        id,
        name,
        normalizedEmail,
        password_hash,
        role,
        age ?? null,
        gender ?? null,
        phone ?? null,
        medical_conditions ?? null,
        specialization ?? null,
      ],
    );

    const userResult = await db.query("SELECT * FROM users WHERE id = $1", [
      id,
    ]);

    const user = userResult.rows[0];

    const token = signToken(user);

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Signup error:", error);

    // PostgreSQL unique constraint
    if (error.code === "23505") {
      return res.status(409).json({
        error: "Email already registered",
      });
    }

    res.status(500).json({
      error: "Failed to create account",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await db.query("SELECT * FROM users WHERE email = $1", [
      normalizedEmail,
    ]);

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    if (role && user.role !== role) {
      return res.status(401).json({
        error: `No ${role} account found for this email`,
      });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({
        error: "Invalid credentials",
      });
    }

    const token = signToken(user);

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(500).json({
      error: "Login failed",
    });
  }
});

app.get("/api/auth/me", auth(), async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM users WHERE id = $1", [
      req.user.id,
    ]);

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Auth me error:", error);

    res.status(500).json({
      error: "Failed to fetch user",
    });
  }
});

// ============================================================
// ROOM ROUTES
// ============================================================

app.post("/api/rooms", auth("doctor"), async (req, res) => {
  try {
    const { title } = req.body;

    const id = uuidv4();

    // Generate a unique room code
    let code;

    while (true) {
      const candidate = genRoomCode();

      const existing = await db.query("SELECT id FROM rooms WHERE code = $1", [
        candidate,
      ]);

      if (existing.rows.length === 0) {
        code = candidate;
        break;
      }
    }

    await db.query(
      `
      INSERT INTO rooms (
        id,
        code,
        title,
        doctor_id,
        status
      )
      VALUES ($1,$2,$3,$4,'open')
      `,
      [id, code, title || "Trial Visit", req.user.id],
    );

    const result = await db.query("SELECT * FROM rooms WHERE id = $1", [id]);

    res.json({
      room: result.rows[0],
    });
  } catch (error) {
    console.error("Create room error:", error);

    res.status(500).json({
      error: "Failed to create room",
    });
  }
});

app.get("/api/rooms/mine", auth("doctor"), async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        r.*,
        u.name AS patient_name,
        u.email AS patient_email
      FROM rooms r
      LEFT JOIN users u
        ON r.patient_id = u.id
      WHERE r.doctor_id = $1
      ORDER BY r.created_at DESC
      `,
      [req.user.id],
    );

    res.json({
      rooms: result.rows,
    });
  } catch (error) {
    console.error("Doctor rooms error:", error);

    res.status(500).json({
      error: "Failed to fetch rooms",
    });
  }
});

app.get("/api/rooms/patient/mine", auth("patient"), async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT
          r.*,
          u.name AS doctor_name
        FROM rooms r
        LEFT JOIN users u
          ON r.doctor_id = u.id
        WHERE r.patient_id = $1
        ORDER BY r.created_at DESC
        `,
      [req.user.id],
    );

    res.json({
      rooms: result.rows,
    });
  } catch (error) {
    console.error("Patient rooms error:", error);

    res.status(500).json({
      error: "Failed to fetch rooms",
    });
  }
});

app.post("/api/rooms/join", auth("patient"), async (req, res) => {
  try {
    const code = (req.body.code || "").toUpperCase().trim();

    if (!code) {
      return res.status(400).json({
        error: "Room code is required",
      });
    }

    const result = await db.query("SELECT * FROM rooms WHERE code = $1", [
      code,
    ]);

    const room = result.rows[0];

    if (!room) {
      return res.status(404).json({
        error: "Invalid room code",
      });
    }

    if (room.patient_id && room.patient_id !== req.user.id) {
      return res.status(409).json({
        error: "This room already has a patient",
      });
    }

    await db.query(
      `
        UPDATE rooms
        SET
          patient_id = $1,
          status = 'active'
        WHERE id = $2
        `,
      [req.user.id, room.id],
    );

    const updatedResult = await db.query("SELECT * FROM rooms WHERE id = $1", [
      room.id,
    ]);

    res.json({
      room: updatedResult.rows[0],
    });
  } catch (error) {
    console.error("Join room error:", error);

    res.status(500).json({
      error: "Failed to join room",
    });
  }
});

app.get("/api/rooms/:code", auth(), async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const result = await db.query(
      `
      SELECT
        r.*,
        d.name AS doctor_name,
        p.name AS patient_name
      FROM rooms r
      LEFT JOIN users d
        ON r.doctor_id = d.id
      LEFT JOIN users p
        ON r.patient_id = p.id
      WHERE r.code = $1
      `,
      [code],
    );

    const room = result.rows[0];

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (req.user.role === "doctor" && room.doctor_id !== req.user.id) {
      return res.status(403).json({
        error: "Not your room",
      });
    }

    if (
      req.user.role === "patient" &&
      room.patient_id &&
      room.patient_id !== req.user.id
    ) {
      return res.status(403).json({
        error: "Not your room",
      });
    }

    res.json({
      room,
    });
  } catch (error) {
    console.error("Get room error:", error);

    res.status(500).json({
      error: "Failed to fetch room",
    });
  }
});

app.post("/api/rooms/:code/complete", auth("doctor"), async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();

    const result = await db.query("SELECT * FROM rooms WHERE code = $1", [
      code,
    ]);

    const room = result.rows[0];

    if (!room || room.doctor_id !== req.user.id) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    await db.query(
      `
        UPDATE rooms
        SET
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
      [room.id],
    );

    // Tell everyone still in the call that the visit is over.
    io.to(`room:${room.code}`).emit("room:completed");

    res.json({
      ok: true,
    });
  } catch (error) {
    console.error("Complete room error:", error);

    res.status(500).json({
      error: "Failed to complete room",
    });
  }
});

// ============================================================
// VITALS ROUTES
// ============================================================

app.post("/api/vitals", auth("doctor"), async (req, res) => {
  try {
    const {
      room_id,
      patient_id,
      stage,
      temperature,
      bp_systolic,
      bp_diastolic,
      sugar,
      spo2,
      heart_rate,
      dosage_given,
      notes,
    } = req.body;

    if (!room_id || !patient_id || !stage) {
      return res.status(400).json({
        error: "Missing required fields",
      });
    }

    const validStages = ["pre_dosage", "post_dosage", "general"];

    if (!validStages.includes(stage)) {
      return res.status(400).json({
        error: "Invalid stage",
      });
    }

    // Verify room belongs to doctor and patient
    const roomResult = await db.query(
      `
      SELECT *
      FROM rooms
      WHERE id = $1
      `,
      [room_id],
    );

    const room = roomResult.rows[0];

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
      });
    }

    if (room.doctor_id !== req.user.id) {
      return res.status(403).json({
        error: "Not your room",
      });
    }

    if (room.patient_id && room.patient_id !== patient_id) {
      return res.status(403).json({
        error: "Patient does not belong to this room",
      });
    }

    const id = uuidv4();

    await db.query(
      `
      INSERT INTO vitals (
        id,
        room_id,
        patient_id,
        doctor_id,
        stage,
        temperature,
        bp_systolic,
        bp_diastolic,
        sugar,
        spo2,
        heart_rate,
        dosage_given,
        notes
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13
      )
      `,
      [
        id,
        room_id,
        patient_id,
        req.user.id,
        stage,
        temperature ?? null,
        bp_systolic ?? null,
        bp_diastolic ?? null,
        sugar ?? null,
        spo2 ?? null,
        heart_rate ?? null,
        dosage_given ?? null,
        notes ?? null,
      ],
    );

    const result = await db.query("SELECT * FROM vitals WHERE id = $1", [id]);

    const entry = result.rows[0];

    io.to(`room:${room_id}`).emit("vitals:new", entry);

    res.json({
      vitals: entry,
    });
  } catch (error) {
    console.error("Create vitals error:", error);

    res.status(500).json({
      error: "Failed to save vitals",
    });
  }
});

app.get("/api/vitals/room/:roomId", auth(), async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT *
        FROM vitals
        WHERE room_id = $1
        ORDER BY recorded_at ASC
        `,
      [req.params.roomId],
    );

    res.json({
      vitals: result.rows,
    });
  } catch (error) {
    console.error("Room vitals error:", error);

    res.status(500).json({
      error: "Failed to fetch vitals",
    });
  }
});

app.get("/api/vitals/patient/:patientId", auth(), async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT *
        FROM vitals
        WHERE patient_id = $1
        ORDER BY recorded_at ASC
        `,
      [req.params.patientId],
    );

    res.json({
      vitals: result.rows,
    });
  } catch (error) {
    console.error("Patient vitals error:", error);

    res.status(500).json({
      error: "Failed to fetch vitals",
    });
  }
});

// ============================================================
// DOCTOR DASHBOARD ANALYTICS
// ============================================================

app.get("/api/dashboard/doctor", auth("doctor"), async (req, res) => {
  try {
    const roomsResult = await db.query(
      `
        SELECT *
        FROM rooms
        WHERE doctor_id = $1
        ORDER BY created_at DESC
        `,
      [req.user.id],
    );

    const rooms = roomsResult.rows;

    let vitals = [];

    const roomIds = rooms.map((room) => room.id);

    if (roomIds.length > 0) {
      const vitalsResult = await db.query(
        `
          SELECT *
          FROM vitals
          WHERE room_id = ANY($1::text[])
          ORDER BY recorded_at ASC
          `,
        [roomIds],
      );

      vitals = vitalsResult.rows;
    }

    const totalPatients = new Set(
      rooms.filter((room) => room.patient_id).map((room) => room.patient_id),
    ).size;

    const totalVisits = rooms.length;

    const activeVisits = rooms.filter(
      (room) => room.status === "active",
    ).length;

    const completedVisits = rooms.filter(
      (room) => room.status === "completed",
    ).length;

    const avg = (arr) =>
      arr.length
        ? +(
            arr.reduce((sum, value) => sum + Number(value), 0) / arr.length
          ).toFixed(1)
        : null;

    const nums = (field) =>
      vitals
        .map((vital) => vital[field])
        .filter((value) => value !== null && value !== undefined);

    const summary = {
      avgTemperature: avg(nums("temperature")),
      avgSystolic: avg(nums("bp_systolic")),
      avgDiastolic: avg(nums("bp_diastolic")),
      avgSugar: avg(nums("sugar")),
      avgSpo2: avg(nums("spo2")),
      avgHeartRate: avg(nums("heart_rate")),
    };

    const trend = vitals.map((vital) => ({
      date: vital.recorded_at,
      temperature: vital.temperature,
      systolic: vital.bp_systolic,
      diastolic: vital.bp_diastolic,
      sugar: vital.sugar,
      spo2: vital.spo2,
      heart_rate: vital.heart_rate,
      stage: vital.stage,
      patient_id: vital.patient_id,
    }));

    const statusBreakdown = [
      {
        name: "Open",
        value: rooms.filter((room) => room.status === "open").length,
      },
      {
        name: "Active",
        value: activeVisits,
      },
      {
        name: "Completed",
        value: completedVisits,
      },
    ];

    res.json({
      totalPatients,
      totalVisits,
      activeVisits,
      completedVisits,
      summary,
      trend,
      statusBreakdown,
      rooms,
      vitals,
    });
  } catch (error) {
    console.error("Doctor dashboard error:", error);

    res.status(500).json({
      error: "Failed to load doctor dashboard",
    });
  }
});

app.get("/api/dashboard/patient", auth("patient"), async (req, res) => {
  try {
    const roomsResult = await db.query(
      `
        SELECT *
        FROM rooms
        WHERE patient_id = $1
        ORDER BY created_at DESC
        `,
      [req.user.id],
    );

    const vitalsResult = await db.query(
      `
        SELECT *
        FROM vitals
        WHERE patient_id = $1
        ORDER BY recorded_at ASC
        `,
      [req.user.id],
    );

    res.json({
      rooms: roomsResult.rows,
      vitals: vitalsResult.rows,
    });
  } catch (error) {
    console.error("Patient dashboard error:", error);

    res.status(500).json({
      error: "Failed to load patient dashboard",
    });
  }
});

// ============================================================
// SOCKET.IO SIGNALING / WEBRTC
// ============================================================

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  socket.on("room:join", ({ roomCode, userId, userName, role }) => {
    if (!roomCode) return;

    const roomKey = `room:${roomCode}`;

    socket.join(roomKey);

    socket.data = {
      roomCode,
      userId,
      userName,
      role,
    };

    socket.to(roomKey).emit("peer:joined", {
      userId,
      userName,
      role,
      socketId: socket.id,
    });
  });

  socket.on("webrtc:offer", ({ roomCode, offer, to }) => {
    if (!to || !offer) return;

    io.to(to).emit("webrtc:offer", {
      offer,
      from: socket.id,
      userName: socket.data?.userName,
    });
  });

  socket.on("webrtc:answer", ({ answer, to }) => {
    if (!to || !answer) return;

    io.to(to).emit("webrtc:answer", {
      answer,
      from: socket.id,
    });
  });

  socket.on("webrtc:ice-candidate", ({ candidate, to }) => {
    if (!to || !candidate) return;

    io.to(to).emit("webrtc:ice-candidate", {
      candidate,
      from: socket.id,
    });
  });

  socket.on("room:leave", ({ roomCode }) => {
    if (!roomCode) return;

    const roomKey = `room:${roomCode}`;

    socket.leave(roomKey);

    socket.to(roomKey).emit("peer:left", {
      socketId: socket.id,
    });
  });

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);

    if (socket.data?.roomCode) {
      socket.to(`room:${socket.data.roomCode}`).emit("peer:left", {
        socketId: socket.id,
      });
    }
  });
});

// ============================================================
// SERVE CLIENT IN PRODUCTION
// ============================================================

const clientDist = path.join(__dirname, "..", "client", "dist");

app.use(express.static(clientDist));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  res.sendFile(path.join(clientDist, "index.html"));
});

// ============================================================
// START SERVER
// ============================================================

server.listen(PORT, () => {
  console.log(`CareThread server running on port ${PORT}`);
});