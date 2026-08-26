import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';

export default function PatientDashboard() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);
  const [data, setData] = useState(null);

  async function refresh() {
    const d = await api('/dashboard/patient', { token });
    setData(d);
  }

  useEffect(() => { refresh(); }, []);

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setJoining(true);
    try {
      const result = await api('/rooms/join', { method: 'POST', token, body: { code } });
      navigate(`/room/${result.room.code}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  if (!data) {
    return (
      <div>
        <DashboardNav title="Patient Dashboard" />
        <div className="container" style={{ padding: 60 }}><p className="text-muted">Loading…</p></div>
      </div>
    );
  }

  const trend = data.vitals.map((v, i) => ({
    label: `Visit ${i + 1}`,
    temperature: v.temperature,
    systolic: v.bp_systolic,
    diastolic: v.bp_diastolic,
    sugar: v.sugar,
    spo2: v.spo2,
  }));

  return (
    <div>
      <DashboardNav title="Patient Dashboard" />
      <div className="container" style={{ padding: '32px 32px 64px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Your visits</h1>
        <p className="text-muted" style={{ marginBottom: 24 }}>Join a Visit Room using the code your doctor shared with you.</p>

        <div style={topGrid}>
          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 17, marginBottom: 4 }}>Join a Visit Room</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Enter the 6-character code from your doctor.</p>
            {error && <div className="error-box">{error}</div>}
            <form onSubmit={handleJoin} className="flex gap-8">
              <input
                style={{ flex: 1, padding: '11px 14px', borderRadius: 9, border: '1.5px solid var(--line)', fontFamily: 'monospace', letterSpacing: 2, textTransform: 'uppercase' }}
                placeholder="ABC123"
                maxLength={6}
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
              />
              <button className="btn btn-teal" disabled={joining || code.length < 4}>{joining ? 'Joining…' : 'Join'}</button>
            </form>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 17, marginBottom: 12 }}>Visit history</h3>
            <div className="flex-col gap-8">
              {data.rooms.length === 0 && <p className="text-muted text-sm">No visits yet.</p>}
              {data.rooms.map(r => (
                <div key={r.id} style={rowStyle}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                    <div className="text-muted text-sm">{new Date(r.created_at).toLocaleDateString()}</div>
                  </div>
                  <span className={`badge ${r.status === 'open' ? 'badge-open' : r.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                    <span className="badge-dot" />{r.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <h3 style={{ fontSize: 17, marginBottom: 16 }}>Your vitals over time</h3>
          {trend.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '40px 0', textAlign: 'center' }}>
              Your vitals will appear here after your first recorded visit.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="systolic" stroke="#5B4FBF" strokeWidth={2} name="BP Systolic" />
                <Line type="monotone" dataKey="diastolic" stroke="#0F6E56" strokeWidth={2} name="BP Diastolic" />
                <Line type="monotone" dataKey="sugar" stroke="#C8562F" strokeWidth={2} name="Sugar" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

const topGrid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--line-soft)' };
