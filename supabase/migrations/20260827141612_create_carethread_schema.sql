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

CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    title TEXT,
    doctor_id TEXT NOT NULL,
    patient_id TEXT,

    status TEXT NOT NULL DEFAULT 'open'
        CHECK (status IN ('open', 'active', 'completed')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,

    FOREIGN KEY (doctor_id) REFERENCES users(id),
    FOREIGN KEY (patient_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vitals (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    patient_id TEXT NOT NULL,
    doctor_id TEXT NOT NULL,

    stage TEXT NOT NULL
        CHECK (stage IN ('pre_dosage', 'post_dosage', 'general')),

    temperature DOUBLE PRECISION,
    bp_systolic INTEGER,
    bp_diastolic INTEGER,
    sugar DOUBLE PRECISION,
    spo2 DOUBLE PRECISION,
    heart_rate INTEGER,

    dosage_given TEXT,
    notes TEXT,

    recorded_at TIMESTAMPTZ DEFAULT NOW(),

    FOREIGN KEY (room_id) REFERENCES rooms(id),
    FOREIGN KEY (patient_id) REFERENCES users(id),
    FOREIGN KEY (doctor_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_rooms_doctor_id
    ON rooms(doctor_id);

CREATE INDEX IF NOT EXISTS idx_rooms_patient_id
    ON rooms(patient_id);

CREATE INDEX IF NOT EXISTS idx_rooms_code
    ON rooms(code);

CREATE INDEX IF NOT EXISTS idx_vitals_room_id
    ON vitals(room_id);

CREATE INDEX IF NOT EXISTS idx_vitals_patient_id
    ON vitals(patient_id);

CREATE INDEX IF NOT EXISTS idx_vitals_recorded_at
    ON vitals(recorded_at);