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
const io = new Server(server, { cors: { origin: "*" } });

const JWT_SECRET = "carethread_hackathon_secret_key_change_in_prod";
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// ---------- AUTH MIDDLEWARE ----------
function auth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "No token provided" });
    const token = header.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (requiredRole && decoded.role !== requiredRole) {
        return res.status(403).json({ error: `Requires ${requiredRole} role` });
      }
      req.user = decoded;
      next();
    } catch (e) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

function genRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++)
    code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function signToken(user) {
  return jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function publicUser(u) {
  const { password_hash, ...rest } = u;
  return rest;
}

// ---------- AUTH ROUTES ----------
// ---------- AUTH ROUTES ----------

// Validation helpers
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password) {
  return (
    password.length >= 6 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}

function isValidPhone(phone) {
  // Exactly 10 digits
  return /^\d{10}$/.test(phone);
}


// ---------- SIGNUP ----------
app.post("/api/auth/signup", (req, res) => {
  let {
    name,
    email,
    password,
    role,
    age,
    gender,
    phone,
    medical_conditions,
    specialization,
  } = req.body;

  // Basic required fields
  if (!name || !email || !password || !role) {
    return res.status(400).json({
      error: "Missing required fields",
    });
  }

  // Clean email
  email = email.trim().toLowerCase();

  // Validate email
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "Please enter a valid email address",
    });
  }

  // Validate role
  if (!["doctor", "patient"].includes(role)) {
    return res.status(400).json({
      error: "Invalid role",
    });
  }

  // Validate password
  if (!isValidPassword(password)) {
    return res.status(400).json({
      error:
        "Password must be at least 6 characters and contain at least one letter and one number",
    });
  }

  // Patient-specific validation
  if (role === "patient") {

    // Age validation
    if (age !== "" && age !== null && age !== undefined) {
      age = Number(age);

      if (!Number.isInteger(age) || age < 1 || age > 140) {
        return res.status(400).json({
          error: "Age must be between 1 and 140",
        });
      }
    }

    // Phone validation
    if (phone && phone.trim() !== "") {

      // Remove spaces, +, hyphens etc.
      phone = phone.replace(/\D/g, "");

      if (!isValidPhone(phone)) {
        return res.status(400).json({
          error: "Phone number must contain exactly 10 digits",
        });
      }
    }
  }

  // Check if account already exists
  const existing = db
    .prepare("SELECT id FROM users WHERE email = ?")
    .get(email);

  if (existing) {
    return res.status(409).json({
      error: "Email already registered",
    });
  }

  // Create user
  const id = uuidv4();
  const password_hash = bcrypt.hashSync(password, 10);

  db.prepare(`
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
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(
    id,
    name.trim(),
    email,
    password_hash,
    role,
    age || null,
    gender || null,
    phone || null,
    medical_conditions || null,
    specialization || null,
  );

  const user = db
    .prepare("SELECT * FROM users WHERE id = ?")
    .get(id);

  const token = signToken(user);

  res.json({
    token,
    user: publicUser(user),
  });
});


// ---------- LOGIN ----------
app.post("/api/auth/login", (req, res) => {
  let { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      error: "Email and password are required",
    });
  }

  email = email.trim().toLowerCase();

  // Validate email format
  if (!isValidEmail(email)) {
    return res.status(400).json({
      error: "Please enter a valid email address",
    });
  }

  // Find account
  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email);

  // IMPORTANT: Account does not exist
  if (!user) {
    return res.status(404).json({
      error: "No account found with this email",
    });
  }

  // Account exists, but wrong role selected
  if (role && user.role !== role) {
    return res.status(401).json({
      error: `No ${role} account found for this email`,
    });
  }

  // Account exists but password is wrong
  if (!bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({
      error: "Incorrect password",
    });
  }

  const token = signToken(user);

  res.json({
    token,
    user: publicUser(user),
  });
});
// ---------- ROOM ROUTES ----------
app.post("/api/rooms", auth("doctor"), (req, res) => {
  const { title } = req.body;
  const id = uuidv4();
  let code = genRoomCode();
  while (db.prepare("SELECT id FROM rooms WHERE code = ?").get(code))
    code = genRoomCode();

  db.prepare(
    `INSERT INTO rooms (id, code, title, doctor_id, status) VALUES (?,?,?,?, 'open')`,
  ).run(id, code, title || "Trial Visit", req.user.id);

  const room = db.prepare("SELECT * FROM rooms WHERE id = ?").get(id);
  res.json({ room });
});

app.get("/api/rooms/mine", auth("doctor"), (req, res) => {
  const rooms = db
    .prepare(
      `
    SELECT r.*, u.name as patient_name, u.email as patient_email
    FROM rooms r LEFT JOIN users u ON r.patient_id = u.id
    WHERE r.doctor_id = ? ORDER BY r.created_at DESC
  `,
    )
    .all(req.user.id);
  res.json({ rooms });
});

app.get("/api/rooms/patient/mine", auth("patient"), (req, res) => {
  const rooms = db
    .prepare(
      `
    SELECT r.*, u.name as doctor_name
    FROM rooms r LEFT JOIN users u ON r.doctor_id = u.id
    WHERE r.patient_id = ? ORDER BY r.created_at DESC
  `,
    )
    .all(req.user.id);
  res.json({ rooms });
});

app.post("/api/rooms/join", auth("patient"), (req, res) => {
  const { code } = req.body;
  const room = db
    .prepare("SELECT * FROM rooms WHERE code = ?")
    .get((code || "").toUpperCase().trim());
  if (!room) return res.status(404).json({ error: "Invalid room code" });
  if (room.patient_id && room.patient_id !== req.user.id) {
    return res.status(409).json({ error: "This room already has a patient" });
  }
  db.prepare(
    `UPDATE rooms SET patient_id = ?, status = 'active' WHERE id = ?`,
  ).run(req.user.id, room.id);
  const updated = db.prepare("SELECT * FROM rooms WHERE id = ?").get(room.id);
  res.json({ room: updated });
});

app.get("/api/rooms/:code", auth(), (req, res) => {
  const room = db
    .prepare(
      `
    SELECT r.*, d.name as doctor_name, p.name as patient_name
    FROM rooms r
    LEFT JOIN users d ON r.doctor_id = d.id
    LEFT JOIN users p ON r.patient_id = p.id
    WHERE r.code = ?
  `,
    )
    .get(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: "Room not found" });
  if (req.user.role === "doctor" && room.doctor_id !== req.user.id) {
    return res.status(403).json({ error: "Not your room" });
  }
  if (
    req.user.role === "patient" &&
    room.patient_id &&
    room.patient_id !== req.user.id
  ) {
    return res.status(403).json({ error: "Not your room" });
  }
  res.json({ room });
});

app.post("/api/rooms/:code/complete", auth("doctor"), (req, res) => {
  const room = db
    .prepare("SELECT * FROM rooms WHERE code = ?")
    .get(req.params.code.toUpperCase());
  if (!room || room.doctor_id !== req.user.id)
    return res.status(404).json({ error: "Room not found" });
  db.prepare(
    `UPDATE rooms SET status='completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`,
  ).run(room.id);
  // Tell everyone still in the call (chiefly the patient) that the visit is
  // over, so they get moved out automatically instead of being left stuck
  // in a room with no way to leave.
  io.to(`room:${room.code}`).emit("room:completed");
  res.json({ ok: true });
});

// ---------- VITALS ROUTES ----------
app.post("/api/vitals", auth("doctor"), (req, res) => {
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
  if (!room_id || !patient_id || !stage)
    return res.status(400).json({ error: "Missing required fields" });
  const id = uuidv4();
  db.prepare(
    `
    INSERT INTO vitals (id, room_id, patient_id, doctor_id, stage, temperature, bp_systolic, bp_diastolic, sugar, spo2, heart_rate, dosage_given, notes)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `,
  ).run(
    id,
    room_id,
    patient_id,
    req.user.id,
    stage,
    temperature || null,
    bp_systolic || null,
    bp_diastolic || null,
    sugar || null,
    spo2 || null,
    heart_rate || null,
    dosage_given || null,
    notes || null,
  );

  const entry = db.prepare("SELECT * FROM vitals WHERE id = ?").get(id);
  io.to(`room:${room_id}`).emit("vitals:new", entry);
  res.json({ vitals: entry });
});

app.get("/api/vitals/room/:roomId", auth(), (req, res) => {
  const rows = db
    .prepare("SELECT * FROM vitals WHERE room_id = ? ORDER BY recorded_at ASC")
    .all(req.params.roomId);
  res.json({ vitals: rows });
});

app.get("/api/vitals/patient/:patientId", auth(), (req, res) => {
  const rows = db
    .prepare(
      "SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at ASC",
    )
    .all(req.params.patientId);
  res.json({ vitals: rows });
});

// ---------- DOCTOR DASHBOARD ANALYTICS ----------
app.get("/api/dashboard/doctor", auth("doctor"), (req, res) => {
  const rooms = db
    .prepare("SELECT * FROM rooms WHERE doctor_id = ?")
    .all(req.user.id);
  const roomIds = rooms.map((r) => r.id);

  let vitals = [];
  if (roomIds.length) {
    const placeholders = roomIds.map(() => "?").join(",");
    vitals = db
      .prepare(
        `SELECT * FROM vitals WHERE room_id IN (${placeholders}) ORDER BY recorded_at ASC`,
      )
      .all(...roomIds);
  }

  const totalPatients = new Set(
    rooms.filter((r) => r.patient_id).map((r) => r.patient_id),
  ).size;
  const totalVisits = rooms.length;
  const activeVisits = rooms.filter((r) => r.status === "active").length;
  const completedVisits = rooms.filter((r) => r.status === "completed").length;

  const avg = (arr) =>
    arr.length
      ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)
      : null;
  const nums = (field) =>
    vitals.map((v) => v[field]).filter((v) => v !== null && v !== undefined);

  const summary = {
    avgTemperature: avg(nums("temperature")),
    avgSystolic: avg(nums("bp_systolic")),
    avgDiastolic: avg(nums("bp_diastolic")),
    avgSugar: avg(nums("sugar")),
    avgSpo2: avg(nums("spo2")),
    avgHeartRate: avg(nums("heart_rate")),
  };

  const trend = vitals.map((v) => ({
    date: v.recorded_at,
    temperature: v.temperature,
    systolic: v.bp_systolic,
    diastolic: v.bp_diastolic,
    sugar: v.sugar,
    spo2: v.spo2,
    heart_rate: v.heart_rate,
    stage: v.stage,
    patient_id: v.patient_id,
  }));

  const statusBreakdown = [
    { name: "Open", value: rooms.filter((r) => r.status === "open").length },
    { name: "Active", value: activeVisits },
    { name: "Completed", value: completedVisits },
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
});

app.get("/api/dashboard/patient", auth("patient"), (req, res) => {
  const rooms = db
    .prepare("SELECT * FROM rooms WHERE patient_id = ?")
    .all(req.user.id);
  const vitals = db
    .prepare(
      "SELECT * FROM vitals WHERE patient_id = ? ORDER BY recorded_at ASC",
    )
    .all(req.user.id);
  res.json({ rooms, vitals });
});

// ---------- SOCKET.IO SIGNALING (WebRTC) ----------
io.on("connection", (socket) => {
  socket.on("room:join", ({ roomCode, userId, userName, role }) => {
    const roomKey = `room:${roomCode}`;
    socket.join(roomKey);
    socket.data = { roomCode, userId, userName, role };
    socket
      .to(roomKey)
      .emit("peer:joined", { userId, userName, role, socketId: socket.id });
  });

  socket.on("webrtc:offer", ({ roomCode, offer, to }) => {
    io.to(to).emit("webrtc:offer", {
      offer,
      from: socket.id,
      userName: socket.data?.userName,
    });
  });

  socket.on("webrtc:answer", ({ answer, to }) => {
    io.to(to).emit("webrtc:answer", { answer, from: socket.id });
  });

  socket.on("webrtc:ice-candidate", ({ candidate, to }) => {
    io.to(to).emit("webrtc:ice-candidate", { candidate, from: socket.id });
  });

  socket.on("room:leave", ({ roomCode }) => {
    socket.leave(`room:${roomCode}`);
    socket.to(`room:${roomCode}`).emit("peer:left", { socketId: socket.id });
  });

  socket.on("disconnect", () => {
    if (socket.data?.roomCode) {
      socket
        .to(`room:${socket.data.roomCode}`)
        .emit("peer:left", { socketId: socket.id });
    }
  });
});

// ---------- SERVE CLIENT (production) ----------
const clientDist = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(clientDist, "index.html"));
});

server.listen(PORT, () => {
  console.log(`CareThread server running on port ${PORT}`);
});
