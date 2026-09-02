/**
 * Sends the "visit scheduled" email — fires on every single visit
 * scheduling event (not just high-urgency ones), to both the doctor and
 * the patient, so both have a paper trail with the join link.
 *
 * Subject format: "[Sender Name (Doctor/Patient)] from CareThread"
 * where the sender is whoever scheduled the visit (always the doctor,
 * since only doctors can schedule — but written generically in case that
 * ever changes).
 */

const emailClient = require("./emailClient");

function formatWhen(scheduledAt) {
  const d = new Date(scheduledAt);
  return d.toLocaleString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildSubject({ senderName, senderRole }) {
  const roleLabel = senderRole === "doctor" ? "Doctor" : "Patient";
  return `[${senderName} (${roleLabel})] from CareThread`;
}

function buildText({
  senderName,
  senderRole,
  workspaceTitle,
  drugName,
  visitTitle,
  whenText,
  doctorName,
  patientName,
  roomCode,
  joinUrl,
}) {
  return `Hi,

${senderName} (${senderRole === "doctor" ? "Doctor" : "Patient"}) has scheduled a visit on CareThread.

Visit: ${visitTitle}
Trial: ${workspaceTitle} (${drugName})
Doctor: ${doctorName}
Patient: ${patientName}
When: ${whenText}
Room code: ${roomCode}
Join link: ${joinUrl}

You can also open this visit any time from your CareThread dashboard.

— CareThread`;
}

function buildHtml({
  senderName,
  senderRole,
  workspaceTitle,
  drugName,
  visitTitle,
  whenText,
  doctorName,
  patientName,
  roomCode,
  joinUrl,
}) {
  const row = (label, value) => `
    <tr>
      <td style="padding:6px 0;color:#6b6f8a;font-size:13px;width:120px;vertical-align:top;">${label}</td>
      <td style="padding:6px 0;color:#1a1a2e;font-size:14px;font-weight:600;">${value}</td>
    </tr>`;

  return `
  <div style="background:#f4f2fb;padding:32px 16px;font-family:Georgia,'Times New Roman',serif;">
    <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e1f5;">
      <div style="background:#4b3ea8;padding:22px 28px;">
        <span style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:0.2px;">CareThread</span>
      </div>
      <div style="padding:28px;">
        <p style="margin:0 0 18px;color:#1a1a2e;font-size:15px;">
          <strong>${senderName}</strong> (${senderRole === "doctor" ? "Doctor" : "Patient"}) has scheduled a visit.
        </p>
        <table cellpadding="0" cellspacing="0" style="width:100%;border-top:1px solid #eeeaf8;border-bottom:1px solid #eeeaf8;">
          ${row("Visit", visitTitle)}
          ${row("Trial", `${workspaceTitle} (${drugName})`)}
          ${row("Doctor", doctorName)}
          ${row("Patient", patientName)}
          ${row("When", whenText)}
          ${row("Room code", roomCode)}
        </table>
        <div style="text-align:center;margin-top:26px;">
          <a href="${joinUrl}" style="display:inline-block;background:#4b3ea8;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 28px;border-radius:8px;">
            Open visit room
          </a>
        </div>
        <p style="margin:26px 0 0;color:#9490b8;font-size:12px;text-align:center;">
          Sent automatically by CareThread when a visit is scheduled.
        </p>
      </div>
    </div>
  </div>`;
}

/**
 * Fire-and-forget-safe: never throws. Sends to both the doctor and the
 * patient. Each call to emailClient.sendEmail already no-ops cleanly and
 * logs to notification_log if email isn't configured.
 */
async function sendVisitScheduledEmails({
  visit,
  workspaceTitle,
  drugName,
  doctor,
  patient,
  senderRole = "doctor",
  appUrl = "",
}) {
  const senderName = senderRole === "doctor" ? doctor?.name : patient?.name;
  const subject = buildSubject({
    senderName: senderName || "CareThread",
    senderRole,
  });
  const whenText = formatWhen(visit.scheduled_at);
  const joinUrl = `${appUrl}/room/${visit.room_code}`;

  const shared = {
    senderName: senderName || "CareThread",
    senderRole,
    workspaceTitle,
    drugName,
    visitTitle: visit.title || "Trial Visit",
    whenText,
    doctorName: doctor?.name || "Doctor",
    patientName: patient?.name || "Patient",
    roomCode: visit.room_code,
    joinUrl,
  };

  const message = buildText(shared);
  const html = buildHtml(shared);

  const results = await Promise.all([
    emailClient.sendEmail({
      toEmail: doctor?.email,
      subject,
      message,
      html,
      kind: "visit_scheduled",
      scheduledVisitId: visit.id,
      recipientUserId: doctor?.id,
    }),
    emailClient.sendEmail({
      toEmail: patient?.email,
      subject,
      message,
      html,
      kind: "visit_scheduled",
      scheduledVisitId: visit.id,
      recipientUserId: patient?.id,
    }),
  ]);

  return { doctorResult: results[0], patientResult: results[1] };
}

module.exports = { sendVisitScheduledEmails };
