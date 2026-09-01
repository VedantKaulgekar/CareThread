-- ============================================================
-- Adds AI-generated visit summary storage.
-- Purely additive — safe to run on top of the workspace model migration.
-- ============================================================

ALTER TABLE scheduled_visits
    ADD COLUMN IF NOT EXISTS ai_summary TEXT,
    ADD COLUMN IF NOT EXISTS ai_summary_generated_at TIMESTAMPTZ;
