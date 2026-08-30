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

/*
|--------------------------------------------------------------------------
| SOCKET.IO
|--------------------------------------------------------------------------
*/

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

/*
|--------------------------------------------------------------------------
| CONFIGURATION
|--------------------------------------------------------------------------
*/

const JWT_SECRET =
  process.env.JWT_SECRET ||
  "carethread_hackathon_secret_key_change_in_prod";

const PORT =
  process.env.PORT || 4000;

/*
|--------------------------------------------------------------------------
| MIDDLEWARE
|--------------------------------------------------------------------------
*/

app.use(cors());

app.use(express.json());

/*
|--------------------------------------------------------------------------
| AUTH MIDDLEWARE
|--------------------------------------------------------------------------
*/

function auth(requiredRole) {
  return (req, res, next) => {
    const header =
      req.headers.authorization;

    if (!header) {
      return res.status(401).json({
        error: "No token provided",
      });
    }

    const token =
      header.split(" ")[1];

    if (!token) {
      return res.status(401).json({
        error:
          "Invalid authorization header",
      });
    }

    try {
      const decoded =
        jwt.verify(
          token,
          JWT_SECRET
        );

      if (
        requiredRole &&
        decoded.role !== requiredRole
      ) {
        return res.status(403).json({
          error:
            `Requires ${requiredRole} role`,
        });
      }

      req.user = decoded;

      next();
    } catch (error) {
      console.error(
        "Authentication error:",
        error.message
      );

      return res.status(401).json({
        error:
          "Invalid or expired token",
      });
    }
  };
}

/*
|--------------------------------------------------------------------------
| HELPERS
|--------------------------------------------------------------------------
*/

function genRoomCode() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (let i = 0; i < 6; i++) {
    code +=
      chars[
        Math.floor(
          Math.random() *
            chars.length
        )
      ];
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
    }
  );
}

function publicUser(user) {
  if (!user) {
    return null;
  }

  const {
    password_hash,
    ...rest
  } = user;

  return rest;
}

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get(
  "/api/health",
  async (req, res) => {
    try {
      const result =
        await db.query(
          "SELECT NOW() AS now"
        );

      res.json({
        ok: true,
        database: "connected",
        time:
          result.rows[0].now,
      });
    } catch (error) {
      console.error(
        "Health check error:",
        error
      );

      res.status(500).json({
        ok: false,
        database:
          "disconnected",
        error:
          error.message,
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| AUTH
|--------------------------------------------------------------------------
*/

/*
|--------------------------------------------------------------------------
| SIGNUP
|--------------------------------------------------------------------------
*/

app.post(
  "/api/auth/signup",
  async (req, res) => {
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
        req.body.age === "" ||
        req.body.age === undefined ||
        req.body.age === null
          ? null
          : Number(req.body.age);

      if (
        age !== null &&
        (
          !Number.isInteger(age) ||
          age < 0 ||
          age > 150
        )
      ) {
        return res.status(400).json({
          error:
            "Age must be a valid number",
        });
      }

      if (
        !name ||
        !email ||
        !password ||
        !role
      ) {
        return res.status(400).json({
          error:
            "Missing required fields",
        });
      }

      if (
        !["doctor", "patient"].includes(
          role
        )
      ) {
        return res.status(400).json({
          error:
            "Invalid role",
        });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const existing =
        await db.query(
          `
          SELECT id
          FROM users
          WHERE email = $1
          `,
          [normalizedEmail]
        );

      if (
        existing.rows.length > 0
      ) {
        return res.status(409).json({
          error:
            "Email already registered",
        });
      }

      const id = uuidv4();

      const password_hash =
        await bcrypt.hash(
          password,
          10
        );

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
        VALUES (
          $1,$2,$3,$4,$5,
          $6,$7,$8,$9,$10
        )
        `,
        [
          id,
          name.trim(),
          normalizedEmail,
          password_hash,
          role,
          age,
          gender || null,
          phone || null,
          medical_conditions ||
            null,
          specialization ||
            null,
        ]
      );

      const result =
        await db.query(
          `
          SELECT *
          FROM users
          WHERE id = $1
          `,
          [id]
        );

      const user =
        result.rows[0];

      const token =
        signToken(user);

      res.json({
        token,
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "Signup error:",
        error
      );

      if (
        error.code === "23505"
      ) {
        return res.status(409).json({
          error:
            "Email already registered",
        });
      }

      res.status(500).json({
        error:
          "Failed to create account",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

app.post(
  "/api/auth/login",
  async (req, res) => {
    try {
      const {
        email,
        password,
        role,
      } = req.body;

      if (
        !email ||
        !password
      ) {
        return res.status(400).json({
          error:
            "Email and password are required",
        });
      }

      const normalizedEmail =
        email
          .trim()
          .toLowerCase();

      const result =
        await db.query(
          `
          SELECT *
          FROM users
          WHERE email = $1
          `,
          [normalizedEmail]
        );

      const user =
        result.rows[0];

      if (!user) {
        return res.status(401).json({
          error:
            "Invalid credentials",
        });
      }

      if (
        role &&
        user.role !== role
      ) {
        return res.status(401).json({
          error:
            `No ${role} account found for this email`,
        });
      }

      const validPassword =
        await bcrypt.compare(
          password,
          user.password_hash
        );

      if (!validPassword) {
        return res.status(401).json({
          error:
            "Invalid credentials",
        });
      }

      const token =
        signToken(user);

      res.json({
        token,
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "Login error:",
        error
      );

      res.status(500).json({
        error:
          "Login failed",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

app.get(
  "/api/auth/me",
  auth(),
  async (req, res) => {
    try {
      const result =
        await db.query(
          `
          SELECT *
          FROM users
          WHERE id = $1
          `,
          [req.user.id]
        );

      const user =
        result.rows[0];

      if (!user) {
        return res.status(404).json({
          error:
            "User not found",
        });
      }

      res.json({
        user:
          publicUser(user),
      });
    } catch (error) {
      console.error(
        "Auth me error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to fetch user",
      });
    }
  }
);

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/

app.put(
  "/api/auth/me",
  auth(),
  async (req, res) => {
    try {
      const { name, phone, specialization, medical_conditions } = req.body;

      if (!name || !name.trim()) {
        return res.status(400).json({ error: "Name is required" });
      }

      const result = await db.query(
        `
        UPDATE users
        SET
          name = $1,
          phone = $2,
          specialization = $3,
          medical_conditions = $4
        WHERE id = $5
        RETURNING *
        `,
        [
          name.trim(),
          phone ?? null,
          specialization ?? null,
          medical_conditions ?? null,
          req.user.id,
        ],
      );

      const user = result.rows[0];
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json({ user: publicUser(user) });
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  }
);

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD
|--------------------------------------------------------------------------
*/

app.put(
  "/api/auth/password",
  auth(),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res
          .status(400)
          .json({ error: "Current and new password are required" });
      }
      if (newPassword.length < 6) {
        return res
          .status(400)
          .json({ error: "New password must be at least 6 characters" });
      }

      const result = await db.query("SELECT * FROM users WHERE id = $1", [
        req.user.id,
      ]);
      const user = result.rows[0];
      if (!user) return res.status(404).json({ error: "User not found" });

      const valid = await bcrypt.compare(currentPassword, user.password_hash);
      if (!valid) {
        return res.status(401).json({ error: "Current password is incorrect" });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      await db.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
        newHash,
        req.user.id,
      ]);

      res.json({ ok: true });
    } catch (error) {
      console.error("Change password error:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  }
);

/*
|--------------------------------------------------------------------------
| WORKSPACE ROUTES
|--------------------------------------------------------------------------
*/

function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function genUniqueCode(table, column = "code") {
  let code;
  while (true) {
    const candidate = genCode();
    const existing = await db.query(
      `SELECT id FROM ${table} WHERE ${column} = $1`,
      [candidate],
    );
    if (existing.rows.length === 0) {
      code = candidate;
      break;
    }
  }
  return code;
}

// ---------- Create / list workspaces ----------

app.post("/api/workspaces", auth("doctor"), async (req, res) => {
  try {
    const { drug_name, title, description } = req.body;

    if (!drug_name || !drug_name.trim()) {
      return res.status(400).json({ error: "Drug name is required" });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "Workspace title is required" });
    }

    const id = uuidv4();
    const code = await genUniqueCode("workspaces");

    await db.query(
      `
      INSERT INTO workspaces (id, doctor_id, drug_name, title, description, code, status)
      VALUES ($1,$2,$3,$4,$5,$6,'active')
      `,
      [id, req.user.id, drug_name.trim(), title.trim(), description?.trim() || null, code],
    );

    const result = await db.query("SELECT * FROM workspaces WHERE id = $1", [id]);
    res.json({ workspace: result.rows[0] });
  } catch (error) {
    console.error("Create workspace error:", error);
    res.status(500).json({ error: "Failed to create workspace" });
  }
});

app.get("/api/workspaces/mine", auth("doctor"), async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        w.*,
        COUNT(DISTINCT wp.patient_id) FILTER (WHERE wp.status = 'active') AS patient_count,
        COUNT(DISTINCT sv.id) AS visit_count,
        COUNT(DISTINCT sv.id) FILTER (WHERE sv.status = 'scheduled' AND sv.scheduled_at > NOW()) AS upcoming_visit_count
      FROM workspaces w
      LEFT JOIN workspace_patients wp ON wp.workspace_id = w.id
      LEFT JOIN scheduled_visits sv ON sv.workspace_id = w.id
      WHERE w.doctor_id = $1
      GROUP BY w.id
      ORDER BY w.created_at DESC
      `,
      [req.user.id],
    );
    res.json({ workspaces: result.rows });
  } catch (error) {
    console.error("List doctor workspaces error:", error);
    res.status(500).json({ error: "Failed to fetch workspaces" });
  }
});

async function getWorkspaceOr404(workspaceId, res) {
  const result = await db.query("SELECT * FROM workspaces WHERE id = $1", [workspaceId]);
  const workspace = result.rows[0];
  if (!workspace) {
    res.status(404).json({ error: "Workspace not found" });
    return null;
  }
  return workspace;
}

app.get("/api/workspaces/:workspaceId", auth(), async (req, res) => {
  try {
    const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
    if (!workspace) return;

    if (req.user.role === "doctor" && workspace.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your workspace" });
    }
    if (req.user.role === "patient") {
      const enrolled = await db.query(
        "SELECT id FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2",
        [workspace.id, req.user.id],
      );
      if (enrolled.rows.length === 0) {
        return res.status(403).json({ error: "Not enrolled in this workspace" });
      }
    }

    res.json({ workspace });
  } catch (error) {
    console.error("Get workspace error:", error);
    res.status(500).json({ error: "Failed to fetch workspace" });
  }
});

app.put("/api/workspaces/:workspaceId", auth("doctor"), async (req, res) => {
  try {
    const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
    if (!workspace) return;
    if (workspace.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your workspace" });
    }

    const { title, description, status } = req.body;
    const validStatuses = ["active", "completed", "archived"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await db.query(
      `
      UPDATE workspaces
      SET title = $1, description = $2, status = $3
      WHERE id = $4
      RETURNING *
      `,
      [
        title?.trim() || workspace.title,
        description !== undefined ? description : workspace.description,
        status || workspace.status,
        workspace.id,
      ],
    );

    res.json({ workspace: result.rows[0] });
  } catch (error) {
    console.error("Update workspace error:", error);
    res.status(500).json({ error: "Failed to update workspace" });
  }
});

// ---------- Enrollment ----------

app.post("/api/workspaces/join", auth("patient"), async (req, res) => {
  try {
    const code = (req.body.code || "").toUpperCase().trim();
    if (!code) {
      return res.status(400).json({ error: "Workspace code is required" });
    }

    const workspaceResult = await db.query("SELECT * FROM workspaces WHERE code = $1", [code]);
    const workspace = workspaceResult.rows[0];
    if (!workspace) {
      return res.status(404).json({ error: "Invalid workspace code" });
    }
    if (workspace.status !== "active") {
      return res.status(409).json({ error: "This workspace is no longer accepting patients" });
    }

    const existing = await db.query(
      "SELECT * FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2",
      [workspace.id, req.user.id],
    );

    if (existing.rows.length > 0) {
      if (existing.rows[0].status !== "active") {
        await db.query(
          "UPDATE workspace_patients SET status = 'active' WHERE id = $1",
          [existing.rows[0].id],
        );
      }
      return res.json({ workspace, alreadyEnrolled: true });
    }

    await db.query(
      `INSERT INTO workspace_patients (id, workspace_id, patient_id, status) VALUES ($1,$2,$3,'active')`,
      [uuidv4(), workspace.id, req.user.id],
    );

    res.json({ workspace, alreadyEnrolled: false });
  } catch (error) {
    console.error("Join workspace error:", error);
    res.status(500).json({ error: "Failed to join workspace" });
  }
});

app.get("/api/workspaces/patient/mine", auth("patient"), async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT
        w.*,
        d.name AS doctor_name,
        wp.joined_at,
        wp.status AS enrollment_status,
        (
          SELECT sv.scheduled_at
          FROM scheduled_visits sv
          WHERE sv.workspace_id = w.id
            AND sv.patient_id = $1
            AND sv.status IN ('scheduled', 'active')
            AND sv.scheduled_at >= NOW() - INTERVAL '2 hours'
          ORDER BY sv.scheduled_at ASC
          LIMIT 1
        ) AS next_visit_at,
        (
          SELECT sv.room_code
          FROM scheduled_visits sv
          WHERE sv.workspace_id = w.id
            AND sv.patient_id = $1
            AND sv.status IN ('scheduled', 'active')
            AND sv.scheduled_at >= NOW() - INTERVAL '2 hours'
          ORDER BY sv.scheduled_at ASC
          LIMIT 1
        ) AS next_visit_code
      FROM workspace_patients wp
      JOIN workspaces w ON w.id = wp.workspace_id
      JOIN users d ON d.id = w.doctor_id
      WHERE wp.patient_id = $1
      ORDER BY wp.joined_at DESC
      `,
      [req.user.id],
    );
    res.json({ workspaces: result.rows });
  } catch (error) {
    console.error("List patient workspaces error:", error);
    res.status(500).json({ error: "Failed to fetch workspaces" });
  }
});

// ---------- Patient roster (doctor view, scoped to one workspace) ----------

app.get("/api/workspaces/:workspaceId/patients", auth("doctor"), async (req, res) => {
  try {
    const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
    if (!workspace) return;
    if (workspace.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your workspace" });
    }

    const result = await db.query(
      `
      SELECT
        u.id, u.name, u.email, u.age, u.gender, u.phone, u.medical_conditions,
        wp.joined_at, wp.status AS enrollment_status,
        COUNT(DISTINCT sv.id) AS visit_count,
        COUNT(DISTINCT sv.id) FILTER (WHERE sv.status = 'completed') AS completed_visit_count,
        MAX(sv.scheduled_at) FILTER (WHERE sv.status = 'completed') AS last_visit_at,
        MIN(sv.scheduled_at) FILTER (WHERE sv.status = 'scheduled' AND sv.scheduled_at > NOW()) AS next_visit_at
      FROM workspace_patients wp
      JOIN users u ON u.id = wp.patient_id
      LEFT JOIN scheduled_visits sv ON sv.patient_id = u.id AND sv.workspace_id = wp.workspace_id
      WHERE wp.workspace_id = $1
      GROUP BY u.id, wp.joined_at, wp.status
      ORDER BY wp.joined_at DESC
      `,
      [workspace.id],
    );

    res.json({ patients: result.rows });
  } catch (error) {
    console.error("Workspace patients error:", error);
    res.status(500).json({ error: "Failed to fetch patients" });
  }
});

// ============================================================
// SCHEDULED VISIT ROUTES
// ============================================================

app.post("/api/workspaces/:workspaceId/visits", auth("doctor"), async (req, res) => {
  try {
    const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
    if (!workspace) return;
    if (workspace.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your workspace" });
    }

    const { patient_id, scheduled_at, title } = req.body;
    if (!patient_id || !scheduled_at) {
      return res.status(400).json({ error: "Patient and scheduled time are required" });
    }

    const enrolled = await db.query(
      "SELECT id FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2 AND status = 'active'",
      [workspace.id, patient_id],
    );
    if (enrolled.rows.length === 0) {
      return res.status(400).json({ error: "Patient is not enrolled in this workspace" });
    }

    const id = uuidv4();
    const roomCode = await genUniqueCode("scheduled_visits", "room_code");

    await db.query(
      `
      INSERT INTO scheduled_visits (id, workspace_id, patient_id, doctor_id, room_code, title, scheduled_at, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled')
      `,
      [id, workspace.id, patient_id, req.user.id, roomCode, title?.trim() || null, scheduled_at],
    );

    const result = await db.query("SELECT * FROM scheduled_visits WHERE id = $1", [id]);
    res.json({ visit: result.rows[0] });
  } catch (error) {
    console.error("Schedule visit error:", error);
    res.status(500).json({ error: "Failed to schedule visit" });
  }
});

app.get("/api/workspaces/:workspaceId/visits", auth("doctor"), async (req, res) => {
  try {
    const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
    if (!workspace) return;
    if (workspace.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your workspace" });
    }

    const result = await db.query(
      `
      SELECT sv.*, u.name AS patient_name
      FROM scheduled_visits sv
      JOIN users u ON u.id = sv.patient_id
      WHERE sv.workspace_id = $1
      ORDER BY sv.scheduled_at ASC
      `,
      [workspace.id],
    );

    res.json({ visits: result.rows });
  } catch (error) {
    console.error("List workspace visits error:", error);
    res.status(500).json({ error: "Failed to fetch visits" });
  }
});

app.put("/api/visits/:visitId", auth("doctor"), async (req, res) => {
  try {
    const existing = await db.query("SELECT * FROM scheduled_visits WHERE id = $1", [
      req.params.visitId,
    ]);
    const visit = existing.rows[0];
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    if (visit.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    const { scheduled_at, title, status } = req.body;
    const validStatuses = ["scheduled", "active", "completed", "missed", "cancelled"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const result = await db.query(
      `
      UPDATE scheduled_visits
      SET
        scheduled_at = $1,
        title = $2,
        status = $3
      WHERE id = $4
      RETURNING *
      `,
      [
        scheduled_at || visit.scheduled_at,
        title !== undefined ? title : visit.title,
        status || visit.status,
        visit.id,
      ],
    );

    res.json({ visit: result.rows[0] });
  } catch (error) {
    console.error("Update visit error:", error);
    res.status(500).json({ error: "Failed to update visit" });
  }
});

app.get("/api/visits/patient/mine", auth("patient"), async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT sv.*, w.title AS workspace_title, w.drug_name, d.name AS doctor_name
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      JOIN users d ON d.id = sv.doctor_id
      WHERE sv.patient_id = $1
      ORDER BY sv.scheduled_at ASC
      `,
      [req.user.id],
    );
    res.json({ visits: result.rows });
  } catch (error) {
    console.error("List patient visits error:", error);
    res.status(500).json({ error: "Failed to fetch visits" });
  }
});

// ---------- Visit room lookup (used by VisitRoom page) ----------

app.get("/api/visits/by-code/:code", auth(), async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const result = await db.query(
      `
      SELECT sv.*, w.title AS workspace_title, w.drug_name, d.name AS doctor_name, p.name AS patient_name
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      JOIN users d ON d.id = sv.doctor_id
      JOIN users p ON p.id = sv.patient_id
      WHERE sv.room_code = $1
      `,
      [code],
    );
    let visit = result.rows[0];
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    if (req.user.role === "doctor" && visit.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }
    if (req.user.role === "patient" && visit.patient_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    // Implicitly mark the visit active the first time someone opens it.
    if (visit.status === "scheduled") {
      const updated = await db.query(
        `UPDATE scheduled_visits SET status = 'active', started_at = NOW() WHERE id = $1 RETURNING *`,
        [visit.id],
      );
      visit = { ...visit, ...updated.rows[0] };
    }

    res.json({ visit });
  } catch (error) {
    console.error("Get visit by code error:", error);
    res.status(500).json({ error: "Failed to fetch visit" });
  }
});

app.post("/api/visits/by-code/:code/complete", auth("doctor"), async (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const result = await db.query("SELECT * FROM scheduled_visits WHERE room_code = $1", [code]);
    const visit = result.rows[0];
    if (!visit || visit.doctor_id !== req.user.id) {
      return res.status(404).json({ error: "Visit not found" });
    }

    await db.query(
      `UPDATE scheduled_visits SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [visit.id],
    );

    io.to(`room:${code}`).emit("room:completed");
    res.json({ ok: true });
  } catch (error) {
    console.error("Complete visit error:", error);
    res.status(500).json({ error: "Failed to complete visit" });
  }
});

// ============================================================
// VITALS ROUTES (split: patient submits readings, doctor submits dosage/notes)
// ============================================================

async function getVisitOr404(scheduledVisitId, res) {
  const result = await db.query("SELECT * FROM scheduled_visits WHERE id = $1", [
    scheduledVisitId,
  ]);
  const visit = result.rows[0];
  if (!visit) {
    res.status(404).json({ error: "Visit not found" });
    return null;
  }
  return visit;
}

const VALID_STAGES = ["pre_dosage", "post_dosage", "general"];

app.put("/api/vitals/patient", auth("patient"), async (req, res) => {
  try {
    const { scheduled_visit_id, stage, temperature, bp_systolic, bp_diastolic, sugar, spo2, heart_rate } =
      req.body;

    if (!scheduled_visit_id || !stage) {
      return res.status(400).json({ error: "Visit and stage are required" });
    }
    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }

    const visit = await getVisitOr404(scheduled_visit_id, res);
    if (!visit) return;
    if (visit.patient_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    const id = uuidv4();
    const result = await db.query(
      `
      INSERT INTO vitals (
        id, scheduled_visit_id, workspace_id, patient_id, doctor_id, stage,
        temperature, bp_systolic, bp_diastolic, sugar, spo2, heart_rate, patient_submitted_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW())
      ON CONFLICT (scheduled_visit_id, stage) DO UPDATE SET
        temperature = EXCLUDED.temperature,
        bp_systolic = EXCLUDED.bp_systolic,
        bp_diastolic = EXCLUDED.bp_diastolic,
        sugar = EXCLUDED.sugar,
        spo2 = EXCLUDED.spo2,
        heart_rate = EXCLUDED.heart_rate,
        patient_submitted_at = NOW()
      RETURNING *
      `,
      [
        id,
        visit.id,
        visit.workspace_id,
        visit.patient_id,
        visit.doctor_id,
        stage,
        temperature ?? null,
        bp_systolic ?? null,
        bp_diastolic ?? null,
        sugar ?? null,
        spo2 ?? null,
        heart_rate ?? null,
      ],
    );

    const entry = result.rows[0];
    io.to(`room:${visit.room_code}`).emit("vitals:new", entry);
    res.json({ vitals: entry });
  } catch (error) {
    console.error("Patient vitals upsert error:", error);
    res.status(500).json({ error: "Failed to save vitals" });
  }
});

app.put("/api/vitals/doctor", auth("doctor"), async (req, res) => {
  try {
    const { scheduled_visit_id, stage, dosage_given, doctor_notes } = req.body;

    if (!scheduled_visit_id || !stage) {
      return res.status(400).json({ error: "Visit and stage are required" });
    }
    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }

    const visit = await getVisitOr404(scheduled_visit_id, res);
    if (!visit) return;
    if (visit.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    const id = uuidv4();
    const result = await db.query(
      `
      INSERT INTO vitals (
        id, scheduled_visit_id, workspace_id, patient_id, doctor_id, stage,
        dosage_given, doctor_notes, doctor_submitted_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW())
      ON CONFLICT (scheduled_visit_id, stage) DO UPDATE SET
        dosage_given = EXCLUDED.dosage_given,
        doctor_notes = EXCLUDED.doctor_notes,
        doctor_submitted_at = NOW()
      RETURNING *
      `,
      [
        id,
        visit.id,
        visit.workspace_id,
        visit.patient_id,
        visit.doctor_id,
        stage,
        dosage_given ?? null,
        doctor_notes ?? null,
      ],
    );

    const entry = result.rows[0];
    io.to(`room:${visit.room_code}`).emit("vitals:new", entry);
    res.json({ vitals: entry });
  } catch (error) {
    console.error("Doctor vitals upsert error:", error);
    res.status(500).json({ error: "Failed to save vitals" });
  }
});

app.get("/api/vitals/visit/:scheduledVisitId", auth(), async (req, res) => {
  try {
    const visit = await getVisitOr404(req.params.scheduledVisitId, res);
    if (!visit) return;
    if (req.user.role === "doctor" && visit.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }
    if (req.user.role === "patient" && visit.patient_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    const result = await db.query(
      `SELECT * FROM vitals WHERE scheduled_visit_id = $1 ORDER BY stage ASC`,
      [visit.id],
    );
    res.json({ vitals: result.rows });
  } catch (error) {
    console.error("Get visit vitals error:", error);
    res.status(500).json({ error: "Failed to fetch vitals" });
  }
});

// ============================================================
// DASHBOARD / ANALYTICS
// ============================================================

app.get("/api/workspaces/:workspaceId/dashboard", auth("doctor"), async (req, res) => {
  try {
    const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
    if (!workspace) return;
    if (workspace.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your workspace" });
    }

    const patientCountResult = await db.query(
      "SELECT COUNT(*) FROM workspace_patients WHERE workspace_id = $1 AND status = 'active'",
      [workspace.id],
    );

    const visitsResult = await db.query(
      "SELECT * FROM scheduled_visits WHERE workspace_id = $1 ORDER BY scheduled_at ASC",
      [workspace.id],
    );
    const visits = visitsResult.rows;

    const vitalsResult = await db.query(
      `
      SELECT v.*, sv.scheduled_at
      FROM vitals v
      JOIN scheduled_visits sv ON sv.id = v.scheduled_visit_id
      WHERE v.workspace_id = $1
      ORDER BY sv.scheduled_at ASC
      `,
      [workspace.id],
    );
    const vitals = vitalsResult.rows;

    const avg = (arr) =>
      arr.length
        ? +(arr.reduce((sum, v) => sum + Number(v), 0) / arr.length).toFixed(1)
        : null;
    const nums = (rows, field) =>
      rows.map((r) => r[field]).filter((v) => v !== null && v !== undefined);

    // "Drug performance": compare averages pre-dosage vs post-dosage across the cohort.
    const pre = vitals.filter((v) => v.stage === "pre_dosage");
    const post = vitals.filter((v) => v.stage === "post_dosage");

    const drugPerformance = {
      preDosage: {
        avgTemperature: avg(nums(pre, "temperature")),
        avgSystolic: avg(nums(pre, "bp_systolic")),
        avgDiastolic: avg(nums(pre, "bp_diastolic")),
        avgSugar: avg(nums(pre, "sugar")),
        avgSpo2: avg(nums(pre, "spo2")),
        avgHeartRate: avg(nums(pre, "heart_rate")),
      },
      postDosage: {
        avgTemperature: avg(nums(post, "temperature")),
        avgSystolic: avg(nums(post, "bp_systolic")),
        avgDiastolic: avg(nums(post, "bp_diastolic")),
        avgSugar: avg(nums(post, "sugar")),
        avgSpo2: avg(nums(post, "spo2")),
        avgHeartRate: avg(nums(post, "heart_rate")),
      },
    };

    const trend = vitals.map((v) => ({
      date: v.scheduled_at,
      temperature: v.temperature,
      systolic: v.bp_systolic,
      diastolic: v.bp_diastolic,
      sugar: v.sugar,
      spo2: v.spo2,
      heart_rate: v.heart_rate,
      stage: v.stage,
      patient_id: v.patient_id,
    }));

    const statusBreakdown = ["scheduled", "active", "completed", "missed", "cancelled"].map(
      (status) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: visits.filter((v) => v.status === status).length,
      }),
    );

    res.json({
      workspace,
      patientCount: Number(patientCountResult.rows[0].count),
      totalVisits: visits.length,
      upcomingVisits: visits.filter((v) => v.status === "scheduled" && new Date(v.scheduled_at) > new Date()).length,
      completedVisits: visits.filter((v) => v.status === "completed").length,
      drugPerformance,
      trend,
      statusBreakdown,
    });
  } catch (error) {
    console.error("Workspace dashboard error:", error);
    res.status(500).json({ error: "Failed to load workspace dashboard" });
  }
});

app.get("/api/dashboard/patient", auth("patient"), async (req, res) => {
  try {
    const workspacesResult = await db.query(
      `
      SELECT w.*, wp.joined_at
      FROM workspace_patients wp
      JOIN workspaces w ON w.id = wp.workspace_id
      WHERE wp.patient_id = $1 AND wp.status = 'active'
      `,
      [req.user.id],
    );

    const vitalsResult = await db.query(
      `
      SELECT v.*, sv.scheduled_at, sv.workspace_id
      FROM vitals v
      JOIN scheduled_visits sv ON sv.id = v.scheduled_visit_id
      WHERE v.patient_id = $1
      ORDER BY sv.scheduled_at ASC
      `,
      [req.user.id],
    );

    const nextVisitResult = await db.query(
      `
      SELECT sv.*, w.title AS workspace_title, w.drug_name
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      WHERE sv.patient_id = $1
        AND sv.status IN ('scheduled', 'active')
        AND sv.scheduled_at >= NOW() - INTERVAL '2 hours'
      ORDER BY sv.scheduled_at ASC
      LIMIT 1
      `,
      [req.user.id],
    );

    res.json({
      workspaces: workspacesResult.rows,
      vitals: vitalsResult.rows,
      nextVisit: nextVisitResult.rows[0] || null,
    });
  } catch (error) {
    console.error("Patient dashboard error:", error);
    res.status(500).json({ error: "Failed to load patient dashboard" });
  }
});

app.get("/api/workspaces/:workspaceId/patient-summary", auth("patient"), async (req, res) => {
  try {
    const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
    if (!workspace) return;

    const enrolled = await db.query(
      "SELECT id FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2",
      [workspace.id, req.user.id],
    );
    if (enrolled.rows.length === 0) {
      return res.status(403).json({ error: "Not enrolled in this workspace" });
    }

    const visitsResult = await db.query(
      `SELECT * FROM scheduled_visits WHERE workspace_id = $1 AND patient_id = $2 ORDER BY scheduled_at ASC`,
      [workspace.id, req.user.id],
    );

    const vitalsResult = await db.query(
      `
      SELECT v.*, sv.scheduled_at
      FROM vitals v
      JOIN scheduled_visits sv ON sv.id = v.scheduled_visit_id
      WHERE v.workspace_id = $1 AND v.patient_id = $2
      ORDER BY sv.scheduled_at ASC
      `,
      [workspace.id, req.user.id],
    );

    res.json({ workspace, visits: visitsResult.rows, vitals: vitalsResult.rows });
  } catch (error) {
    console.error("Patient workspace summary error:", error);
    res.status(500).json({ error: "Failed to fetch workspace summary" });
  }
});

/*
|--------------------------------------------------------------------------
| SOCKET.IO / WEBRTC
|--------------------------------------------------------------------------
*/

io.on(
  "connection",
  (socket) => {

    console.log(
      `Socket connected: ${socket.id}`
    );

    /*
     * JOIN ROOM
     */

    socket.on(
      "room:join",
      ({
        roomCode,
        userId,
        userName,
        role,
      }) => {

        if (!roomCode) {
          return;
        }

        const roomKey =
          `room:${roomCode}`;

        socket.join(
          roomKey
        );

        socket.data = {

          roomCode,

          userId,

          userName,

          role,

        };

        socket
          .to(roomKey)
          .emit(
            "peer:joined",
            {
              userId,

              userName,

              role,

              socketId:
                socket.id,
            }
          );
      }
    );

    /*
     * WEBRTC OFFER
     */

    socket.on(
      "webrtc:offer",
      ({
        roomCode,
        offer,
        to,
      }) => {

        if (
          !to ||
          !offer
        ) {
          return;
        }

        io.to(to).emit(
          "webrtc:offer",
          {

            offer,

            from:
              socket.id,

            userName:
              socket.data
                ?.userName,

          }
        );
      }
    );

    /*
     * WEBRTC ANSWER
     */

    socket.on(
      "webrtc:answer",
      ({
        answer,
        to,
      }) => {

        if (
          !to ||
          !answer
        ) {
          return;
        }

        io.to(to).emit(
          "webrtc:answer",
          {

            answer,

            from:
              socket.id,

          }
        );
      }
    );

    /*
     * ICE CANDIDATE
     */

    socket.on(
      "webrtc:ice-candidate",
      ({
        candidate,
        to,
      }) => {

        if (
          !to ||
          !candidate
        ) {
          return;
        }

        io.to(to).emit(
          "webrtc:ice-candidate",
          {

            candidate,

            from:
              socket.id,

          }
        );
      }
    );

    /*
     * LEAVE ROOM
     */

    socket.on(
      "room:leave",
      ({
        roomCode,
      }) => {

        if (!roomCode) {
          return;
        }

        const roomKey =
          `room:${roomCode}`;

        socket.leave(
          roomKey
        );

        socket
          .to(roomKey)
          .emit(
            "peer:left",
            {
              socketId:
                socket.id,
            }
          );
      }
    );

    /*
     * DISCONNECT
     */

    socket.on(
      "disconnect",
      () => {

        console.log(
          `Socket disconnected: ${socket.id}`
        );

        if (
          socket.data
            ?.roomCode
        ) {

          socket
            .to(
              `room:${socket.data.roomCode}`
            )
            .emit(
              "peer:left",
              {
                socketId:
                  socket.id,
              }
            );

        }
      }
    );

  }
);

/*
|--------------------------------------------------------------------------
| API 404 HANDLER
|--------------------------------------------------------------------------
|
| This is useful because if frontend calls
| an API endpoint that doesn't exist, you'll
| see the actual API error instead of the
| production React fallback.
|
|--------------------------------------------------------------------------
*/

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({
      error:
        `API route not found: ${req.method} ${req.originalUrl}`,
    });

  }
);

/*
|--------------------------------------------------------------------------
| SERVE CLIENT IN PRODUCTION
|--------------------------------------------------------------------------
*/

const clientDist =
  path.join(
    __dirname,
    "..",
    "client",
    "dist"
  );

app.use(
  express.static(
    clientDist
  )
);

/*
|--------------------------------------------------------------------------
| REACT ROUTER FALLBACK
|--------------------------------------------------------------------------
*/

app.get(
  "*",
  (req, res, next) => {

    if (
      req.path.startsWith(
        "/api"
      )
    ) {

      return next();

    }

    const indexFile =
      path.join(
        clientDist,
        "index.html"
      );

    res.sendFile(
      indexFile,
      (error) => {

        if (error) {

          console.error(
            "Client build not found:",
            error.message
          );

          res.status(404).send(
            `
            <h2>CareThread server is running.</h2>
            <p>Client build was not found.</p>
            <p>Run <b>npm run build</b> inside the client folder.</p>
            `
          );

        }

      }
    );

  }
);

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

server.listen(
  PORT,
  () => {

    console.log(
      `CareThread server running on port ${PORT}`
    );

    console.log(
      `API: http://localhost:${PORT}/api/health`
    );

  }
);