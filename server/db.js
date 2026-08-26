const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'carethread.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('doctor','patient')),
  age INTEGER,
  gender TEXT,
  phone TEXT,
  medical_conditions TEXT,
  specialization TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  title TEXT,
  doctor_id TEXT NOT NULL,
  patient_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','active','completed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  FOREIGN KEY(doctor_id) REFERENCES users(id),
  FOREIGN KEY(patient_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS vitals (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  patient_id TEXT NOT NULL,
  doctor_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK(stage IN ('pre_dosage','post_dosage','general')),
  temperature REAL,
  bp_systolic INTEGER,
  bp_diastolic INTEGER,
  sugar REAL,
  spo2 REAL,
  heart_rate INTEGER,
  dosage_given TEXT,
  notes TEXT,
  recorded_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(room_id) REFERENCES rooms(id),
  FOREIGN KEY(patient_id) REFERENCES users(id)
);
`);

module.exports = db;
