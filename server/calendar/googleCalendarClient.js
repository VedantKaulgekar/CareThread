const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function isConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET &&
    process.env.GOOGLE_REDIRECT_URI,
  );
}

function requireConfigured() {
  if (!isConfigured()) {
    const err = new Error(
      "Google Calendar isn't configured yet. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in server/.env.",
    );
    err.code = "CALENDAR_NOT_CONFIGURED";
    throw err;
  }
}

function newOAuthClient() {
  requireConfigured();
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

function getAuthUrl(state) {
  const client = newOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

async function handleOAuthCallback(userId, code) {
  const client = newOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Google did not return a refresh token. Revoke CareThread's access in your Google Account and try connecting again.",
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: profile } = await oauth2.userinfo.get();

  await db.query(
    `
    INSERT INTO calendar_connections (id, user_id, provider, refresh_token, email)
    VALUES ($1,$2,'google',$3,$4)
    ON CONFLICT (user_id) DO UPDATE SET refresh_token = EXCLUDED.refresh_token, email = EXCLUDED.email
    `,
    [uuidv4(), userId, tokens.refresh_token, profile.email || null],
  );

  return { email: profile.email || null };
}

async function getClientForUser(userId) {
  requireConfigured();
  const result = await db.query(
    `SELECT refresh_token FROM calendar_connections WHERE user_id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;

  const client = newOAuthClient();
  client.setCredentials({ refresh_token: row.refresh_token });
  return client;
}

async function isConnected(userId) {
  const result = await db.query(
    `SELECT 1 FROM calendar_connections WHERE user_id = $1`,
    [userId],
  );
  return result.rows.length > 0;
}

async function disconnect(userId) {
  await db.query(`DELETE FROM calendar_connections WHERE user_id = $1`, [
    userId,
  ]);
}

async function syncVisitEvent({
  userId,
  scheduledVisitId,
  title,
  description,
  startTime,
  durationMinutes = 30,
}) {
  if (!isConfigured()) return { synced: false, reason: "not_configured" };

  const client = await getClientForUser(userId);
  if (!client) return { synced: false, reason: "not_connected" };

  const calendar = google.calendar({ version: "v3", auth: client });
  const start = new Date(startTime);
  const end = new Date(start.getTime() + durationMinutes * 60000);

  const eventBody = {
    summary: title,
    description: description || "",
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
  };

  const existing = await db.query(
    `SELECT external_event_id FROM calendar_events WHERE scheduled_visit_id = $1 AND user_id = $2`,
    [scheduledVisitId, userId],
  );

  if (existing.rows.length > 0) {
    await calendar.events.update({
      calendarId: "primary",
      eventId: existing.rows[0].external_event_id,
      requestBody: eventBody,
    });
    return { synced: true, updated: true };
  }

  const { data } = await calendar.events.insert({
    calendarId: "primary",
    requestBody: eventBody,
  });

  await db.query(
    `INSERT INTO calendar_events (id, scheduled_visit_id, user_id, external_event_id) VALUES ($1,$2,$3,$4)`,
    [uuidv4(), scheduledVisitId, userId, data.id],
  );

  return { synced: true, updated: false };
}

module.exports = {
  isConfigured,
  getAuthUrl,
  handleOAuthCallback,
  isConnected,
  disconnect,
  syncVisitEvent,
};
