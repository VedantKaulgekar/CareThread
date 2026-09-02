# CareThread — Virtual Clinical Trial Visit Platform

A working full-stack implementation covering:

- **Landing page** — marketing page explaining the product
- **Auth system** — sign up / log in as **Doctor** or **Patient**, with role-specific intake fields
- **Workspaces** — a doctor creates a workspace (drug/protocol) and enrolls patients into it
- **Scheduled visits** — visits are scheduled per patient within a workspace, with status tracking (scheduled / active / completed / missed / cancelled)
- **Live video conferencing** — real peer-to-peer WebRTC video call between doctor and patient during a visit (no third-party service needed)
- **Manual vitals capture** — doctor records temperature, BP, sugar, SpO₂, heart rate, and dosage stage (pre-dosage / post-dosage / general) live during the call
- **Doctor dashboard** — cross-workspace overview (patients, visits, upcoming/completed counts), a per-workspace analytics tab, vitals trend and visit-status charts, filterable by date range and patient, plus an out-of-range vitals alert panel
- **Patient dashboard** — join a visit by code, view visit history, adherence rate, a multi-metric vitals trend chart, a pre-vs-post-dosage comparison chart, and the same alerts panel

---

## Tech stack

| Layer                | Technology                                                             |
| -------------------- | ---------------------------------------------------------------------- |
| Frontend             | React 18 + Vite, React Router, Recharts, React Icons, Socket.io-client |
| Backend              | Node.js + Express                                                      |
| Realtime / signaling | Socket.io (WebRTC signaling and live vitals push)                      |
| Video                | Native WebRTC (browser-to-browser, STUN via Google's public server)    |
| Database             | PostgreSQL via Supabase (`pg` driver)                                  |
| Auth                 | JWT (jsonwebtoken) + bcrypt password hashing                           |

---

## Project structure

```
CareThread/
  server/                Express API + Socket.io signaling
    index.js
    db.js                Postgres connection pool
    ai/
    mcp/
    .env                 DATABASE_URL and other secrets (not committed)
  client/                React app (Vite)
    src/
      pages/              Landing, Login, Signup, DoctorDashboard, PatientDashboard, VisitRoom
      components/         DashboardNav, VideoCall, VitalsForm, WorkspaceDashboardTab,
                           DashboardFilters, AlertsPanel
      utils/               vitalsAlerts.js — normal-range checks and date-range filtering
  supabase/
    migrations/            schema history (workspaces, scheduled_visits, vitals, users)
```

---

## Running it locally

You need Node.js 18+ and a Postgres database (a free Supabase project works well).

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Configure the database

Create `server/.env` with:

```
DATABASE_URL=postgres://<user>:<password>@<host>:<port>/<database>
```

Apply the migrations in `supabase/migrations/` to that database (via the Supabase CLI, or by running the SQL files directly against your Postgres instance).

### 3. Build the frontend

```bash
cd client
npm run build
```

This produces `client/dist`, which the Express server serves as static files.

### 4. Start the server

```bash
cd ../server
npm start
```

The app is now live at **http://localhost:4000** — this single server serves both the API and the frontend.

> Browsers will ask for camera/microphone permission when entering a visit — allow it for the video call to work. For testing locally with two participants, open the doctor flow in one browser (or incognito window) and the patient flow in another.

### Alternative: development mode (hot reload)

```bash
# Terminal 1
cd server && npm start        # runs on :4000

# Terminal 2
cd client && npm run dev      # runs on :5173, proxies /api and /socket.io to :4000
```

Then open **http://localhost:5173**.

---

## Trying the full flow

1. Sign up as a **Doctor**, create a workspace (e.g. "Metformin — Phase II"), and enroll a patient into it.
2. Schedule a visit for that patient and share the generated room code.
3. Sign up as a **Patient** in a second browser/incognito window and join with that code.
4. Both sides land in the visit room — allow camera/mic — the video call connects automatically.
5. The doctor records vitals (temperature, BP, sugar, SpO₂, heart rate, dosage stage) — it appears instantly on both sides.
6. On the Doctor Dashboard, the workspace tab's trend charts, pre/post-dosage comparison, and status pie chart update with the new data; any out-of-range reading surfaces in the alerts panel.
7. On the Patient Dashboard, the same visit shows up in visit history, adherence %, and the vitals trend chart.
8. The doctor marks the visit complete to close it out.

---

## Dashboard features

- **Date-range filters** (7d / 30d / 90d / All) on every analytics view.
- **Patient filter** on the doctor's workspace tab, to isolate one patient's trend.
- **Alerts panel** — flags readings outside normal clinical ranges (defined in `client/src/utils/vitalsAlerts.js`), split into warning vs. critical severity.
- **Pre vs. post dosage comparison** chart on both dashboards, showing the drug's measured effect.
- **Adherence rate** on the patient dashboard (completed vs. missed/completed visits).

---

## Notes on the video calling implementation

This uses real browser WebRTC (`RTCPeerConnection`), not a mocked video — the two participants' camera/mic streams are sent directly peer-to-peer once the connection is established. Socket.io is only used to exchange the WebRTC handshake (offer/answer/ICE candidates) — no video/audio data passes through the server. This works out of the box on the same network; for participants on different networks, in some restrictive NAT setups you may occasionally need a TURN server in addition to the public STUN server already configured.
