const db = require("../db");
const { sendEmail } = require("../notifications/emailClient");

const REMINDER_WINDOW_HOURS = 24;
const URGENT_WINDOW_HOURS = 2;
const CHECK_INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes

async function runOnce() {
  await sendReminders();
  await sendUrgentReminders();
  await flagMissedVisits();
}

async function sendReminders() {
  const result = await db.query(
    `
    SELECT sv.*, w.title AS workspace_title, p.name AS patient_name, p.email AS patient_email
    FROM scheduled_visits sv
    JOIN workspaces w ON w.id = sv.workspace_id
    JOIN users p ON p.id = sv.patient_id
    WHERE sv.status = 'scheduled'
      AND sv.reminder_sent_at IS NULL
      AND sv.scheduled_at <= NOW() + INTERVAL '${REMINDER_WINDOW_HOURS} hours'
      AND sv.scheduled_at > NOW()
    `,
  );

  for (const visit of result.rows) {
    const message = `Hi ${visit.patient_name},\n\nThis is a reminder that your ${visit.workspace_title} visit is scheduled for ${new Date(visit.scheduled_at).toLocaleString()}. Join at your visit link when it's time.\n\n— CareThread`;
    await sendEmail({
      toEmail: visit.patient_email,
      subject: `Reminder: upcoming ${visit.workspace_title} visit`,
      message,
      kind: "visit_reminder",
      scheduledVisitId: visit.id,
      recipientUserId: visit.patient_id,
    });
    await db.query(
      `UPDATE scheduled_visits SET reminder_sent_at = NOW() WHERE id = $1`,
      [visit.id],
    );
  }

  return result.rows.length;
}

async function sendUrgentReminders() {
  const result = await db.query(
    `
    SELECT sv.*, w.title AS workspace_title, p.name AS patient_name, p.email AS patient_email
    FROM scheduled_visits sv
    JOIN workspaces w ON w.id = sv.workspace_id
    JOIN users p ON p.id = sv.patient_id
    WHERE sv.status = 'scheduled'
      AND sv.urgent_reminder_sent_at IS NULL
      AND sv.scheduled_at <= NOW() + INTERVAL '${URGENT_WINDOW_HOURS} hours'
      AND sv.scheduled_at > NOW()
    `,
  );

  for (const visit of result.rows) {
    const message = `Hi ${visit.patient_name},\n\nYour ${visit.workspace_title} visit starts soon (${new Date(visit.scheduled_at).toLocaleString()}). Please be ready to join shortly.\n\n— CareThread`;
    await sendEmail({
      toEmail: visit.patient_email,
      subject: `Starting soon: ${visit.workspace_title} visit`,
      message,
      kind: "visit_urgent_reminder",
      scheduledVisitId: visit.id,
      recipientUserId: visit.patient_id,
    });
    await db.query(
      `UPDATE scheduled_visits SET urgent_reminder_sent_at = NOW() WHERE id = $1`,
      [visit.id],
    );
  }

  return result.rows.length;
}

async function flagMissedVisits() {
  const result = await db.query(
    `
    SELECT sv.*, w.title AS workspace_title, d.email AS doctor_email, p.name AS patient_name
    FROM scheduled_visits sv
    JOIN workspaces w ON w.id = sv.workspace_id
    JOIN users d ON d.id = sv.doctor_id
    JOIN users p ON p.id = sv.patient_id
    WHERE sv.status = 'scheduled'
      AND sv.coordinator_flagged_at IS NULL
      AND sv.scheduled_at < NOW()
    `,
  );

  for (const visit of result.rows) {
    const message = `Protocol deviation: ${visit.patient_name}'s ${visit.workspace_title} visit (scheduled ${new Date(visit.scheduled_at).toLocaleString()}) was missed — the window has closed without the visit starting.\n\n— CareThread`;
    await sendEmail({
      toEmail: visit.doctor_email,
      subject: `Missed visit: ${visit.patient_name} — ${visit.workspace_title}`,
      message,
      kind: "missed_visit_flag",
      scheduledVisitId: visit.id,
      recipientUserId: visit.doctor_id,
    });
    await db.query(
      `UPDATE scheduled_visits SET status = 'missed', coordinator_flagged_at = NOW() WHERE id = $1`,
      [visit.id],
    );
  }

  return result.rows.length;
}

let intervalHandle = null;

function start() {
  if (intervalHandle) return;
  intervalHandle = setInterval(() => {
    runOnce().catch((err) =>
      console.error("Visit alerting job error:", err.message),
    );
  }, CHECK_INTERVAL_MS);
  console.log(
    `Visit alerting job started (checks every ${CHECK_INTERVAL_MS / 60000} min)`,
  );
}

function stop() {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
}

module.exports = {
  runOnce,
  sendReminders,
  sendUrgentReminders,
  flagMissedVisits,
  start,
  stop,
};
