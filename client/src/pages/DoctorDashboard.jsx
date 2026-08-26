import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';

const STATUS_COLORS = { Open: '#A5680F', Active: '#0F6E56', Completed: '#8B899B' };

export default function DoctorDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [dash, setDash] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [justCreated, setJustCreated] = useState(null);
  const [joinPatientId, setJoinPatientId] = useState('all');

  async function refresh() {
    const [roomsData, dashData] = await Promise.all([
      api('/rooms/mine', { token }),
      api('/dashboard/doctor', { token }),
    ]);
    setRooms(roomsData.rooms);
    setDash(dashData);
  }

  useEffect(() => { refresh(); }, []);

  async function handleCreateRoom(e) {
    e.preventDefault();
    setCreating(true);
    try {
      const data = await api('/rooms', { method: 'POST', token, body: { title: newTitle || 'Trial Visit' } });
      setJustCreated(data.room);
      setNewTitle('');
      refresh();
    } finally {
      setCreating(false);
    }
  }

  if (!dash) {
    return (
      <div>
        <DashboardNav title="Doctor Dashboard" />
        <div className="container text-muted" style={{ padding: 60, textAlign: 'center' }}>Loading dashboard…</div>
      </div>
    );
  }

  const patientIds = [...new Set(dash.rooms.filter(r => r.patient_id).map(r => r.patient_id))];
  const trendData = dash.trend
    .filter(t => joinPatientId === 'all' || t.patient_id === joinPatientId)
    .map((t, i) => ({ ...t, idx: i + 1, label: `Visit ${i + 1}` }));

  return (
    <div>
      <DashboardNav title="Doctor Dashboard" />
      <div className="container" style={{ padding: '32px 32px 64px' }}>

        <div className="flex justify-between items-center" style={{ marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 28 }}>Your visits</h1>
            <p className="text-muted mt-8">Create a Visit Room, share the code, and track every patient's data.</p>
          </div>
        </div>

        {/* Stats row */}
        <div style={statsGrid}>
          <StatCard label="Total patients" value={dash.totalPatients} color="purple" />
          <StatCard label="Total visits" value={dash.totalVisits} color="teal" />
          <StatCard label="Active now" value={dash.activeVisits} color="amber" />
          <StatCard label="Completed" value={dash.completedVisits} color="coral" />
        </div>

        <div style={mainGrid}>
          {/* Left: create room + room list */}
          <div>
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <h3 style={{ fontSize: 17, marginBottom: 4 }}>Create a Visit Room</h3>
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Generates a join code to share with your patient.</p>
              <form onSubmit={handleCreateRoom} className="flex gap-8">
                <input
                  style={{ flex: 1, padding: '11px 14px', borderRadius: 9, border: '1.5px solid var(--line)' }}
                  placeholder="Visit label (e.g. Visit 3 — Day 21)"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
                <button className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
              </form>

              {justCreated && (
                <div style={{ marginTop: 16, background: 'var(--teal-light)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                  <div className="text-sm text-muted" style={{ marginBottom: 6 }}>Share this code with your patient</div>
                  <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: 4, color: 'var(--teal)', fontFamily: 'monospace' }}>
                    {justCreated.code}
                  </div>
                  <button className="btn btn-secondary btn-sm mt-8" onClick={() => navigate(`/room/${justCreated.code}`)}>
                    Enter room now
                  </button>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: 24 }}>
              <h3 style={{ fontSize: 17, marginBottom: 16 }}>All visit rooms</h3>
              <div className="flex-col gap-12">
                {rooms.length === 0 && <p className="text-muted text-sm">No rooms yet — create your first one above.</p>}
                {rooms.map(r => (
                  <RoomRow key={r.id} room={r} onEnter={() => navigate(`/room/${r.code}`)} />
                ))}
              </div>
            </div>
          </div>

          {/* Right: analytics */}
          <div>
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div className="flex justify-between items-center" style={{ marginBottom: 16 }}>
                <h3 style={{ fontSize: 17 }}>Vitals trend</h3>
                <select
                  value={joinPatientId}
                  onChange={e => setJoinPatientId(e.target.value)}
                  style={{ padding: '6px 10px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13 }}
                >
                  <option value="all">All patients</option>
                  {patientIds.map(pid => {
                    const room = dash.rooms.find(r => r.patient_id === pid);
                    return <option key={pid} value={pid}>{room?.patient_name || pid.slice(0, 6)}</option>;
                  })}
                </select>
              </div>
              {trendData.length === 0 ? (
                <EmptyChart text="No vitals recorded yet. Data will appear here after your first visit." />
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="systolic" stroke="#5B4FBF" strokeWidth={2} dot={{ r: 3 }} name="BP Systolic" />
                    <Line type="monotone" dataKey="diastolic" stroke="#0F6E56" strokeWidth={2} dot={{ r: 3 }} name="BP Diastolic" />
                    <Line type="monotone" dataKey="heart_rate" stroke="#C8562F" strokeWidth={2} dot={{ r: 3 }} name="Heart Rate" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Visit status</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={dash.statusBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={40}
                      outerRadius={65}
                      paddingAngle={3}
                    >
                      {dash.statusBreakdown.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.name]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontSize: 15, marginBottom: 12 }}>Averages across all visits</h3>
                <div className="flex-col gap-8" style={{ marginTop: 8 }}>
                  <AvgRow label="Temperature" value={dash.summary.avgTemperature} unit="°F" />
                  <AvgRow label="Systolic BP" value={dash.summary.avgSystolic} unit="mmHg" />
                  <AvgRow label="Diastolic BP" value={dash.summary.avgDiastolic} unit="mmHg" />
                  <AvgRow label="Blood sugar" value={dash.summary.avgSugar} unit="mg/dL" />
                  <AvgRow label="SpO₂" value={dash.summary.avgSpo2} unit="%" />
                  <AvgRow label="Heart rate" value={dash.summary.avgHeartRate} unit="bpm" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colorMap = {
    purple: 'var(--purple)', teal: 'var(--teal)', amber: 'var(--amber)', coral: 'var(--coral)',
  };
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: colorMap[color], marginTop: 4, fontFamily: 'Fraunces, serif' }}>
        {value}
      </div>
    </div>
  );
}

function RoomRow({ room, onEnter }) {
  const statusClass = room.status === 'open' ? 'badge-open' : room.status === 'active' ? 'badge-active' : 'badge-completed';
  return (
    <div style={roomRowStyle}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{room.title || 'Trial Visit'}</div>
        <div className="text-muted text-sm" style={{ marginTop: 2 }}>
          Code <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{room.code}</span>
          {room.patient_name ? ` · ${room.patient_name}` : ' · Waiting for patient'}
        </div>
      </div>
      <div className="flex items-center gap-12">
        <span className={`badge ${statusClass}`}><span className="badge-dot" />{room.status}</span>
        <button className="btn btn-secondary btn-sm" onClick={onEnter}>Enter</button>
      </div>
    </div>
  );
}

function AvgRow({ label, value, unit }) {
  return (
    <div className="flex justify-between items-center" style={{ fontSize: 14, padding: '6px 0', borderBottom: '1px solid var(--line-soft)' }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 700 }}>{value !== null ? `${value} ${unit}` : '—'}</span>
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink-soft)', fontSize: 13.5, textAlign: 'center', padding: '0 40px' }}>
      {text}
    </div>
  );
}

const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 28 };
const mainGrid = { display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 24, alignItems: 'start' };
const roomRowStyle = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '12px 14px', border: '1px solid var(--line-soft)', borderRadius: 10,
};
