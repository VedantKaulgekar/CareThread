import React, { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import { api, useAuth } from "../AuthContext.jsx";
import DashboardNav from "../components/DashboardNav.jsx";
import VideoCall from "../components/VideoCall.jsx";
import PatientVitalsForm from "../components/PatientVitalsForm.jsx";
import DoctorVitalsForm from "../components/DoctorVitalsForm.jsx";
import ChecklistPanel from "../components/ChecklistPanel.jsx";

const STATUS_CLASS = {
  scheduled: "badge-open",
  active: "badge-active",
  completed: "badge-completed",
  missed: "badge-completed",
  cancelled: "badge-completed",
};

export default function VisitRoom() {
  const { code } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [visit, setVisit] = useState(null);
  const [vitalsLog, setVitalsLog] = useState([]);
  const [checklistProgress, setChecklistProgress] = useState({});
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [checklistBlock, setChecklistBlock] = useState(null);
  const [overrideReason, setOverrideReason] = useState("");

  async function loadVisit() {
    try {
      const data = await api(`/visits/by-code/${code}`, { token });
      setVisit(data.visit);
      setChecklistProgress(data.visit.checklist_progress || {});
      const v = await api(`/vitals/visit/${data.visit.id}`, { token });
      setVitalsLog(v.vitals);
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    loadVisit();
  }, [code]);

  useEffect(() => {
    if (!visit) return;
    const socket = io("/", { path: "/socket.io" });
    socket.emit("room:join", {
      roomCode: code,
      userId: user.id,
      userName: user.name,
      role: user.role,
    });
    socket.on("vitals:new", (entry) => {
      setVitalsLog((prev) => {
        const idx = prev.findIndex((v) => v.id === entry.id);
        if (idx === -1) return [...prev, entry];
        const next = [...prev];
        next[idx] = entry;
        return next;
      });
    });
    socket.on("checklist:updated", ({ progress }) =>
      setChecklistProgress(progress),
    );
    socket.on("peer:joined", () => {
      loadVisit();
    });
    socket.on("room:completed", () => {
      navigate(user.role === "doctor" ? "/doctor" : "/patient");
    });
    return () => socket.disconnect();
  }, [visit?.id]);

  async function handleComplete(overrideBody) {
    setCompleting(true);
    setChecklistBlock(null);
    try {
      const res = await fetch(`/api/visits/by-code/${code}/complete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(overrideBody || {}),
      });
      const data = await res.json();
      if (res.status === 409) {
        setChecklistBlock(data);
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to complete visit");
      navigate("/doctor");
    } catch (e) {
      setError(e.message);
    } finally {
      setCompleting(false);
    }
  }

  function handleLeaveCall() {
    navigate(user.role === "doctor" ? "/doctor" : "/patient");
  }

  if (error) {
    return (
      <div>
        <DashboardNav />
        <div className="container" style={{ padding: 60, textAlign: "center" }}>
          <p className="error-box" style={{ display: "inline-block" }}>
            {error}
          </p>
          <div>
            <Link to="/" className="btn btn-secondary mt-16">
              Go home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!visit) {
    return (
      <div>
        <DashboardNav />
        <div className="container" style={{ padding: 60 }}>
          <p className="text-muted">Loading visit…</p>
        </div>
      </div>
    );
  }

  const isDoctor = user.role === "doctor";

  return (
    <div>
      <DashboardNav title={visit.title || visit.workspace_title} />
      <div className="container" style={{ padding: "28px 32px 64px" }}>
        <div
          className="flex justify-between items-center"
          style={{ marginBottom: 20 }}
        >
          <div>
            <div className="flex items-center gap-12">
              <h1 style={{ fontSize: 24 }}>{visit.title || "Trial Visit"}</h1>
              <span className={`badge ${STATUS_CLASS[visit.status]}`}>
                <span className="badge-dot" />
                {visit.status}
              </span>
            </div>
            <p className="text-muted text-sm mt-8">
              {visit.workspace_title} · {visit.drug_name}
              {" · "}
              {isDoctor
                ? `Patient: ${visit.patient_name}`
                : `Doctor: ${visit.doctor_name}`}
            </p>
          </div>
          {isDoctor &&
            (visit.status === "active" || visit.status === "scheduled") && (
              <button
                className="btn btn-secondary"
                onClick={() => handleComplete()}
                disabled={completing}
              >
                {completing ? "Completing…" : "Mark visit complete"}
              </button>
            )}
        </div>

        {checklistBlock && (
          <div
            className="card"
            style={{
              padding: 18,
              marginBottom: 20,
              borderColor: "var(--coral)",
              background: "var(--coral-light)",
            }}
          >
            <div
              style={{
                fontWeight: 700,
                color: "var(--coral)",
                marginBottom: 6,
              }}
            >
              Checklist incomplete
            </div>
            <p className="text-sm" style={{ marginBottom: 10 }}>
              Still missing:{" "}
              {checklistBlock.incomplete.map((i) => i.item).join(", ")}
            </p>
            <div className="flex gap-8 items-center">
              <input
                placeholder="Reason for skipping (logged as a deviation)"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1.5px solid var(--line)",
                  fontSize: 13,
                }}
              />
              <button
                className="btn btn-danger btn-sm"
                onClick={() =>
                  handleComplete({ override: true, overrideReason })
                }
                disabled={completing || !overrideReason.trim()}
              >
                Complete anyway
              </button>
            </div>
          </div>
        )}

        <div style={roomGrid}>
          <VideoCall
            roomCode={code}
            userId={user.id}
            userName={user.name}
            role={user.role}
            onLeave={handleLeaveCall}
          />

          <div className="flex-col gap-24">
            <ChecklistPanel
              visit={visit}
              isDoctor={isDoctor}
              progress={checklistProgress}
              onProgressChange={setChecklistProgress}
            />

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 14 }}>
                {isDoctor ? "Dosage & notes" : "Your vitals"}
              </h3>
              {isDoctor ? (
                <DoctorVitalsForm
                  scheduledVisitId={visit.id}
                  onSaved={loadVisit}
                />
              ) : (
                <PatientVitalsForm
                  scheduledVisitId={visit.id}
                  onSaved={loadVisit}
                />
              )}
            </div>

            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 16, marginBottom: 14 }}>Visit record</h3>
              {vitalsLog.length === 0 ? (
                <p className="text-muted text-sm">
                  No vitals recorded yet in this visit.
                </p>
              ) : (
                <div className="flex-col gap-10">
                  {vitalsLog.map((v) => (
                    <VitalEntry key={v.id} v={v} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VitalEntry({ v }) {
  const stageLabel = {
    pre_dosage: "Pre-dosage",
    post_dosage: "Post-dosage",
    general: "General",
  }[v.stage];

  const readings = [
    v.temperature && `Temp ${v.temperature}°F`,
    v.bp_systolic && v.bp_diastolic && `BP ${v.bp_systolic}/${v.bp_diastolic}`,
    v.sugar && `Sugar ${v.sugar}`,
    v.spo2 && `SpO₂ ${v.spo2}%`,
    v.heart_rate && `HR ${v.heart_rate}bpm`,
  ].filter(Boolean);

  const flags = Array.isArray(v.anomaly_flags) ? v.anomaly_flags : [];

  return (
    <div
      style={{
        padding: "10px 12px",
        border: `1px solid ${flags.length ? "var(--coral)" : "var(--line-soft)"}`,
        borderRadius: 10,
      }}
    >
      <div className="flex justify-between items-center">
        <span className="badge badge-active" style={{ fontSize: 11 }}>
          {stageLabel}
        </span>
        {flags.length > 0 && (
          <span
            className="badge"
            style={{
              fontSize: 11,
              background: "var(--coral-light)",
              color: "var(--coral)",
            }}
          >
            ⚠ {flags.length} flag{flags.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div style={{ fontSize: 13.5, marginTop: 6 }}>
        {readings.length > 0 ? (
          <>
            <span className="text-muted" style={{ fontSize: 11 }}>
              Patient readings:{" "}
            </span>
            {readings.join(" · ")}
          </>
        ) : (
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            No patient readings yet
          </span>
        )}
      </div>

      {flags.map((f, i) => (
        <div
          key={i}
          className="text-sm"
          style={{ marginTop: 4, color: "var(--coral)" }}
        >
          ⚠ {f.reason}
        </div>
      ))}

      {v.dosage_given && (
        <div
          className="text-sm"
          style={{ marginTop: 4, color: "var(--purple)" }}
        >
          💊 {v.dosage_given}
        </div>
      )}
      {v.doctor_notes && (
        <div className="text-muted text-sm" style={{ marginTop: 4 }}>
          {v.doctor_notes}
        </div>
      )}
    </div>
  );
}

const roomGrid = {
  display: "grid",
  gridTemplateColumns: "1.9fr 1fr",
  gap: 24,
  alignItems: "start",
};
