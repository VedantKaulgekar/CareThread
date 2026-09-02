-- ============================================================
-- Additive migration: AI features + Calendar/SMS integration support.
-- Every column here is nullable / has a safe default — nothing here
-- breaks existing rows or requires backfilling.
-- ============================================================

-- ---------- Feature 2: Live Visit Checklist Agent ----------
-- Protocol text is parsed once (by LLM) into a structured checklist,
-- stored on the workspace. Each scheduled visit tracks its own
-- progress against that checklist independently.
ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS protocol_text TEXT,
    ADD COLUMN IF NOT EXISTS checklist JSONB;

ALTER TABLE scheduled_visits
    ADD COLUMN IF NOT EXISTS checklist_progress JSONB DEFAULT '{}'::jsonb;

-- ---------- Feature 4: Anomaly Detection ----------
-- Stores flags raised against a specific vitals row, e.g.
-- [{"field": "bp_systolic", "reason": "...", "z_score": 3.1}]
ALTER TABLE vitals
    ADD COLUMN IF NOT EXISTS anomaly_flags JSONB DEFAULT '[]'::jsonb;

-- ---------- Feature 5: Missed Visit Window Alerting ----------
-- Tracks which reminder stages have already fired, so the alerting
-- job never sends the same reminder twice.
ALTER TABLE scheduled_visits
    ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS urgent_reminder_sent_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS coordinator_flagged_at TIMESTAMPTZ;

-- ---------- Feature 1: Intake / Urgent Visit Request ----------
-- A patient-initiated request for an unscheduled visit, classified
-- by urgency. Doctor reviews and can convert it into a real
-- scheduled_visits row.
CREATE TABLE IF NOT EXISTS visit_requests (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id),
    patient_id TEXT NOT NULL REFERENCES users(id),
    concern_text TEXT NOT NULL,
    urgency TEXT CHECK (urgency IN ('low', 'medium', 'high', 'unclear')),
    urgency_reasoning TEXT,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'scheduled', 'dismissed')),
    resulting_visit_id TEXT REFERENCES scheduled_visits(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visit_requests_workspace_id ON visit_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_visit_requests_patient_id ON visit_requests(patient_id);

-- ---------- Feature 3: Ambient Scribe (Whisper transcription) ----------
-- One row per transcribed audio chunk during a live visit. Kept
-- separate from vitals so raw transcript text never conflates with
-- structured, confirmed data.
CREATE TABLE IF NOT EXISTS visit_transcript_chunks (
    id TEXT PRIMARY KEY,
    scheduled_visit_id TEXT NOT NULL REFERENCES scheduled_visits(id),
    speaker_role TEXT CHECK (speaker_role IN ('doctor', 'patient', 'unknown')),
    text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcript_visit_id ON visit_transcript_chunks(scheduled_visit_id);

-- Suggested (not auto-applied) extractions the Scribe Agent pulls from
-- the transcript, for the investigator to confirm or dismiss.
ALTER TABLE scheduled_visits
    ADD COLUMN IF NOT EXISTS scribe_suggestions JSONB;

-- ---------- Calendar integration ----------
-- One row per user who has connected Google Calendar. Refresh token
-- is long-lived; access tokens are refreshed on demand at call time.
CREATE TABLE IF NOT EXISTS calendar_connections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    provider TEXT NOT NULL DEFAULT 'google',
    refresh_token TEXT NOT NULL,
    email TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tracks the external calendar event id per visit per user, so we can
-- update/cancel the same event instead of creating duplicates.
CREATE TABLE IF NOT EXISTS calendar_events (
    id TEXT PRIMARY KEY,
    scheduled_visit_id TEXT NOT NULL REFERENCES scheduled_visits(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    external_event_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (scheduled_visit_id, user_id)
);

-- ---------- SMS / notification log ----------
-- Audit trail of every reminder attempted, sent or not, so the
-- alerting feature is explainable (matches the CareThread trust
-- pattern used elsewhere: every automated action leaves a record).
CREATE TABLE IF NOT EXISTS notification_log (
    id TEXT PRIMARY KEY,
    scheduled_visit_id TEXT REFERENCES scheduled_visits(id),
    recipient_user_id TEXT REFERENCES users(id),
    channel TEXT NOT NULL CHECK (channel IN ('sms', 'console')),
    kind TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('sent', 'skipped_no_credentials', 'failed')),
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_visit_id ON notification_log(scheduled_visit_id);
