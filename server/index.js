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
const groqClient = require("./ai/groqClient");
const handoffAgent = require("./ai/handoffAgent");
const anomalyAgent = require("./ai/anomalyAgent");
const checklistAgent = require("./ai/checklistAgent");
const intakeAgent = require("./ai/intakeAgent");
const emailClient = require("./notifications/emailClient");
const visitScheduledEmail = require("./notifications/visitScheduledEmail");
const { streamVisitReport } = require("./reports/visitReportPdf");
const chatAgent = require("./ai/chatAgent");
const visitAlertingJob = require("./jobs/visitAlerting");

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

const crypto = require("crypto");

// If JWT_SECRET isn't pinned in .env, generate a fresh random one on every
// boot. This is deliberate: it means restarting the server invalidates every
// previously-issued token, logging everyone out — which is what you want
// during dev/demo. If you ever want sessions to survive a restart, set a
// fixed JWT_SECRET in server/.env instead.
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
if (!process.env.JWT_SECRET) {
  console.log(
    "[auth] No JWT_SECRET set in .env — using a fresh random secret for this run, so all sessions will be invalidated on restart.",
  );
}

const PORT = process.env.PORT || 4000;

// Used to build absolute links (e.g. the "join your visit" link in emails).
// Set APP_URL in server/.env once you have a real deployed URL; falls back
// to localhost for local dev.
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;

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
    } catch (error) {
      console.error("Authentication error:", error.message);

      return res.status(401).json({
        error: "Invalid or expired token",
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
  if (!user) {
    return null;
  }

  const { password_hash, ...rest } = user;

  return rest;
}

/*
|--------------------------------------------------------------------------
| HEALTH CHECK
|--------------------------------------------------------------------------
*/

app.get("/api/health", async (req, res) => {
  try {
    const result = await db.query("SELECT NOW() AS now");

    res.json({
      ok: true,
      database: "connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(500).json({
      ok: false,
      database: "disconnected",
      error: error.message,
    });
  }
});

/*
|--------------------------------------------------------------------------
| SIGNUP
|--------------------------------------------------------------------------
*/

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

    const existing = await db.query(
      `
          SELECT id
          FROM users
          WHERE email = $1
          `,
      [normalizedEmail],
    );

    if (existing.rows.length > 0) {
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
        medical_conditions || null,
        specialization || null,
      ],
    );

    const result = await db.query(
      `
          SELECT *
          FROM users
          WHERE id = $1
          `,
      [id],
    );

    const user = result.rows[0];

    const token = signToken(user);

    res.json({
      token,
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Signup error:", error);

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

/*
|--------------------------------------------------------------------------
| LOGIN
|--------------------------------------------------------------------------
*/

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Email and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const result = await db.query(
      `
          SELECT *
          FROM users
          WHERE email = $1
          `,
      [normalizedEmail],
    );

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

/*
|--------------------------------------------------------------------------
| CURRENT USER
|--------------------------------------------------------------------------
*/

app.get("/api/auth/me", auth(), async (req, res) => {
  try {
    const result = await db.query(
      `
          SELECT *
          FROM users
          WHERE id = $1
          `,
      [req.user.id],
    );

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

/*
|--------------------------------------------------------------------------
| UPDATE PROFILE
|--------------------------------------------------------------------------
*/

app.put("/api/auth/me", auth(), async (req, res) => {
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
});

/*
|--------------------------------------------------------------------------
| CHANGE PASSWORD
|--------------------------------------------------------------------------
*/

app.put("/api/auth/password", auth(), async (req, res) => {
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
});

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
      [
        id,
        req.user.id,
        drug_name.trim(),
        title.trim(),
        description?.trim() || null,
        code,
      ],
    );

    const result = await db.query("SELECT * FROM workspaces WHERE id = $1", [
      id,
    ]);
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
  const result = await db.query("SELECT * FROM workspaces WHERE id = $1", [
    workspaceId,
  ]);
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
        return res
          .status(403)
          .json({ error: "Not enrolled in this workspace" });
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

    const { title, description, status, drug_name } = req.body;
    const validStatuses = ["active", "completed", "archived"];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    if (drug_name !== undefined && !drug_name.trim()) {
      return res.status(400).json({ error: "Drug name can't be empty" });
    }

    const result = await db.query(
      `
      UPDATE workspaces
      SET title = $1, description = $2, status = $3, drug_name = $4
      WHERE id = $5
      RETURNING *
      `,
      [
        title?.trim() || workspace.title,
        description !== undefined ? description : workspace.description,
        status || workspace.status,
        drug_name !== undefined ? drug_name.trim() : workspace.drug_name,
        workspace.id,
      ],
    );

    res.json({ workspace: result.rows[0] });
  } catch (error) {
    console.error("Update workspace error:", error);
    res.status(500).json({ error: "Failed to update workspace" });
  }
});

// Fully deletes a workspace and everything tied to it — patient
// enrollments, scheduled visits, vitals, visit requests, transcripts,
// calendar events, notification log entries. Done inside a transaction so
// it either all goes or none of it does; children are removed before
// parents to satisfy foreign keys. This is genuinely destructive and
// unrecoverable — the client should confirm with the doctor before
// calling this.
app.delete("/api/workspaces/:workspaceId", auth("doctor"), async (req, res) => {
  const client = await db.connect();
  try {
    const workspaceResult = await client.query(
      "SELECT * FROM workspaces WHERE id = $1",
      [req.params.workspaceId],
    );
    const workspace = workspaceResult.rows[0];
    if (!workspace)
      return res.status(404).json({ error: "Workspace not found" });
    if (workspace.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your workspace" });
    }

    await client.query("BEGIN");
    await client.query(
      `DELETE FROM notification_log WHERE scheduled_visit_id IN (SELECT id FROM scheduled_visits WHERE workspace_id = $1)`,
      [workspace.id],
    );
    await client.query(
      `DELETE FROM calendar_events WHERE scheduled_visit_id IN (SELECT id FROM scheduled_visits WHERE workspace_id = $1)`,
      [workspace.id],
    );
    await client.query(
      `DELETE FROM visit_transcript_chunks WHERE scheduled_visit_id IN (SELECT id FROM scheduled_visits WHERE workspace_id = $1)`,
      [workspace.id],
    );
    await client.query(`DELETE FROM vitals WHERE workspace_id = $1`, [
      workspace.id,
    ]);
    await client.query(`DELETE FROM visit_requests WHERE workspace_id = $1`, [
      workspace.id,
    ]);
    await client.query(`DELETE FROM scheduled_visits WHERE workspace_id = $1`, [
      workspace.id,
    ]);
    await client.query(
      `DELETE FROM workspace_patients WHERE workspace_id = $1`,
      [workspace.id],
    );
    await client.query(`DELETE FROM workspaces WHERE id = $1`, [workspace.id]);
    await client.query("COMMIT");

    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Delete workspace error:", error);
    res.status(500).json({ error: "Failed to delete workspace" });
  } finally {
    client.release();
  }
});

// Manual checklist editing — the doctor can hand-author or tweak the
// pre/post-dosage/general checklist items directly, independent of the
// AI-from-protocol-text generator above. Accepts the same shape the
// generator produces: { pre_dosage: string[], post_dosage: string[],
// general: string[] }.
app.put(
  "/api/workspaces/:workspaceId/checklist",
  auth("doctor"),
  async (req, res) => {
    try {
      const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
      if (!workspace) return;
      if (workspace.doctor_id !== req.user.id) {
        return res.status(403).json({ error: "Not your workspace" });
      }

      const { checklist } = req.body;
      if (!checklist || typeof checklist !== "object") {
        return res.status(400).json({ error: "checklist object is required" });
      }
      const stages = ["pre_dosage", "post_dosage", "general"];
      const cleaned = {};
      for (const stage of stages) {
        const items = Array.isArray(checklist[stage]) ? checklist[stage] : [];
        cleaned[stage] = items
          .map((item) => String(item).trim())
          .filter(Boolean);
      }

      const result = await db.query(
        `UPDATE workspaces SET checklist = $1 WHERE id = $2 RETURNING *`,
        [JSON.stringify(cleaned), workspace.id],
      );

      res.json({ workspace: result.rows[0] });
    } catch (error) {
      console.error("Update checklist error:", error);
      res.status(500).json({ error: "Failed to update checklist" });
    }
  },
);

// ---------- Enrollment ----------

app.post("/api/workspaces/join", auth("patient"), async (req, res) => {
  try {
    const code = (req.body.code || "").toUpperCase().trim();
    if (!code) {
      return res.status(400).json({ error: "Workspace code is required" });
    }

    const workspaceResult = await db.query(
      "SELECT * FROM workspaces WHERE code = $1",
      [code],
    );
    const workspace = workspaceResult.rows[0];
    if (!workspace) {
      return res.status(404).json({ error: "Invalid workspace code" });
    }
    if (workspace.status !== "active") {
      return res
        .status(409)
        .json({ error: "This workspace is no longer accepting patients" });
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

app.get(
  "/api/workspaces/:workspaceId/patients",
  auth("doctor"),
  async (req, res) => {
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
  },
);

// Removes a patient from a workspace. Kept as a soft "withdrawn" status
// rather than deleting the enrollment row outright, so visit history and
// vitals for that patient stay intact and queryable — only their access
// and any future visits go away. Any of their still-upcoming visits in
// this workspace are cancelled at the same time so they don't end up
// with a dangling scheduled call to a trial they're no longer part of.
app.delete(
  "/api/workspaces/:workspaceId/patients/:patientId",
  auth("doctor"),
  async (req, res) => {
    try {
      const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
      if (!workspace) return;
      if (workspace.doctor_id !== req.user.id) {
        return res.status(403).json({ error: "Not your workspace" });
      }

      const enrollment = await db.query(
        "SELECT * FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2",
        [workspace.id, req.params.patientId],
      );
      if (enrollment.rows.length === 0) {
        return res
          .status(404)
          .json({ error: "Patient is not enrolled in this workspace" });
      }

      await db.query(
        "UPDATE workspace_patients SET status = 'withdrawn' WHERE workspace_id = $1 AND patient_id = $2",
        [workspace.id, req.params.patientId],
      );
      await db.query(
        `
        UPDATE scheduled_visits SET status = 'cancelled'
        WHERE workspace_id = $1 AND patient_id = $2 AND status IN ('scheduled', 'active')
        `,
        [workspace.id, req.params.patientId],
      );

      res.json({ ok: true });
    } catch (error) {
      console.error("Remove patient error:", error);
      res.status(500).json({ error: "Failed to remove patient" });
    }
  },
);

// ============================================================
// SCHEDULED VISIT ROUTES
// ============================================================

app.post(
  "/api/workspaces/:workspaceId/visits",
  auth("doctor"),
  async (req, res) => {
    try {
      const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
      if (!workspace) return;
      if (workspace.doctor_id !== req.user.id) {
        return res.status(403).json({ error: "Not your workspace" });
      }

      const { patient_id, scheduled_at, title } = req.body;
      if (!patient_id || !scheduled_at) {
        return res
          .status(400)
          .json({ error: "Patient and scheduled time are required" });
      }

      const enrolled = await db.query(
        "SELECT id FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2 AND status = 'active'",
        [workspace.id, patient_id],
      );
      if (enrolled.rows.length === 0) {
        return res
          .status(400)
          .json({ error: "Patient is not enrolled in this workspace" });
      }

      const id = uuidv4();
      const roomCode = await genUniqueCode("scheduled_visits", "room_code");

      await db.query(
        `
      INSERT INTO scheduled_visits (id, workspace_id, patient_id, doctor_id, room_code, title, scheduled_at, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled')
      `,
        [
          id,
          workspace.id,
          patient_id,
          req.user.id,
          roomCode,
          title?.trim() || null,
          scheduled_at,
        ],
      );

      const result = await db.query(
        "SELECT * FROM scheduled_visits WHERE id = $1",
        [id],
      );
      const visit = result.rows[0];

      // Best-effort: never blocks or fails the scheduling response even if
      // email sending has trouble — errors are caught and logged only.
      try {
        const peopleResult = await db.query(
          "SELECT id, name, email FROM users WHERE id = ANY($1::text[])",
          [[req.user.id, patient_id]],
        );
        const doctor = peopleResult.rows.find((u) => u.id === req.user.id);
        const patient = peopleResult.rows.find((u) => u.id === patient_id);
        await visitScheduledEmail.sendVisitScheduledEmails({
          visit,
          workspaceTitle: workspace.title,
          drugName: workspace.drug_name,
          doctor,
          patient,
          senderRole: "doctor",
          appUrl: APP_URL,
        });
      } catch (emailError) {
        console.warn("Visit-scheduled email skipped:", emailError.message);
      }

      res.json({ visit });
    } catch (error) {
      console.error("Schedule visit error:", error);
      res.status(500).json({ error: "Failed to schedule visit" });
    }
  },
);

app.get(
  "/api/workspaces/:workspaceId/visits",
  auth("doctor"),
  async (req, res) => {
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
  },
);

app.put("/api/visits/:visitId", auth("doctor"), async (req, res) => {
  try {
    const existing = await db.query(
      "SELECT * FROM scheduled_visits WHERE id = $1",
      [req.params.visitId],
    );
    const visit = existing.rows[0];
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    if (visit.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    const { scheduled_at, title, status } = req.body;
    const validStatuses = [
      "scheduled",
      "active",
      "completed",
      "missed",
      "cancelled",
    ];
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
      SELECT sv.*, w.title AS workspace_title, w.drug_name, w.checklist, d.name AS doctor_name, p.name AS patient_name
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

app.post(
  "/api/visits/by-code/:code/complete",
  auth("doctor"),
  async (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const result = await db.query(
        `
      SELECT sv.*, w.title AS workspace_title, w.drug_name, w.checklist
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      WHERE sv.room_code = $1
      `,
        [code],
      );
      const visit = result.rows[0];
      if (!visit || visit.doctor_id !== req.user.id) {
        return res.status(404).json({ error: "Visit not found" });
      }

      // Checklist enforcement: if this workspace has a protocol checklist,
      // every required item must be confirmed before the visit can be
      // marked complete — unless the doctor explicitly overrides, which
      // is logged as a protocol deviation rather than silently allowed.
      const hasChecklist =
        visit.checklist &&
        (visit.checklist.pre_dosage?.length ||
          visit.checklist.post_dosage?.length ||
          visit.checklist.general?.length);

      if (hasChecklist && !req.body.override) {
        const incomplete = checklistAgent.getIncompleteItems(
          visit.checklist,
          visit.checklist_progress,
        );
        if (incomplete.length > 0) {
          return res.status(409).json({
            error: "Checklist incomplete",
            incomplete,
            hint: 'Complete these items, or retry with { "override": true, "overrideReason": "..." } to log a deviation and complete anyway.',
          });
        }
      }

      if (
        hasChecklist &&
        req.body.override &&
        !req.body.overrideReason?.trim()
      ) {
        return res.status(400).json({
          error: "An override reason is required to log this deviation",
        });
      }

      let checklistProgress = visit.checklist_progress || {};
      if (hasChecklist && req.body.override) {
        checklistProgress = {
          ...checklistProgress,
          _override_reason: req.body.overrideReason.trim(),
          _overridden_at: new Date().toISOString(),
        };
      }

      // Generate the after-visit summary before marking complete, so the
      // patient has it the moment the visit closes. Never blocks completion
      // if the AI call fails (e.g. no GROQ_API_KEY set) — the visit still
      // completes, just without a summary.
      let summary = null;
      try {
        const vitalsResult = await db.query(
          `SELECT * FROM vitals WHERE scheduled_visit_id = $1 ORDER BY stage ASC`,
          [visit.id],
        );
        summary = await handoffAgent.generateVisitSummary({
          workspaceTitle: visit.workspace_title,
          drugName: visit.drug_name,
          vitalsRows: vitalsResult.rows,
        });
      } catch (aiError) {
        console.warn("Visit summary generation skipped:", aiError.message);
      }

      await db.query(
        `
      UPDATE scheduled_visits
      SET status = 'completed', completed_at = NOW(), ai_summary = $1, ai_summary_generated_at = $2, checklist_progress = $3
      WHERE id = $4
      `,
        [
          summary,
          summary ? new Date().toISOString() : null,
          JSON.stringify(checklistProgress),
          visit.id,
        ],
      );

      io.to(`room:${code}`).emit("room:completed", { summary });
      res.json({ ok: true, summary });
    } catch (error) {
      console.error("Complete visit error:", error);
      res.status(500).json({ error: "Failed to complete visit" });
    }
  },
);

// ============================================================
// CHECKLIST ROUTES (Feature 2: Live Visit Checklist Agent)
// ============================================================

app.put(
  "/api/workspaces/:workspaceId/protocol",
  auth("doctor"),
  async (req, res) => {
    try {
      const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
      if (!workspace) return;
      if (workspace.doctor_id !== req.user.id) {
        return res.status(403).json({ error: "Not your workspace" });
      }

      const { protocol_text } = req.body;
      if (!protocol_text || !protocol_text.trim()) {
        return res.status(400).json({ error: "Protocol text is required" });
      }

      let checklist;
      try {
        checklist = await checklistAgent.generateChecklist(protocol_text);
      } catch (aiError) {
        console.error("Checklist generation failed:", aiError.message);
        return res.status(502).json({
          error: "Couldn't generate a checklist from this protocol",
          detail: aiError.message,
        });
      }

      const result = await db.query(
        `UPDATE workspaces SET protocol_text = $1, checklist = $2 WHERE id = $3 RETURNING *`,
        [protocol_text, JSON.stringify(checklist), workspace.id],
      );

      res.json({ workspace: result.rows[0] });
    } catch (error) {
      console.error("Set protocol error:", error);
      res.status(500).json({ error: "Failed to set protocol" });
    }
  },
);

app.put("/api/visits/:visitId/checklist", auth("doctor"), async (req, res) => {
  try {
    const { stage, item, checked } = req.body;
    if (!stage || !item || typeof checked !== "boolean") {
      return res
        .status(400)
        .json({ error: "stage, item, and checked are required" });
    }

    const existing = await db.query(
      "SELECT * FROM scheduled_visits WHERE id = $1",
      [req.params.visitId],
    );
    const visit = existing.rows[0];
    if (!visit) return res.status(404).json({ error: "Visit not found" });
    if (visit.doctor_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    const progress = visit.checklist_progress || {};
    const updatedProgress = {
      ...progress,
      [stage]: { ...(progress[stage] || {}), [item]: checked },
    };

    const result = await db.query(
      `UPDATE scheduled_visits SET checklist_progress = $1 WHERE id = $2 RETURNING *`,
      [JSON.stringify(updatedProgress), visit.id],
    );

    io.to(`room:${visit.room_code}`).emit("checklist:updated", {
      progress: updatedProgress,
    });
    res.json({ visit: result.rows[0] });
  } catch (error) {
    console.error("Update checklist progress error:", error);
    res.status(500).json({ error: "Failed to update checklist" });
  }
});

// ============================================================
// VISIT REQUEST ROUTES (Feature 1: Intake / urgency triage)
// ============================================================

app.post(
  "/api/workspaces/:workspaceId/visit-requests",
  auth("patient"),
  async (req, res) => {
    try {
      const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
      if (!workspace) return;

      const enrolled = await db.query(
        "SELECT id FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2",
        [workspace.id, req.user.id],
      );
      if (enrolled.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Not enrolled in this workspace" });
      }

      const { concern_text } = req.body;
      if (!concern_text || !concern_text.trim()) {
        return res.status(400).json({ error: "Please describe your concern" });
      }

      let classification = {
        urgency: "unclear",
        reasoning: "AI triage unavailable",
        confidence: 0,
      };
      try {
        classification = await intakeAgent.classifyConcern(concern_text);
      } catch (aiError) {
        console.warn("Intake classification skipped:", aiError.message);
      }

      const id = uuidv4();
      await db.query(
        `
      INSERT INTO visit_requests (id, workspace_id, patient_id, concern_text, urgency, urgency_reasoning, status)
      VALUES ($1,$2,$3,$4,$5,$6,'pending')
      `,
        [
          id,
          workspace.id,
          req.user.id,
          concern_text,
          classification.urgency,
          classification.reasoning,
        ],
      );

      // Best-effort email to the doctor for high-urgency requests. Falls
      // back to a console/audit-log entry if email isn't configured.
      if (classification.urgency === "high") {
        const doctorResult = await db.query(
          "SELECT email, name FROM users WHERE id = $1",
          [workspace.doctor_id],
        );
        const doctor = doctorResult.rows[0];
        await emailClient.sendEmail({
          toEmail: doctor?.email,
          subject: `High-urgency patient message — ${workspace.title}`,
          message: `Hi ${doctor?.name || "Doctor"},\n\nA patient submitted a high-urgency concern in ${workspace.title}:\n\n"${concern_text}"\n\nPlease review it in your CareThread dashboard.\n\n— CareThread`,
          kind: "urgent_intake",
          recipientUserId: workspace.doctor_id,
        });
      }

      const result = await db.query(
        "SELECT * FROM visit_requests WHERE id = $1",
        [id],
      );
      res.json({ request: result.rows[0] });
    } catch (error) {
      console.error("Create visit request error:", error);
      res.status(500).json({ error: "Failed to submit your concern" });
    }
  },
);

app.get(
  "/api/workspaces/:workspaceId/visit-requests",
  auth("doctor"),
  async (req, res) => {
    try {
      const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
      if (!workspace) return;
      if (workspace.doctor_id !== req.user.id) {
        return res.status(403).json({ error: "Not your workspace" });
      }

      const result = await db.query(
        `
      SELECT vr.*, u.name AS patient_name
      FROM visit_requests vr
      JOIN users u ON u.id = vr.patient_id
      WHERE vr.workspace_id = $1
      ORDER BY
        CASE vr.urgency WHEN 'high' THEN 0 WHEN 'medium' THEN 1 WHEN 'unclear' THEN 2 ELSE 3 END,
        vr.created_at DESC
      `,
        [workspace.id],
      );

      res.json({ requests: result.rows });
    } catch (error) {
      console.error("List visit requests error:", error);
      res.status(500).json({ error: "Failed to fetch requests" });
    }
  },
);

app.post(
  "/api/visit-requests/:requestId/schedule",
  auth("doctor"),
  async (req, res) => {
    try {
      const { scheduled_at, title } = req.body;
      if (!scheduled_at)
        return res.status(400).json({ error: "scheduled_at is required" });

      const reqResult = await db.query(
        "SELECT * FROM visit_requests WHERE id = $1",
        [req.params.requestId],
      );
      const visitRequest = reqResult.rows[0];
      if (!visitRequest)
        return res.status(404).json({ error: "Request not found" });

      const workspace = await getWorkspaceOr404(visitRequest.workspace_id, res);
      if (!workspace) return;
      if (workspace.doctor_id !== req.user.id) {
        return res.status(403).json({ error: "Not your workspace" });
      }

      const id = uuidv4();
      const roomCode = await genUniqueCode("scheduled_visits", "room_code");
      await db.query(
        `
      INSERT INTO scheduled_visits (id, workspace_id, patient_id, doctor_id, room_code, title, scheduled_at, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'scheduled')
      `,
        [
          id,
          workspace.id,
          visitRequest.patient_id,
          req.user.id,
          roomCode,
          title?.trim() || "Requested visit",
          scheduled_at,
        ],
      );

      await db.query(
        `UPDATE visit_requests SET status = 'scheduled', resulting_visit_id = $1 WHERE id = $2`,
        [id, visitRequest.id],
      );

      const result = await db.query(
        "SELECT * FROM scheduled_visits WHERE id = $1",
        [id],
      );
      const visit = result.rows[0];

      try {
        const peopleResult = await db.query(
          "SELECT id, name, email FROM users WHERE id = ANY($1::text[])",
          [[req.user.id, visitRequest.patient_id]],
        );
        const doctor = peopleResult.rows.find((u) => u.id === req.user.id);
        const patient = peopleResult.rows.find(
          (u) => u.id === visitRequest.patient_id,
        );
        await visitScheduledEmail.sendVisitScheduledEmails({
          visit,
          workspaceTitle: workspace.title,
          drugName: workspace.drug_name,
          doctor,
          patient,
          senderRole: "doctor",
          appUrl: APP_URL,
        });
      } catch (emailError) {
        console.warn("Visit-scheduled email skipped:", emailError.message);
      }

      res.json({ visit });
    } catch (error) {
      console.error("Schedule from visit request error:", error);
      res.status(500).json({ error: "Failed to schedule visit" });
    }
  },
);

app.post(
  "/api/visit-requests/:requestId/dismiss",
  auth("doctor"),
  async (req, res) => {
    try {
      const reqResult = await db.query(
        "SELECT * FROM visit_requests WHERE id = $1",
        [req.params.requestId],
      );
      const visitRequest = reqResult.rows[0];
      if (!visitRequest)
        return res.status(404).json({ error: "Request not found" });

      const workspace = await getWorkspaceOr404(visitRequest.workspace_id, res);
      if (!workspace) return;
      if (workspace.doctor_id !== req.user.id) {
        return res.status(403).json({ error: "Not your workspace" });
      }

      await db.query(
        `UPDATE visit_requests SET status = 'dismissed' WHERE id = $1`,
        [visitRequest.id],
      );
      res.json({ ok: true });
    } catch (error) {
      console.error("Dismiss visit request error:", error);
      res.status(500).json({ error: "Failed to dismiss request" });
    }
  },
);

// ============================================================
// VITALS ROUTES (split: patient submits readings, doctor submits dosage/notes)
// ============================================================

async function getVisitOr404(scheduledVisitId, res) {
  const result = await db.query(
    "SELECT * FROM scheduled_visits WHERE id = $1",
    [scheduledVisitId],
  );
  const visit = result.rows[0];
  if (!visit) {
    res.status(404).json({ error: "Visit not found" });
    return null;
  }
  return visit;
}

// ============================================================
// VISIT REPORT (downloadable PDF, doctor or patient of the visit)
// ============================================================

app.get("/api/visits/:visitId/report", auth(), async (req, res) => {
  try {
    const result = await db.query(
      `
      SELECT sv.*, w.title AS workspace_title, w.drug_name,
        doc.name AS doctor_name, pat.name AS patient_name
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      JOIN users doc ON doc.id = sv.doctor_id
      JOIN users pat ON pat.id = sv.patient_id
      WHERE sv.id = $1
      `,
      [req.params.visitId],
    );
    const visit = result.rows[0];
    if (!visit) return res.status(404).json({ error: "Visit not found" });

    if (req.user.id !== visit.doctor_id && req.user.id !== visit.patient_id) {
      return res.status(403).json({ error: "Not your visit" });
    }
    if (visit.status !== "completed") {
      return res
        .status(400)
        .json({
          error: "The report is available once this visit is completed",
        });
    }

    const vitalsResult = await db.query(
      `SELECT * FROM vitals WHERE scheduled_visit_id = $1 ORDER BY stage ASC`,
      [visit.id],
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="carethread-visit-${visit.room_code}.pdf"`,
    );

    streamVisitReport(res, {
      workspaceTitle: visit.workspace_title,
      drugName: visit.drug_name,
      visitTitle: visit.title || "Trial Visit",
      scheduledAt: visit.scheduled_at,
      completedAt: visit.completed_at,
      roomCode: visit.room_code,
      doctorName: visit.doctor_name,
      patientName: visit.patient_name,
      vitalsRows: vitalsResult.rows,
      aiSummary: visit.ai_summary,
    });
  } catch (error) {
    console.error("Visit report error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate report" });
    }
  }
});

// ============================================================
// CHAT AGENT — a chat interface that can perform real tasks (schedule
// visits, submit concerns, look things up) via tool-calling. Stateless
// server-side: the client sends the full conversation each turn, nothing
// is persisted, so there's no history across sessions by design.
// ============================================================

app.post("/api/agent/chat", auth(), async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages array is required" });
    }
    const trimmed = messages
      .slice(-20) // cap context sent per turn
      .filter(
        (m) =>
          m &&
          typeof m.content === "string" &&
          ["user", "assistant"].includes(m.role),
      )
      .map((m) => ({ role: m.role, content: m.content }));

    const { reply, actions } = await chatAgent.runChat(trimmed, {
      id: req.user.id,
      role: req.user.role,
    });
    res.json({ reply, actions });
  } catch (error) {
    console.error("Chat agent error:", error);
    res
      .status(500)
      .json({
        error: error.message?.includes("GROQ_API_KEY")
          ? error.message
          : "The assistant hit a problem — try again.",
      });
  }
});

const VALID_STAGES = ["pre_dosage", "post_dosage", "general"];

app.put("/api/vitals/patient", auth("patient"), async (req, res) => {
  try {
    const {
      scheduled_visit_id,
      stage,
      temperature,
      bp_systolic,
      bp_diastolic,
      sugar,
      spo2,
      heart_rate,
    } = req.body;

    if (!scheduled_visit_id || !stage) {
      return res.status(400).json({ error: "Visit and stage are required" });
    }
    if (!VALID_STAGES.includes(stage)) {
      return res.status(400).json({ error: "Invalid stage" });
    }
    const hasAnyReading = [
      temperature,
      bp_systolic,
      bp_diastolic,
      sugar,
      spo2,
      heart_rate,
    ].some((v) => v !== null && v !== undefined && v !== "");
    if (!hasAnyReading) {
      return res
        .status(400)
        .json({ error: "At least one reading is required" });
    }

    const visit = await getVisitOr404(scheduled_visit_id, res);
    if (!visit) return;
    if (visit.patient_id !== req.user.id) {
      return res.status(403).json({ error: "Not your visit" });
    }

    const id = uuidv4();

    // Anomaly Detection Agent: check this reading against the patient's
    // own history in this workspace before it's finalized. Never blocks
    // the save — a flag is informational for the doctor, not a gate.
    let anomalyFlags = [];
    try {
      anomalyFlags = await anomalyAgent.checkVitalsSubmission({
        patientId: visit.patient_id,
        workspaceId: visit.workspace_id,
        currentVisitId: visit.id,
        reading: {
          temperature,
          bp_systolic,
          bp_diastolic,
          sugar,
          spo2,
          heart_rate,
        },
      });
    } catch (anomalyError) {
      console.warn("Anomaly check skipped:", anomalyError.message);
    }

    const result = await db.query(
      `
      INSERT INTO vitals (
        id, scheduled_visit_id, workspace_id, patient_id, doctor_id, stage,
        temperature, bp_systolic, bp_diastolic, sugar, spo2, heart_rate, patient_submitted_at,
        anomaly_flags
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, NOW(), $13)
      ON CONFLICT (scheduled_visit_id, stage) DO UPDATE SET
        temperature = EXCLUDED.temperature,
        bp_systolic = EXCLUDED.bp_systolic,
        bp_diastolic = EXCLUDED.bp_diastolic,
        sugar = EXCLUDED.sugar,
        spo2 = EXCLUDED.spo2,
        heart_rate = EXCLUDED.heart_rate,
        patient_submitted_at = NOW(),
        anomaly_flags = EXCLUDED.anomaly_flags
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
        JSON.stringify(anomalyFlags),
      ],
    );

    const entry = result.rows[0];
    io.to(`room:${visit.room_code}`).emit("vitals:new", entry);
    res.json({ vitals: entry, anomalyFlags });
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
    if (!dosage_given?.trim() && !doctor_notes?.trim()) {
      return res.status(400).json({ error: "Dosage or notes are required" });
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

app.get(
  "/api/workspaces/:workspaceId/dashboard",
  auth("doctor"),
  async (req, res) => {
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
          ? +(arr.reduce((sum, v) => sum + Number(v), 0) / arr.length).toFixed(
              1,
            )
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

      const statusBreakdown = [
        "scheduled",
        "active",
        "completed",
        "missed",
        "cancelled",
      ].map((status) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: visits.filter((v) => v.status === status).length,
      }));

      res.json({
        workspace,
        patientCount: Number(patientCountResult.rows[0].count),
        totalVisits: visits.length,
        upcomingVisits: visits.filter(
          (v) =>
            v.status === "scheduled" && new Date(v.scheduled_at) > new Date(),
        ).length,
        completedVisits: visits.filter((v) => v.status === "completed").length,
        drugPerformance,
        trend,
        statusBreakdown,
      });
    } catch (error) {
      console.error("Workspace dashboard error:", error);
      res.status(500).json({ error: "Failed to load workspace dashboard" });
    }
  },
);

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
/*
|--------------------------------------------------------------------------
| PATIENT ANALYTICS DASHBOARD
|--------------------------------------------------------------------------
*/

app.get("/api/dashboard/patient/analytics", auth("patient"), async (req, res) => {
  try {
    const visitsResult = await db.query(
      `
      SELECT sv.*, w.title AS workspace_title, w.drug_name, w.status AS workspace_status, d.name AS doctor_name
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      JOIN users d ON d.id = sv.doctor_id
      WHERE sv.patient_id = $1
      ORDER BY sv.scheduled_at ASC
      `,
      [req.user.id],
    );
    const visits = visitsResult.rows;

    const vitalsResult = await db.query(
      `
      SELECT v.*, sv.scheduled_at, w.title AS workspace_title, w.drug_name
      FROM vitals v
      JOIN scheduled_visits sv ON sv.id = v.scheduled_visit_id
      JOIN workspaces w ON w.id = v.workspace_id
      WHERE v.patient_id = $1
      ORDER BY sv.scheduled_at ASC
      `,
      [req.user.id],
    );
    const vitals = vitalsResult.rows;

    const medsResult = await db.query(
      `
      SELECT DISTINCT ON (w.id)
        w.id AS workspace_id, w.title AS workspace_title, w.drug_name, w.status AS workspace_status,
        v.dosage_given, v.doctor_notes, v.doctor_submitted_at
      FROM workspace_patients wp
      JOIN workspaces w ON w.id = wp.workspace_id
      LEFT JOIN vitals v ON v.workspace_id = w.id AND v.patient_id = wp.patient_id AND v.dosage_given IS NOT NULL
      WHERE wp.patient_id = $1 AND wp.status = 'active'
      ORDER BY w.id, v.doctor_submitted_at DESC NULLS LAST
      `,
      [req.user.id],
    );

    const historyResult = await db.query(
      `
      SELECT sv.id, sv.title, sv.scheduled_at, sv.completed_at, sv.ai_summary,
             w.title AS workspace_title, w.drug_name, d.name AS doctor_name,
             (
               SELECT v.doctor_notes FROM vitals v
               WHERE v.scheduled_visit_id = sv.id AND v.doctor_notes IS NOT NULL
               ORDER BY v.doctor_submitted_at DESC LIMIT 1
             ) AS doctor_notes,
             (
               SELECT v.dosage_given FROM vitals v
               WHERE v.scheduled_visit_id = sv.id AND v.dosage_given IS NOT NULL
               ORDER BY v.doctor_submitted_at DESC LIMIT 1
             ) AS dosage_given
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      JOIN users d ON d.id = sv.doctor_id
      WHERE sv.patient_id = $1 AND sv.status = 'completed'
      ORDER BY sv.completed_at DESC
      `,
      [req.user.id],
    );

    const now = new Date();
    const totalAppointments = visits.length;
    const upcomingAppointments = visits.filter(
      (v) => ["scheduled", "active"].includes(v.status) && new Date(v.scheduled_at) > now,
    ).length;
    const completedAppointments = visits.filter((v) => v.status === "completed").length;
    const cancelledAppointments = visits.filter((v) => v.status === "cancelled").length;
    const missedAppointments = visits.filter((v) => v.status === "missed").length;

    const apptMap = {};
    visits.forEach((v) => {
      const key = new Date(v.scheduled_at).toISOString().slice(0, 7);
      apptMap[key] = (apptMap[key] || 0) + 1;
    });
    const appointmentTrend = Object.entries(apptMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    const vitalsTrend = vitals.map((v) => ({
      date: v.scheduled_at,
      stage: v.stage,
      workspace: v.workspace_title,
      temperature: v.temperature,
      systolic: v.bp_systolic,
      diastolic: v.bp_diastolic,
      sugar: v.sugar,
      spo2: v.spo2,
      heart_rate: v.heart_rate,
    }));

    res.json({
      appointments: {
        total: totalAppointments,
        upcoming: upcomingAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments,
        missed: missedAppointments,
        list: visits,
        trend: appointmentTrend,
      },
      vitals: {
        trend: vitalsTrend,
      },
      medications: medsResult.rows,
      medicalHistory: historyResult.rows,
    });
  } catch (error) {
    console.error("Patient analytics dashboard error:", error);
    res.status(500).json({ error: "Failed to load patient analytics" });
  }
});

/*
|--------------------------------------------------------------------------
| DOCTOR ANALYTICS DASHBOARD
|--------------------------------------------------------------------------
*/

app.get("/api/dashboard/doctor/analytics", auth("doctor"), async (req, res) => {
  try {
    const patientsResult = await db.query(
      `
      SELECT DISTINCT ON (u.id)
        u.id, u.name, u.email, u.age, u.gender, u.medical_conditions,
        wp.joined_at, wp.status AS enrollment_status
      FROM workspace_patients wp
      JOIN workspaces w ON w.id = wp.workspace_id
      JOIN users u ON u.id = wp.patient_id
      WHERE w.doctor_id = $1
      ORDER BY u.id, wp.joined_at DESC
      `,
      [req.user.id],
    );
    const patients = patientsResult.rows;

    const patientVisitsResult = await db.query(
      `
      SELECT wp.patient_id, u.name, u.email,
             COUNT(DISTINCT sv.id) AS visit_count,
             COUNT(DISTINCT sv.id) FILTER (WHERE sv.status = 'completed') AS completed_visit_count,
             MAX(sv.scheduled_at) FILTER (WHERE sv.status = 'completed') AS last_visit_at
      FROM workspace_patients wp
      JOIN workspaces w ON w.id = wp.workspace_id
      JOIN users u ON u.id = wp.patient_id
      LEFT JOIN scheduled_visits sv ON sv.patient_id = wp.patient_id AND sv.workspace_id = wp.workspace_id
      WHERE w.doctor_id = $1
      GROUP BY wp.patient_id, u.name, u.email
      ORDER BY visit_count DESC
      `,
      [req.user.id],
    );

    const visitsResult = await db.query(
      `
      SELECT sv.*, w.title AS workspace_title, w.drug_name, u.name AS patient_name
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      JOIN users u ON u.id = sv.patient_id
      WHERE sv.doctor_id = $1
      ORDER BY sv.scheduled_at ASC
      `,
      [req.user.id],
    );
    const visits = visitsResult.rows;

    const workspacesResult = await db.query(
      `SELECT id, drug_name, title, status FROM workspaces WHERE doctor_id = $1`,
      [req.user.id],
    );

    const recentJoinsResult = await db.query(
      `
      SELECT wp.joined_at AS at, u.name AS patient_name, w.title AS workspace_title, 'enrollment' AS type
      FROM workspace_patients wp
      JOIN workspaces w ON w.id = wp.workspace_id
      JOIN users u ON u.id = wp.patient_id
      WHERE w.doctor_id = $1
      ORDER BY wp.joined_at DESC
      LIMIT 10
      `,
      [req.user.id],
    );

    const recentVisitsResult = await db.query(
      `
      SELECT sv.completed_at AS at, u.name AS patient_name, w.title AS workspace_title, 'visit_completed' AS type
      FROM scheduled_visits sv
      JOIN workspaces w ON w.id = sv.workspace_id
      JOIN users u ON u.id = sv.patient_id
      WHERE sv.doctor_id = $1 AND sv.status = 'completed'
      ORDER BY sv.completed_at DESC
      LIMIT 10
      `,
      [req.user.id],
    );

    const recentVitalsResult = await db.query(
      `
      SELECT v.patient_submitted_at AS at, u.name AS patient_name, w.title AS workspace_title, 'vitals_submitted' AS type
      FROM vitals v
      JOIN workspaces w ON w.id = v.workspace_id
      JOIN users u ON u.id = v.patient_id
      WHERE w.doctor_id = $1 AND v.patient_submitted_at IS NOT NULL
      ORDER BY v.patient_submitted_at DESC
      LIMIT 10
      `,
      [req.user.id],
    );

    const recentActivity = [...recentJoinsResult.rows, ...recentVisitsResult.rows, ...recentVitalsResult.rows]
      .filter((a) => a.at)
      .sort((a, b) => new Date(b.at) - new Date(a.at))
      .slice(0, 15);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const totalPatients = patients.length;
    const activePatients = patients.filter((p) => p.enrollment_status === "active").length;
    const newPatients = patients.filter((p) => new Date(p.joined_at) >= thirtyDaysAgo).length;

    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    const todaysAppointments = visits.filter((v) => {
      const d = new Date(v.scheduled_at);
      return d >= startOfToday && d <= endOfToday;
    }).length;
    const upcomingAppointments = visits.filter(
      (v) => ["scheduled", "active"].includes(v.status) && new Date(v.scheduled_at) > now,
    ).length;
    const completedAppointments = visits.filter((v) => v.status === "completed").length;
    const cancelledAppointments = visits.filter((v) => v.status === "cancelled").length;

    const growthMap = {};
    patients.forEach((p) => {
      const key = new Date(p.joined_at).toISOString().slice(0, 7);
      growthMap[key] = (growthMap[key] || 0) + 1;
    });
    const patientGrowth = Object.entries(growthMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    const apptMap = {};
    visits.forEach((v) => {
      const key = new Date(v.scheduled_at).toISOString().slice(0, 7);
      apptMap[key] = (apptMap[key] || 0) + 1;
    });
    const appointmentTrend = Object.entries(apptMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, count]) => ({ month, count }));

    const genderCounts = {};
    const ageBuckets = { "0-17": 0, "18-34": 0, "35-49": 0, "50-64": 0, "65+": 0 };
    patients.forEach((p) => {
      if (p.gender) genderCounts[p.gender] = (genderCounts[p.gender] || 0) + 1;
      if (p.age !== null && p.age !== undefined) {
        if (p.age < 18) ageBuckets["0-17"]++;
        else if (p.age < 35) ageBuckets["18-34"]++;
        else if (p.age < 50) ageBuckets["35-49"]++;
        else if (p.age < 65) ageBuckets["50-64"]++;
        else ageBuckets["65+"]++;
      }
    });

    const drugCounts = {};
    workspacesResult.rows.forEach((w) => {
      drugCounts[w.drug_name] = (drugCounts[w.drug_name] || 0) + 1;
    });

    const conditionCounts = {};
    patients.forEach((p) => {
      if (!p.medical_conditions) return;
      p.medical_conditions
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((cond) => {
          const key = cond.toLowerCase();
          conditionCounts[key] = (conditionCounts[key] || 0) + 1;
        });
    });

    const activeWorkspaceCount = workspacesResult.rows.filter((w) => w.status === "active").length;
    const avgVisitsPerWorkspace = workspacesResult.rows.length
      ? +(visits.length / workspacesResult.rows.length).toFixed(1)
      : 0;
    const avgPatientsPerWorkspace = workspacesResult.rows.length
      ? +(patients.length / workspacesResult.rows.length).toFixed(1)
      : 0;

    const frequentPatients = patientVisitsResult.rows.filter((p) => Number(p.visit_count) > 0).slice(0, 10);

    res.json({
      patients: {
        total: totalPatients,
        active: activePatients,
        new: newPatients,
        growth: patientGrowth,
        demographics: { gender: genderCounts, ageBuckets },
        frequentlyVisited: frequentPatients,
      },
      appointments: {
        today: todaysAppointments,
        upcoming: upcomingAppointments,
        completed: completedAppointments,
        cancelled: cancelledAppointments,
        trend: appointmentTrend,
      },
      conditions: {
        byDrug: Object.entries(drugCounts).map(([name, value]) => ({ name, value })),
        byConditionText: Object.entries(conditionCounts)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10),
      },
      workload: {
        activeWorkspaces: activeWorkspaceCount,
        totalWorkspaces: workspacesResult.rows.length,
        avgVisitsPerWorkspace,
        avgPatientsPerWorkspace,
      },
      recentActivity,
    });
  } catch (error) {
    console.error("Doctor analytics dashboard error:", error);
    res.status(500).json({ error: "Failed to load doctor analytics" });
  }
});

app.get(
  "/api/workspaces/:workspaceId/patient-summary",
  auth("patient"),
  async (req, res) => {
    try {
      const workspace = await getWorkspaceOr404(req.params.workspaceId, res);
      if (!workspace) return;

      const enrolled = await db.query(
        "SELECT id FROM workspace_patients WHERE workspace_id = $1 AND patient_id = $2",
        [workspace.id, req.user.id],
      );
      if (enrolled.rows.length === 0) {
        return res
          .status(403)
          .json({ error: "Not enrolled in this workspace" });
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

      res.json({
        workspace,
        visits: visitsResult.rows,
        vitals: vitalsResult.rows,
      });
    } catch (error) {
      console.error("Patient workspace summary error:", error);
      res.status(500).json({ error: "Failed to fetch workspace summary" });
    }
  },
);

/*
|--------------------------------------------------------------------------
| SOCKET.IO / WEBRTC
|--------------------------------------------------------------------------
*/

io.on("connection", (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  /*
   * JOIN ROOM
   */

  socket.on("room:join", ({ roomCode, userId, userName, role }) => {
    if (!roomCode) {
      return;
    }

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

  /*
   * WEBRTC OFFER
   */

  socket.on("webrtc:offer", ({ roomCode, offer, to }) => {
    if (!to || !offer) {
      return;
    }

    io.to(to).emit("webrtc:offer", {
      offer,

      from: socket.id,

      userName: socket.data?.userName,
    });
  });

  /*
   * WEBRTC ANSWER
   */

  socket.on("webrtc:answer", ({ answer, to }) => {
    if (!to || !answer) {
      return;
    }

    io.to(to).emit("webrtc:answer", {
      answer,

      from: socket.id,
    });
  });

  /*
   * ICE CANDIDATE
   */

  socket.on("webrtc:ice-candidate", ({ candidate, to }) => {
    if (!to || !candidate) {
      return;
    }

    io.to(to).emit("webrtc:ice-candidate", {
      candidate,

      from: socket.id,
    });
  });

  /*
   * LEAVE ROOM
   */

  socket.on("room:leave", ({ roomCode }) => {
    if (!roomCode) {
      return;
    }

    const roomKey = `room:${roomCode}`;

    socket.leave(roomKey);

    socket.to(roomKey).emit("peer:left", {
      socketId: socket.id,
    });
  });

  /*
   * DISCONNECT
   */

  socket.on("disconnect", () => {
    console.log(`Socket disconnected: ${socket.id}`);

    if (socket.data?.roomCode) {
      socket.to(`room:${socket.data.roomCode}`).emit("peer:left", {
        socketId: socket.id,
      });
    }
  });
});

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

app.use("/api", (req, res) => {
  res.status(404).json({
    error: `API route not found: ${req.method} ${req.originalUrl}`,
  });
});

/*
|--------------------------------------------------------------------------
| SERVE CLIENT IN PRODUCTION
|--------------------------------------------------------------------------
*/

const clientDist = path.join(__dirname, "..", "client", "dist");

app.use(express.static(clientDist));

/*
|--------------------------------------------------------------------------
| REACT ROUTER FALLBACK
|--------------------------------------------------------------------------
*/

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  const indexFile = path.join(clientDist, "index.html");

  res.sendFile(indexFile, (error) => {
    if (error) {
      console.error("Client build not found:", error.message);

      res.status(404).send(
        `
            <h2>CareThread server is running.</h2>
            <p>Client build was not found.</p>
            <p>Run <b>npm run build</b> inside the client folder.</p>
            `,
      );
    }
  });
});

/*
|--------------------------------------------------------------------------
| START SERVER
|--------------------------------------------------------------------------
*/

server.listen(PORT, () => {
  console.log(`CareThread server running on port ${PORT}`);

  console.log(`API: http://localhost:${PORT}/api/health`);

  visitAlertingJob.start();
});
