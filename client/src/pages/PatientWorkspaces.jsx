import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';

export default function PatientWorkspaces() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [workspaces, setWorkspaces] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  async function refresh() {
    const data = await api('/workspaces/patient/mine', { token });
    setWorkspaces(data.workspaces);
  }

  useEffect(() => { refresh(); }, []);

  async function handleJoin(e) {
    e.preventDefault();
    setError('');
    setJoining(true);
    try {
      await api('/workspaces/join', { method: 'POST', token, body: { code } });
      setCode('');
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setJoining(false);
    }
  }

  if (!workspaces) {
    return (
      <div>
        <DashboardNav title="Your Workspaces" />
        <div className="container text-muted" style={{ padding: 60, textAlign: 'center' }}>Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <DashboardNav title="Your Workspaces" />
      <div className="container" style={{ padding: '32px 32px 64px' }}>
        <h1 style={{ fontSize: 28, marginBottom: 6 }}>Your workspaces</h1>
        <p className="text-muted" style={{ marginBottom: 24 }}>Join a trial workspace using the code your doctor shared with you.</p>

        <div className="card" style={{ padding: 24, marginBottom: 28, maxWidth: 480 }}>
          <h3 style={{ fontSize: 17, marginBottom: 4 }}>Join a workspace</h3>
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

        {workspaces.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🧪</div>
            <h3 style={{ marginBottom: 8 }}>No workspaces yet</h3>
            <p className="text-muted">Join one with a code from your doctor to get started.</p>
          </div>
        ) : (
          <div style={wsGrid}>
            {workspaces.map(w => (
              <div key={w.id} className="card" style={wsCard} onClick={() => navigate(`/patient/workspaces/${w.id}`)}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{w.drug_name}</div>
                    <h3 style={{ fontSize: 18, marginTop: 2 }}>{w.title}</h3>
                    <div className="text-muted text-sm mt-8">Dr. {w.doctor_name}</div>
                  </div>
                  <span className={`badge ${w.status === 'active' ? 'badge-active' : 'badge-completed'}`}>
                    <span className="badge-dot" />{w.status}
                  </span>
                </div>

                {w.next_visit_at ? (
                  <div style={nextVisitBox}>
                    <div className="text-sm" style={{ fontWeight: 700, color: 'var(--teal)' }}>Next visit</div>
                    <div style={{ fontSize: 14.5, marginTop: 2 }}>{new Date(w.next_visit_at).toLocaleString()}</div>
                    <button
                      className="btn btn-teal btn-sm mt-8"
                      onClick={(e) => { e.stopPropagation(); navigate(`/room/${w.next_visit_code}`); }}
                    >
                      Join visit
                    </button>
                  </div>
                ) : (
                  <div className="text-muted text-sm mt-16">No upcoming visit scheduled.</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const wsGrid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 };
const wsCard = { padding: 22, cursor: 'pointer' };
const nextVisitBox = { marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--line-soft)' };
