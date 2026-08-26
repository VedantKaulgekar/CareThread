import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';
import VideoCall from '../components/VideoCall.jsx';
import VitalsForm from '../components/VitalsForm.jsx';

export default function VisitRoom() {
  const { code } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [vitalsLog, setVitalsLog] = useState([]);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState(false);

  async function loadRoom() {
    try {
      const data = await api(`/rooms/${code}`, { token });
      setRoom(data.room);
      if (data.room.patient_id) {
        const v = await api(`/vitals/room/${data.room.id}`, { token });
        setVitalsLog(v.vitals);
      }
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => { loadRoom(); }, [code]);

  useEffect(() => {
    if (!room) return;
    const socket = io('/', { path: '/socket.io' });
    socket.emit('room:join', { roomCode: code, userId: user.id, userName: user.name, role: user.role });
    socket.on('vitals:new', (entry) => {
      setVitalsLog(prev => [...prev, entry]);
    });
    return () => socket.disconnect();
  }, [room?.id]);

  async function handleComplete() {
    setCompleting(true);
    try {
      await api(`/rooms/${code}/complete`, { method: 'POST', token });
      navigate('/doctor');
    } finally {
      setCompleting(false);
    }
  }

  if (error) {
    return (
      <div>
        <DashboardNav />
        <div className="container" style={{ padding: 60, textAlign: 'center' }}>
          <p className="error-box" style={{ display: 'inline-block' }}>{error}</p>
          <div><Link to="/" className="btn btn-secondary mt-16">Go home</Link></div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div>
        <DashboardNav />
        <div className="container" style={{ padding: 60 }}><p className="text-muted">Loading room…</p></div>
      </div>
    );
  }

  const isDoctor = user.role === 'doctor';
  const waitingForPatient = isDoctor && !room.patient_id;

  return (
    <div>
      <DashboardNav title={room.title} />
      <div className="container" style={{ padding: '28px 32px 64px' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
          <div>
            <div className="flex items-center gap-12">
              <h1 style={{ fontSize: 24 }}>{room.title}</h1>
              <span className={`badge ${room.status === 'open' ? 'badge-open' : room.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                <span className="badge-dot" />{room.status}
              </span>
            </div>
            <p className="text-muted text-sm mt-8">
              Code <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{room.code}</span>
              {isDoctor ? ` · Patient: ${room.patient_name || 'Not joined yet'}` : ` · Doctor: ${room.doctor_name}`}
            </p>
          </div>
          {isDoctor && room.status === 'active' && (
            <button className="btn btn-secondary" onClick={handleComplete} disabled={completing}>
              {completing ? 'Completing…' : 'Mark visit complete'}
            </button>
          )}
        </div>

        {waitingForPatient ? (
          <div className="card" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <h3 style={{ marginBottom: 8 }}>Waiting for your patient</h3>
            <p className="text-muted" style={{ marginBottom: 20 }}>Share this code so they can join the visit:</p>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: 6, color: 'var(--purple)', fontFamily: 'monospace' }}>{room.code}</div>
          </div>
        ) : (
          <div style={roomGrid}>
            <VideoCall roomCode={code} userId={user.id} userName={user.name} role={user.role} />

            <div className="flex-col gap-24">
              {isDoctor && (
                <div className="card" style={{ padding: 20 }}>
                  <h3 style={{ fontSize: 16, marginBottom: 14 }}>Record vitals</h3>
                  <VitalsForm roomId={room.id} patientId={room.patient_id} onSaved={loadRoom} />
                </div>
              )}

              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontSize: 16, marginBottom: 14 }}>Visit record</h3>
                {vitalsLog.length === 0 ? (
                  <p className="text-muted text-sm">No vitals recorded yet in this visit.</p>
                ) : (
                  <div className="flex-col gap-10">
                    {vitalsLog.map(v => <VitalEntry key={v.id} v={v} />)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function VitalEntry({ v }) {
  const stageLabel = { pre_dosage: 'Pre-dosage', post_dosage: 'Post-dosage', general: 'General' }[v.stage];
  const items = [
    v.temperature && `Temp ${v.temperature}°F`,
    (v.bp_systolic && v.bp_diastolic) && `BP ${v.bp_systolic}/${v.bp_diastolic}`,
    v.sugar && `Sugar ${v.sugar}`,
    v.spo2 && `SpO₂ ${v.spo2}%`,
    v.heart_rate && `HR ${v.heart_rate}bpm`,
  ].filter(Boolean);

  return (
    <div style={{ padding: '10px 12px', border: '1px solid var(--line-soft)', borderRadius: 10 }}>
      <div className="flex justify-between items-center">
        <span className="badge badge-active" style={{ fontSize: 11 }}>{stageLabel}</span>
        <span className="text-muted" style={{ fontSize: 11 }}>{new Date(v.recorded_at).toLocaleTimeString()}</span>
      </div>
      <div style={{ fontSize: 13.5, marginTop: 6 }}>{items.join(' · ') || '—'}</div>
      {v.dosage_given && <div className="text-sm" style={{ marginTop: 4, color: 'var(--purple)' }}>💊 {v.dosage_given}</div>}
      {v.notes && <div className="text-muted text-sm" style={{ marginTop: 4 }}>{v.notes}</div>}
    </div>
  );
}

const roomGrid = { display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 24, alignItems: 'start' };
