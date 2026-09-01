import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';

const STATUS_CLASS = {
  scheduled: 'badge-open',
  active: 'badge-active',
  completed: 'badge-completed',
  missed: 'badge-completed',
  cancelled: 'badge-completed',
};

export default function PatientWorkspaceView() {
  const { workspaceId } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api(`/workspaces/${workspaceId}/patient-summary`, { token })
      .then(setData)
      .catch(err => setError(err.message));
  }, [workspaceId]);

  if (error) {
    return (
      <div>
        <DashboardNav />
        <div className="container" style={{ padding: 60, textAlign: 'center' }}>
          <p className="error-box" style={{ display: 'inline-block' }}>{error}</p>
          <div><Link to="/patient" className="btn btn-secondary mt-16">Back to workspaces</Link></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <DashboardNav />
        <div className="container text-muted" style={{ padding: 60 }}>Loading…</div>
      </div>
    );
  }

  const { workspace, visits, vitals } = data;
  const upcoming = visits.filter(v => v.status === 'scheduled' || v.status === 'active').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const past = visits.filter(v => !['scheduled', 'active'].includes(v.status)).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  const trend = vitals.map((v, i) => ({
    label: `#${i + 1}`,
    systolic: v.bp_systolic,
    diastolic: v.bp_diastolic,
    sugar: v.sugar,
    spo2: v.spo2,
  }));

  return (
    <div>
      <DashboardNav title={workspace.title} />
      <div className="container" style={{ padding: '28px 32px 64px' }}>
        <Link to="/patient" className="text-muted text-sm" style={{ marginBottom: 12, display: 'inline-block' }}>← All workspaces</Link>

        <div style={{ marginBottom: 24 }}>
          <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{workspace.drug_name}</div>
          <h1 style={{ fontSize: 26, marginTop: 2 }}>{workspace.title}</h1>
        </div>

        {upcoming.length > 0 && (
          <div className="card" style={{ padding: 22, marginBottom: 24, background: 'var(--teal-light)', border: 'none' }}>
            <div className="flex justify-between items-center">
              <div>
                <div style={{ fontWeight: 700, color: 'var(--teal)' }}>Next visit</div>
                <div style={{ fontSize: 16, marginTop: 4 }}>{upcoming[0].title || 'Trial Visit'}</div>
                <div className="text-muted text-sm mt-8">{new Date(upcoming[0].scheduled_at).toLocaleString()}</div>
              </div>
              <button className="btn btn-teal" onClick={() => navigate(`/room/${upcoming[0].room_code}`)}>Join visit</button>
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 24, marginBottom: 24 }}>
          <h3 style={{ fontSize: 17, marginBottom: 16 }}>Your vitals over time</h3>
          {trend.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '30px 0', textAlign: 'center' }}>
              Your vitals will appear here after your first recorded visit.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
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

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 17, marginBottom: 16 }}>Visit history</h3>
          <div className="flex-col gap-10">
            {[...upcoming, ...past].length === 0 && <p className="text-muted text-sm">No visits yet.</p>}
            {[...upcoming, ...past].map(v => (
              <VisitHistoryRow key={v.id} v={v} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function VisitHistoryRow({ v }) {
  const [expanded, setExpanded] = useState(false);
  const hasSummary = v.status === 'completed' && v.ai_summary;

  return (
    <div style={{ borderBottom: '1px solid var(--line-soft)' }}>
      <div
        style={{ ...rowStyle, borderBottom: 'none', cursor: hasSummary ? 'pointer' : 'default' }}
        onClick={() => hasSummary && setExpanded(e => !e)}
      >
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>{v.title || 'Trial Visit'}</div>
          <div className="text-muted text-sm">{new Date(v.scheduled_at).toLocaleString()}</div>
        </div>
        <div className="flex items-center gap-8">
          {hasSummary && (
            <span className="text-sm" style={{ color: 'var(--purple)', fontWeight: 600 }}>
              {expanded ? 'Hide summary ▲' : 'View summary ▼'}
            </span>
          )}
          <span className={`badge ${STATUS_CLASS[v.status]}`}><span className="badge-dot" />{v.status}</span>
        </div>
      </div>
      {hasSummary && expanded && (
        <div style={summaryBox}>
          <div className="text-sm" style={{ fontWeight: 700, marginBottom: 4, color: 'var(--purple)' }}>
            After-visit summary
          </div>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{v.ai_summary}</p>
        </div>
      )}
    </div>
  );
}

const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px', borderBottom: '1px solid var(--line-soft)' };
const summaryBox = { padding: '12px 14px 16px', background: 'var(--purple-light)', borderRadius: 10, margin: '0 0 10px' };
