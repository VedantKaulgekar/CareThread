-- ============================================================
-- Switches the notification channel from Twilio SMS (not actually
-- free) to email via Gmail SMTP (genuinely free, no account signup
-- beyond a Gmail app password). Widens the channel check constraint
-- to accept 'email' instead of 'sms'.
-- ============================================================

ALTER TABLE notification_log
    DROP CONSTRAINT IF EXISTS notification_log_channel_check;

ALTER TABLE notification_log
    ADD CONSTRAINT notification_log_channel_check
    CHECK (channel IN ('email', 'console'));
