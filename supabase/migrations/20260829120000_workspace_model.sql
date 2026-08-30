-- ============================================================
-- CareThread v2 schema — Workspace-based model
--
--   workspaces          (doctor-created, one per drug)
--   workspace_patients  (enrollment join table — join once via code)
--   scheduled_visits     (dated video-call sessions inside a workspace)
--   vitals                (one row per visit+stage, split patient/doctor columns)
--
-- `users` is untouched — existing accounts are preserved.
-- `rooms` and the old flat `vitals` table are dropped and replaced,
-- since their structure changes completely under the new model.
-- ============================================================

DROP TABLE IF EXISTS vitals CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('doctor', 'patient')),
    age INTEGER,
    gender TEXT,
    phone TEXT,
    medical_conditions TEXT,
    specialization TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- WORKSPACES ----------
-- One per drug a doctor is running. Patients enroll once via `code`.
CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    doctor_id TEXT NOT NULL REFERENCES users(id),
    drug_name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'completed', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------- ENROLLMENT ----------
-- A patient joins a workspace once via code; this row persists for the
-- whole workspace, independent of any individual visit.
CREATE TABLE IF NOT EXISTS workspace_patients (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    patient_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'withdrawn', 'completed')),
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (workspace_id, patient_id)
);

-- ---------- SCHEDULED VISITS ----------
-- A dated/timed video-call session for one patient inside a workspace.
-- room_code is what the VisitRoom page looks up to join the call.
CREATE TABLE IF NOT EXISTS scheduled_visits (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    patient_id TEXT NOT NULL REFERENCES users(id),
    doctor_id TEXT NOT NULL REFERENCES users(id),
    room_code TEXT UNIQUE NOT NULL,
    title TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'scheduled'
        CHECK (status IN ('scheduled', 'active', 'completed', 'missed', 'cancelled')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- ---------- VITALS ----------
-- One row per (visit, stage). Patient fills the reading columns from
-- their own equipment; doctor fills dosage/notes independently.
-- Upserted via ON CONFLICT (scheduled_visit_id, stage).
CREATE TABLE IF NOT EXISTS vitals (
    id TEXT PRIMARY KEY,
    scheduled_visit_id TEXT NOT NULL REFERENCES scheduled_visits(id),
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    patient_id TEXT NOT NULL REFERENCES users(id),
    doctor_id TEXT NOT NULL REFERENCES users(id),

    stage TEXT NOT NULL
        CHECK (stage IN ('pre_dosage', 'post_dosage', 'general')),

    -- Patient-submitted readings (from their own equipment)
    temperature DOUBLE PRECISION,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    sugar DOUBLE PRECISION,
    spo2 DOUBLE PRECISION,
    heart_rate INTEGER,
    patient_submitted_at TIMESTAMPTZ,

    -- Doctor-submitted fields
    dosage_given TEXT,
    doctor_notes TEXT,
    doctor_submitted_at TIMESTAMPTZ,

    UNIQUE (scheduled_visit_id, stage)
);

-- ---------- INDEXES ----------
CREATE INDEX IF NOT EXISTS idx_workspaces_doctor_id ON workspaces(doctor_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_code ON workspaces(code);

CREATE INDEX IF NOT EXISTS idx_workspace_patients_workspace_id ON workspace_patients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_patients_patient_id ON workspace_patients(patient_id);

CREATE INDEX IF NOT EXISTS idx_visits_workspace_id ON scheduled_visits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_visits_patient_id ON scheduled_visits(patient_id);
CREATE INDEX IF NOT EXISTS idx_visits_doctor_id ON scheduled_visits(doctor_id);
CREATE INDEX IF NOT EXISTS idx_visits_room_code ON scheduled_visits(room_code);
CREATE INDEX IF NOT EXISTS idx_visits_scheduled_at ON scheduled_visits(scheduled_at);

CREATE INDEX IF NOT EXISTS idx_vitals_scheduled_visit_id ON vitals(scheduled_visit_id);
CREATE INDEX IF NOT EXISTS idx_vitals_workspace_id ON vitals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_vitals_patient_id ON vitals(patient_id);
