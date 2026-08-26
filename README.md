# CareThread — Virtual Clinical Trial Visit Platform

A working full-stack implementation covering:

- **Landing page** — marketing page explaining the product
- **Auth system** — sign up / log in as **Doctor** or **Patient**, with role-specific intake fields (patients enter age, gender, phone, medical conditions manually at signup)
- **Visit Rooms** — a doctor creates a Visit Room and gets a 6-character join code to share with their patient
- **Live video conferencing** — real peer-to-peer WebRTC video call between doctor and patient inside the Visit Room (no third-party service needed)
- **Manual vitals capture** — doctor records temperature, BP, sugar, SpO₂, heart rate, and dosage stage (pre-dosage / post-dosage / general) live during the call
- **Doctor dashboard** — interactive analytics: patient/visit counts, vitals trend line chart (filterable by patient), visit status pie chart, running averages across all visits
- **Patient dashboard** — join a room by code, view their own visit history and vitals trend over time

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite, React Router, Recharts, Socket.io-client |
| Backend | Node.js + Express |
| Realtime / signaling | Socket.io (used for WebRTC signaling and live vitals push) |
| Video | Native WebRTC (browser-to-browser, STUN via Google's public server) |
| Database | SQLite (via better-sqlite3) — zero setup, file-based |
| Auth | JWT (jsonwebtoken) + bcrypt password hashing |

No external paid APIs are required to run this.

---

## Project structure

```
carethread/
  server/          Express API + Socket.io signaling + SQLite
    index.js
    db.js
    package.json
  client/          React app (Vite)
    src/
      pages/       Landing, Login, Signup, DoctorDashboard, PatientDashboard, VisitRoom
      components/  DashboardNav, VideoCall, VitalsForm
    package.json
```

---

## Running it locally

You need Node.js 18+ installed.

### 1. Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Build the frontend

```bash
cd client
npm run build
```

This produces `client/dist`, which the Express server serves as static files.

### 3. Start the server

```bash
cd ../server
npm start
```

The app is now live at **http://localhost:4000** — this single server serves both the API and the frontend.

> Browsers will ask for camera/microphone permission when entering a Visit Room — allow it for the video call to work. For testing locally with two participants, open the doctor flow in one browser (or incognito window) and the patient flow in another, since each session holds its own login.

### Alternative: development mode (hot reload)

If you're actively editing the frontend, run these in two terminals instead:

```bash
# Terminal 1
cd server && npm start        # runs on :4000

# Terminal 2
cd client && npm run dev      # runs on :5173, proxies /api and /socket.io to :4000
```

Then open **http://localhost:5173**.

---

## Trying the full flow

1. Open the app, click **"I'm a Doctor"**, sign up with a name/email/password and specialization.
2. From the Doctor Dashboard, click **Create a Visit Room**, give it a label (e.g. "Visit 3 — Day 21"), and note the generated code.
3. Open a second browser/incognito window, sign up as a **Patient** (fill in age, gender, phone, medical conditions).
4. From the Patient Dashboard, enter the room code to join.
5. Both sides land in the Visit Room — allow camera/mic — the video call connects automatically.
6. The doctor fills in the **Record vitals** form (temperature, BP, sugar, SpO₂, heart rate, dosage stage) and saves — it appears instantly in the **Visit record** panel on both sides.
7. Back on the Doctor Dashboard, the vitals trend chart, averages, and visit status chart update with the new data.
8. The doctor can click **Mark visit complete** to close out the room.

---

## What's intentionally not included yet

Per the phased plan, this build covers only the core requirements (landing page, auth, Visit Rooms, video conferencing, manual vitals capture, doctor analytics dashboard). The additional AI features from the CareThread solution design — ambient scribe/auto-documentation, anomaly detection on vitals, protocol checklist enforcement, and missed-visit-window alerting — are designed but not yet wired in, to be layered on top of this working foundation next.

---

## Notes on the video calling implementation

This uses real browser WebRTC (`RTCPeerConnection`), not a mocked video — the two participants' camera/mic streams are sent directly peer-to-peer once the connection is established. Socket.io is only used to exchange the WebRTC handshake (offer/answer/ICE candidates) — no video/audio data passes through the server. This works out of the box on the same network; for participants on different networks, in some restrictive NAT setups you may occasionally need a TURN server in addition to the public STUN server already configured, which is a straightforward addition if needed later.
