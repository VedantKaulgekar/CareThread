/**
 * Email wrapper — genuinely free, no third-party account signup, no
 * card, no trial credit to run out. Uses Gmail's SMTP relay via an
 * "app password" (not your real Gmail password) through nodemailer.
 *
 * Until EMAIL_USER / EMAIL_APP_PASSWORD are set in server/.env, every
 * "send" is logged to notification_log with status
 * 'skipped_no_credentials' and printed to the console — nothing
 * crashes, nothing silently pretends to have sent an email that didn't
 * go out. Once credentials are added, the exact same call path starts
 * actually sending email with zero code changes elsewhere in the app.
 */

const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const db = require("../db");

let transporter = null;
let transporterInitAttempted = false;

function getTransporter() {
  if (transporterInitAttempted) return transporter;
  transporterInitAttempted = true;

  const { EMAIL_USER, EMAIL_APP_PASSWORD } = process.env;
  if (!EMAIL_USER || !EMAIL_APP_PASSWORD) {
    return null;
  }

  transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: EMAIL_USER, pass: EMAIL_APP_PASSWORD },
  });
  return transporter;
}

function isConfigured() {
  return Boolean(process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD);
}

/**
 * Sends (or, if not configured, logs) an email and always writes an
 * audit entry to notification_log — same pattern used everywhere else
 * in CareThread for AI/integration actions, so every automated
 * notification is traceable.
 */
async function sendEmail({
  toEmail,
  subject,
  message,
  html,
  kind,
  scheduledVisitId,
  recipientUserId,
}) {
  const logId = uuidv4();

  if (!isConfigured() || !toEmail) {
    const reason = !toEmail ? "no email on file" : "email not configured";
    console.log(
      `[Email skipped: ${reason}] to=${toEmail || "n/a"} kind=${kind} :: ${subject} — ${message}`,
    );
    await db.query(
      `
      INSERT INTO notification_log (id, scheduled_visit_id, recipient_user_id, channel, kind, message, status, error)
      VALUES ($1,$2,$3,'console',$4,$5,'skipped_no_credentials',$6)
      `,
      [
        logId,
        scheduledVisitId || null,
        recipientUserId || null,
        kind,
        message,
        reason,
      ],
    );
    return { sent: false, reason };
  }

  try {
    const client = getTransporter();
    await client.sendMail({
      from: `CareThread <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject,
      text: message,
      ...(html ? { html } : {}),
    });

    await db.query(
      `
      INSERT INTO notification_log (id, scheduled_visit_id, recipient_user_id, channel, kind, message, status)
      VALUES ($1,$2,$3,'email',$4,$5,'sent')
      `,
      [logId, scheduledVisitId || null, recipientUserId || null, kind, message],
    );
    return { sent: true };
  } catch (error) {
    console.error("Email send failed:", error.message);
    await db.query(
      `
      INSERT INTO notification_log (id, scheduled_visit_id, recipient_user_id, channel, kind, message, status, error)
      VALUES ($1,$2,$3,'email',$4,$5,'failed',$6)
      `,
      [
        logId,
        scheduledVisitId || null,
        recipientUserId || null,
        kind,
        message,
        error.message,
      ],
    );
    return { sent: false, reason: error.message };
  }
}

module.exports = { sendEmail, isConfigured };
