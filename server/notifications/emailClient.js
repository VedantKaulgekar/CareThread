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
