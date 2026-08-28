const express = require("express");
const http = require("http");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");

const db = require("./db");


// =========================================================
// APP SETUP
// =========================================================

const app = express();

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

const JWT_SECRET =
  "carethread_hackathon_secret_key_change_in_prod";

const PORT =
  process.env.PORT || 4000;


// =========================================================
// MIDDLEWARE
// =========================================================

app.use(
  cors({
    origin: "*",
    methods: [
      "GET",
      "POST",
      "PUT",
      "DELETE",
      "OPTIONS",
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(express.json());


// =========================================================
// HEALTH CHECK
// =========================================================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      message:
        "CareThread API is running",
    });
  }
);


// =========================================================
// AUTH MIDDLEWARE
// =========================================================

function auth(requiredRole) {

  return (req, res, next) => {

    const header =
      req.headers.authorization;

    if (!header) {

      return res.status(401).json({
        error:
          "No token provided",
      });
    }


    const parts =
      header.split(" ");

    const token =
      parts[1];


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


      req.user =
        decoded;


      next();

    } catch (error) {

      console.error(
        "AUTH ERROR:",
        error
      );

      return res.status(401).json({
        error:
          "Invalid or expired token",
      });
    }
  };
}


// =========================================================
// ROOM CODE GENERATOR
// =========================================================

function genRoomCode() {

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code = "";

  for (
    let i = 0;
    i < 6;
    i++
  ) {

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


// =========================================================
// JWT TOKEN
// =========================================================

function signToken(user) {

  return jwt.sign(
    {
      id:
        user.id,

      name:
        user.name,

      email:
        user.email,

      role:
        user.role,
    },

    JWT_SECRET,

    {
      expiresIn:
        "7d",
    }
  );
}


// =========================================================
// PUBLIC USER
// =========================================================

function publicUser(user) {

  const {
    password_hash,
    ...rest
  } = user;

  return rest;
}


// =========================================================
// VALIDATION
// =========================================================

function isValidEmail(email) {

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email
  );
}


function isValidPassword(password) {

  return (
    password.length >= 6 &&
    /[A-Za-z]/.test(password) &&
    /\d/.test(password)
  );
}


function isValidPhone(phone) {

  return /^\d{10}$/.test(phone);
}


// =========================================================
// SIGNUP
// =========================================================

app.post(
  "/api/auth/signup",
  (req, res) => {

    try {

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


      email =
        email
          .trim()
          .toLowerCase();


      if (
        !isValidEmail(email)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid email address",
        });
      }


      if (
        ![
          "doctor",
          "patient",
        ].includes(role)
      ) {

        return res.status(400).json({
          error:
            "Invalid role",
        });
      }


      if (
        !isValidPassword(password)
      ) {

        return res.status(400).json({
          error:
            "Password must be at least 6 characters and contain at least one letter and one number",
        });
      }


      // ---------------------------------------------------
      // PATIENT VALIDATION
      // ---------------------------------------------------

      if (
        role === "patient"
      ) {

        if (
          age !== "" &&
          age !== null &&
          age !== undefined
        ) {

          age =
            Number(age);


          if (
            !Number.isInteger(age) ||
            age < 1 ||
            age > 140
          ) {

            return res.status(400).json({
              error:
                "Age must be between 1 and 140",
            });
          }
        }


        if (
          phone &&
          phone.trim() !== ""
        ) {

          phone =
            phone.replace(
              /\D/g,
              ""
            );


          if (
            !isValidPhone(phone)
          ) {

            return res.status(400).json({
              error:
                "Phone number must contain exactly 10 digits",
            });
          }
        }
      }


      // ---------------------------------------------------
      // CHECK EXISTING USER
      // ---------------------------------------------------

      const existing =
        db
          .prepare(
            "SELECT id FROM users WHERE email = ?"
          )
          .get(email);


      if (existing) {

        return res.status(409).json({
          error:
            "Email already registered",
        });
      }


      // ---------------------------------------------------
      // CREATE USER
      // ---------------------------------------------------

      const id =
        uuidv4();


      const password_hash =
        bcrypt.hashSync(
          password,
          10
        );


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

        VALUES (
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `).run(

        id,

        name.trim(),

        email,

        password_hash,

        role,

        age || null,

        gender || null,

        phone || null,

        medical_conditions ||
          null,

        specialization ||
          null

      );


      const user =
        db
          .prepare(
            "SELECT * FROM users WHERE id = ?"
          )
          .get(id);


      const token =
        signToken(user);


      res.json({

        token,

        user:
          publicUser(user),

      });

    } catch (error) {

      console.error(
        "SIGNUP ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Signup failed",
      });
    }
  }
);


// =========================================================
// LOGIN
// =========================================================

app.post(
  "/api/auth/login",
  (req, res) => {

    try {

      let {
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


      email =
        email
          .trim()
          .toLowerCase();


      if (
        !isValidEmail(email)
      ) {

        return res.status(400).json({
          error:
            "Please enter a valid email address",
        });
      }


      const user =
        db
          .prepare(
            "SELECT * FROM users WHERE email = ?"
          )
          .get(email);


      if (!user) {

        return res.status(404).json({
          error:
            "No account found with this email",
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


      if (
        !bcrypt.compareSync(
          password,
          user.password_hash
        )
      ) {

        return res.status(401).json({
          error:
            "Incorrect password",
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
        "LOGIN ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Login failed",
      });
    }
  }
);


// =========================================================
// CREATE WORKSPACE
// =========================================================

app.post(
  "/api/rooms",
  auth("doctor"),
  (req, res) => {

    try {

      const {
        title,
        visit_type,
        frequency,
      } = req.body;


      console.log(
        "======================================"
      );

      console.log(
        "CREATE WORKSPACE"
      );

      console.log(
        "Doctor:",
        req.user.id
      );

      console.log(
        "Title:",
        title
      );

      console.log(
        "Visit Type:",
        visit_type
      );

      console.log(
        "Frequency:",
        frequency
      );

      console.log(
        "======================================"
      );


      const id =
        uuidv4();


      let code =
        genRoomCode();


      while (
        db
          .prepare(
            "SELECT id FROM rooms WHERE code = ?"
          )
          .get(code)
      ) {

        code =
          genRoomCode();
      }


      db.prepare(`
        INSERT INTO rooms (
          id,
          code,
          title,
          doctor_id,
          status
        )

        VALUES (
          ?,
          ?,
          ?,
          ?,
          'open'
        )
      `).run(

        id,

        code,

        title ||
          "Trial Visit",

        req.user.id

      );


      const room =
        db
          .prepare(
            "SELECT * FROM rooms WHERE id = ?"
          )
          .get(id);


      res.status(201).json({
        room,
      });

    } catch (error) {

      console.error(
        "CREATE WORKSPACE ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to create workspace",
      });
    }
  }
);


// =========================================================
// GET DOCTOR WORKSPACES
// =========================================================

app.get(
  "/api/rooms/mine",
  auth("doctor"),
  (req, res) => {

    try {

      const rooms =
        db
          .prepare(`
            SELECT
              r.*,

              u.name AS patient_name,

              u.email AS patient_email

            FROM rooms r

            LEFT JOIN users u
              ON r.patient_id = u.id

            WHERE
              r.doctor_id = ?

            ORDER BY
              r.created_at DESC
          `)
          .all(
            req.user.id
          );


      res.json({
        rooms,
      });

    } catch (error) {

      console.error(
        "LOAD WORKSPACES ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load workspaces",
      });
    }
  }
);


// =========================================================
// DELETE WORKSPACE
// =========================================================

app.delete(
  "/api/rooms/id/:id",
  auth("doctor"),
  (req, res) => {

    try {

      const roomId =
        req.params.id;


      console.log(
        "======================================"
      );

      console.log(
        "DELETE WORKSPACE"
      );

      console.log(
        "Workspace ID:",
        roomId
      );

      console.log(
        "Doctor ID:",
        req.user.id
      );

      console.log(
        "======================================"
      );


      // ---------------------------------------------------
      // VERIFY WORKSPACE BELONGS TO DOCTOR
      // ---------------------------------------------------

      const room =
        db
          .prepare(`
            SELECT *
            FROM rooms

            WHERE
              id = ?

            AND
              doctor_id = ?
          `)
          .get(
            roomId,
            req.user.id
          );


      if (!room) {

        return res.status(404).json({
          error:
            "Workspace not found or you do not have permission to delete it",
        });
      }


      // ---------------------------------------------------
      // DELETE VITALS FIRST
      // ---------------------------------------------------

      const vitalResult =
        db
          .prepare(`
            DELETE FROM vitals

            WHERE
              room_id = ?
          `)
          .run(
            roomId
          );


      console.log(
        "Vitals deleted:",
        vitalResult.changes
      );


      // ---------------------------------------------------
      // DELETE ROOM
      // ---------------------------------------------------

      const roomResult =
        db
          .prepare(`
            DELETE FROM rooms

            WHERE
              id = ?

            AND
              doctor_id = ?
          `)
          .run(
            roomId,
            req.user.id
          );


      console.log(
        "Rooms deleted:",
        roomResult.changes
      );


      if (
        roomResult.changes !== 1
      ) {

        return res.status(500).json({
          error:
            "Workspace was not deleted",
        });
      }


      // ---------------------------------------------------
      // NOTIFY USERS
      // ---------------------------------------------------

      io
        .to(
          `room:${room.code}`
        )
        .emit(
          "room:deleted"
        );


      console.log(
        "Workspace deleted successfully"
      );


      res.json({

        ok: true,

        message:
          "Workspace deleted successfully",

        roomId:

          roomId,

      });

    } catch (error) {

      console.error(
        "DELETE WORKSPACE ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to delete workspace",
      });
    }
  }
);


// =========================================================
// PATIENT WORKSPACES
// =========================================================

app.get(
  "/api/rooms/patient/mine",
  auth("patient"),
  (req, res) => {

    try {

      const rooms =
        db
          .prepare(`
            SELECT
              r.*,

              u.name AS doctor_name

            FROM rooms r

            LEFT JOIN users u
              ON r.doctor_id = u.id

            WHERE
              r.patient_id = ?

            ORDER BY
              r.created_at DESC
          `)
          .all(
            req.user.id
          );


      res.json({
        rooms,
      });

    } catch (error) {

      console.error(
        "PATIENT ROOMS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load patient rooms",
      });
    }
  }
);


// =========================================================
// PATIENT JOIN ROOM
// =========================================================

app.post(
  "/api/rooms/join",
  auth("patient"),
  (req, res) => {

    try {

      const cleanCode =
        (req.body.code || "")
          .toUpperCase()
          .trim();


      const room =
        db
          .prepare(
            "SELECT * FROM rooms WHERE code = ?"
          )
          .get(
            cleanCode
          );


      if (!room) {

        return res.status(404).json({
          error:
            "Invalid room code",
        });
      }


      if (
        room.patient_id &&
        room.patient_id !== req.user.id
      ) {

        return res.status(409).json({
          error:
            "This room already has a patient",
        });
      }


      db.prepare(`
        UPDATE rooms

        SET
          patient_id = ?,

          status = 'active'

        WHERE
          id = ?
      `).run(

        req.user.id,

        room.id

      );


      const updated =
        db
          .prepare(
            "SELECT * FROM rooms WHERE id = ?"
          )
          .get(
            room.id
          );


      res.json({
        room:
          updated,
      });

    } catch (error) {

      console.error(
        "JOIN ROOM ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to join workspace",
      });
    }
  }
);


// =========================================================
// GET ROOM BY CODE
// =========================================================

app.get(
  "/api/rooms/:code",
  auth(),
  (req, res) => {

    try {

      const room =
        db
          .prepare(`
            SELECT
              r.*,

              d.name AS doctor_name,

              p.name AS patient_name

            FROM rooms r

            LEFT JOIN users d
              ON r.doctor_id = d.id

            LEFT JOIN users p
              ON r.patient_id = p.id

            WHERE
              r.code = ?
          `)
          .get(
            req.params.code.toUpperCase()
          );


      if (!room) {

        return res.status(404).json({
          error:
            "Room not found",
        });
      }


      if (
        req.user.role === "doctor" &&
        room.doctor_id !== req.user.id
      ) {

        return res.status(403).json({
          error:
            "Not your room",
        });
      }


      if (
        req.user.role === "patient" &&
        room.patient_id &&
        room.patient_id !== req.user.id
      ) {

        return res.status(403).json({
          error:
            "Not your room",
        });
      }


      res.json({
        room,
      });

    } catch (error) {

      console.error(
        "GET ROOM ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load room",
      });
    }
  }
);


// =========================================================
// COMPLETE ROOM
// =========================================================

app.post(
  "/api/rooms/:code/complete",
  auth("doctor"),
  (req, res) => {

    try {

      const room =
        db
          .prepare(
            "SELECT * FROM rooms WHERE code = ?"
          )
          .get(
            req.params.code.toUpperCase()
          );


      if (
        !room ||
        room.doctor_id !== req.user.id
      ) {

        return res.status(404).json({
          error:
            "Room not found",
        });
      }


      db.prepare(`
        UPDATE rooms

        SET
          status = 'completed',

          completed_at =
            CURRENT_TIMESTAMP

        WHERE
          id = ?
      `).run(
        room.id
      );


      io
        .to(
          `room:${room.code}`
        )
        .emit(
          "room:completed"
        );


      res.json({
        ok: true,
      });

    } catch (error) {

      console.error(
        "COMPLETE ROOM ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to complete room",
      });
    }
  }
);


// =========================================================
// VITALS - CREATE
// =========================================================

app.post(
  "/api/vitals",
  auth("doctor"),
  (req, res) => {

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


      if (
        !room_id ||
        !patient_id ||
        !stage
      ) {

        return res.status(400).json({
          error:
            "Missing required fields",
        });
      }


      const id =
        uuidv4();


      db.prepare(`
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
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?
        )
      `).run(

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

        notes || null

      );


      const entry =
        db
          .prepare(
            "SELECT * FROM vitals WHERE id = ?"
          )
          .get(id);


      io
        .to(
          `room:${room_id}`
        )
        .emit(
          "vitals:new",
          entry
        );


      res.json({
        vitals:
          entry,
      });

    } catch (error) {

      console.error(
        "CREATE VITALS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to save vitals",
      });
    }
  }
);


// =========================================================
// ROOM VITALS
// =========================================================

app.get(
  "/api/vitals/room/:roomId",
  auth(),
  (req, res) => {

    try {

      const rows =
        db
          .prepare(`
            SELECT *

            FROM vitals

            WHERE
              room_id = ?

            ORDER BY
              recorded_at ASC
          `)
          .all(
            req.params.roomId
          );


      res.json({
        vitals:
          rows,
      });

    } catch (error) {

      console.error(
        "ROOM VITALS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load vitals",
      });
    }
  }
);


// =========================================================
// PATIENT VITALS
// =========================================================

app.get(
  "/api/vitals/patient/:patientId",
  auth(),
  (req, res) => {

    try {

      const rows =
        db
          .prepare(`
            SELECT *

            FROM vitals

            WHERE
              patient_id = ?

            ORDER BY
              recorded_at ASC
          `)
          .all(
            req.params.patientId
          );


      res.json({
        vitals:
          rows,
      });

    } catch (error) {

      console.error(
        "PATIENT VITALS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load patient vitals",
      });
    }
  }
);


// =========================================================
// DOCTOR PATIENT LIST
// =========================================================
//
// GET /api/patients
//
// Returns patients who have a room/visit
// with the logged-in doctor.
// =========================================================

app.get(
  "/api/patients",
  auth("doctor"),
  (req, res) => {

    try {

      const patients =
        db
          .prepare(`
            SELECT DISTINCT

              u.id,

              u.name,

              u.email,

              u.age,

              u.gender,

              u.phone,

              u.medical_conditions,

              u.specialization,

              u.created_at

            FROM users u

            INNER JOIN rooms r
              ON r.patient_id = u.id

            WHERE
              u.role = 'patient'

            AND
              r.doctor_id = ?

            ORDER BY
              u.name ASC
          `)
          .all(
            req.user.id
          );


      const result =
        patients.map(
          (patient) => {

            const stats =
              db
                .prepare(`
                  SELECT

                    COUNT(*) AS total_visits,

                    SUM(
                      CASE
                        WHEN status = 'active'
                        THEN 1
                        ELSE 0
                      END
                    ) AS active_visits,

                    SUM(
                      CASE
                        WHEN status = 'completed'
                        THEN 1
                        ELSE 0
                      END
                    ) AS completed_visits

                  FROM rooms

                  WHERE
                    doctor_id = ?

                  AND
                    patient_id = ?
                `)
                .get(

                  req.user.id,

                  patient.id

                );


            const latestVisit =
              db
                .prepare(`
                  SELECT

                    id,

                    code,

                    title,

                    status,

                    created_at,

                    completed_at

                  FROM rooms

                  WHERE
                    doctor_id = ?

                  AND
                    patient_id = ?

                  ORDER BY
                    created_at DESC

                  LIMIT 1
                `)
                .get(

                  req.user.id,

                  patient.id

                );


            return {

              ...patient,

              total_visits:
                stats?.total_visits ||
                0,

              active_visits:
                stats?.active_visits ||
                0,

              completed_visits:
                stats?.completed_visits ||
                0,

              latest_visit:
                latestVisit ||
                null,

            };
          }
        );


      console.log(
        `Loaded ${result.length} patients`
      );


      res.json({
        patients:
          result,
      });

    } catch (error) {

      console.error(
        "GET PATIENTS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load patients",
      });
    }
  }
);


// =========================================================
// SINGLE PATIENT DETAILS
// =========================================================
//
// GET /api/patients/:patientId
// =========================================================

app.get(
  "/api/patients/:patientId",
  auth("doctor"),
  (req, res) => {

    try {

      const patientId =
        req.params.patientId;


      // ---------------------------------------------------
      // PATIENT
      // ---------------------------------------------------

      const patient =
        db
          .prepare(`
            SELECT

              id,

              name,

              email,

              age,

              gender,

              phone,

              medical_conditions,

              specialization,

              created_at

            FROM users

            WHERE
              id = ?

            AND
              role = 'patient'
          `)
          .get(
            patientId
          );


      if (!patient) {

        return res.status(404).json({
          error:
            "Patient not found",
        });
      }


      // ---------------------------------------------------
      // VERIFY DOCTOR RELATIONSHIP
      // ---------------------------------------------------

      const relationship =
        db
          .prepare(`
            SELECT id

            FROM rooms

            WHERE
              doctor_id = ?

            AND
              patient_id = ?

            LIMIT 1
          `)
          .get(

            req.user.id,

            patientId

          );


      if (!relationship) {

        return res.status(403).json({
          error:
            "You do not have access to this patient",
        });
      }


      // ---------------------------------------------------
      // PATIENT VISITS
      // ---------------------------------------------------

      const visits =
        db
          .prepare(`
            SELECT

              id,

              code,

              title,

              status,

              created_at,

              completed_at

            FROM rooms

            WHERE
              doctor_id = ?

            AND
              patient_id = ?

            ORDER BY
              created_at DESC
          `)
          .all(

            req.user.id,

            patientId

          );


      // ---------------------------------------------------
      // PATIENT VITALS
      // ---------------------------------------------------

      const vitals =
        db
          .prepare(`
            SELECT

              v.*

            FROM vitals v

            INNER JOIN rooms r
              ON v.room_id = r.id

            WHERE
              v.patient_id = ?

            AND
              r.doctor_id = ?

            ORDER BY
              v.recorded_at DESC
          `)
          .all(

            patientId,

            req.user.id

          );


      // ---------------------------------------------------
      // LATEST VITAL
      // ---------------------------------------------------

      const latestVitals =
        vitals.length > 0
          ? vitals[0]
          : null;


      // ---------------------------------------------------
      // RESPONSE
      // ---------------------------------------------------

      res.json({

        patient,

        visits,

        vitals,

        latestVitals,

      });

    } catch (error) {

      console.error(
        "GET PATIENT DETAILS ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load patient details",
      });
    }
  }
);


// =========================================================
// DOCTOR DASHBOARD
// =========================================================

app.get(
  "/api/dashboard/doctor",
  auth("doctor"),
  (req, res) => {

    try {

      const rooms =
        db
          .prepare(
            "SELECT * FROM rooms WHERE doctor_id = ?"
          )
          .all(
            req.user.id
          );


      const roomIds =
        rooms.map(
          (room) =>
            room.id
        );


      let vitals = [];


      if (
        roomIds.length
      ) {

        const placeholders =
          roomIds
            .map(
              () => "?"
            )
            .join(",");


        vitals =
          db
            .prepare(`
              SELECT *

              FROM vitals

              WHERE
                room_id IN (${placeholders})

              ORDER BY
                recorded_at ASC
            `)
            .all(
              ...roomIds
            );
      }


      const totalPatients =
        new Set(

          rooms
            .filter(
              (room) =>
                room.patient_id
            )
            .map(
              (room) =>
                room.patient_id
            )

        ).size;


      const totalVisits =
        rooms.length;


      const activeVisits =
        rooms.filter(
          (room) =>
            room.status ===
            "active"
        ).length;


      const completedVisits =
        rooms.filter(
          (room) =>
            room.status ===
            "completed"
        ).length;


      const avg =
        (arr) => {

          if (
            !arr.length
          ) {
            return null;
          }


          return +(
            arr.reduce(
              (a, b) =>
                a + b,
              0
            ) /
            arr.length
          ).toFixed(1);
        };


      const nums =
        (field) =>

          vitals
            .map(
              (vital) =>
                vital[field]
            )
            .filter(
              (value) =>
                value !== null &&
                value !== undefined
            );


      const summary = {

        avgTemperature:
          avg(
            nums(
              "temperature"
            )
          ),

        avgSystolic:
          avg(
            nums(
              "bp_systolic"
            )
          ),

        avgDiastolic:
          avg(
            nums(
              "bp_diastolic"
            )
          ),

        avgSugar:
          avg(
            nums(
              "sugar"
            )
          ),

        avgSpo2:
          avg(
            nums(
              "spo2"
            )
          ),

        avgHeartRate:
          avg(
            nums(
              "heart_rate"
            )
          ),

      };


      const trend =
        vitals.map(
          (vital) => ({

            date:
              vital.recorded_at,

            temperature:
              vital.temperature,

            systolic:
              vital.bp_systolic,

            diastolic:
              vital.bp_diastolic,

            sugar:
              vital.sugar,

            spo2:
              vital.spo2,

            heart_rate:
              vital.heart_rate,

            stage:
              vital.stage,

            patient_id:
              vital.patient_id,

          })
        );


      const statusBreakdown = [

        {

          name:
            "Open",

          value:
            rooms.filter(
              (room) =>
                room.status ===
                "open"
            ).length,

        },

        {

          name:
            "Active",

          value:
            activeVisits,

        },

        {

          name:
            "Completed",

          value:
            completedVisits,

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

      console.error(
        "DOCTOR DASHBOARD ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load doctor dashboard",
      });
    }
  }
);


// =========================================================
// PATIENT DASHBOARD
// =========================================================

app.get(
  "/api/dashboard/patient",
  auth("patient"),
  (req, res) => {

    try {

      const rooms =
        db
          .prepare(
            "SELECT * FROM rooms WHERE patient_id = ?"
          )
          .all(
            req.user.id
          );


      const vitals =
        db
          .prepare(`
            SELECT *

            FROM vitals

            WHERE
              patient_id = ?

            ORDER BY
              recorded_at ASC
          `)
          .all(
            req.user.id
          );


      res.json({

        rooms,

        vitals,

      });

    } catch (error) {

      console.error(
        "PATIENT DASHBOARD ERROR:",
        error
      );

      res.status(500).json({
        error:
          "Failed to load patient dashboard",
      });
    }
  }
);


// =========================================================
// SOCKET.IO
// =========================================================

io.on(
  "connection",
  (socket) => {

    // -----------------------------------------------------
    // ROOM JOIN
    // -----------------------------------------------------

    socket.on(
      "room:join",
      ({
        roomCode,
        userId,
        userName,
        role,
      }) => {

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


    // -----------------------------------------------------
    // OFFER
    // -----------------------------------------------------

    socket.on(
      "webrtc:offer",
      ({
        roomCode,
        offer,
        to,
      }) => {

        io
          .to(to)
          .emit(
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


    // -----------------------------------------------------
    // ANSWER
    // -----------------------------------------------------

    socket.on(
      "webrtc:answer",
      ({
        answer,
        to,
      }) => {

        io
          .to(to)
          .emit(
            "webrtc:answer",
            {

              answer,

              from:
                socket.id,

            }
          );
      }
    );


    // -----------------------------------------------------
    // ICE
    // -----------------------------------------------------

    socket.on(
      "webrtc:ice-candidate",
      ({
        candidate,
        to,
      }) => {

        io
          .to(to)
          .emit(
            "webrtc:ice-candidate",
            {

              candidate,

              from:
                socket.id,

            }
          );
      }
    );


    // -----------------------------------------------------
    // LEAVE
    // -----------------------------------------------------

    socket.on(
      "room:leave",
      ({
        roomCode,
      }) => {

        socket.leave(
          `room:${roomCode}`
        );


        socket
          .to(
            `room:${roomCode}`
          )
          .emit(
            "peer:left",
            {
              socketId:
                socket.id,
            }
          );
      }
    );


    // -----------------------------------------------------
    // DISCONNECT
    // -----------------------------------------------------

    socket.on(
      "disconnect",
      () => {

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


// =========================================================
// API 404 HANDLER
// =========================================================
//
// IMPORTANT:
// This catches unknown API routes as JSON instead of
// trying to load client/dist/index.html.
// =========================================================

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({

      error:
        `API route not found: ${req.method} ${req.originalUrl}`,

    });

  }
);


// =========================================================
// START SERVER
// =========================================================

server.listen(
  PORT,
  () => {

    console.log(
      "======================================"
    );

    console.log(
      `CareThread server running on port ${PORT}`
    );

    console.log(
      `API: http://localhost:${PORT}/api/health`
    );

    console.log(
      "======================================"
    );

  }
);