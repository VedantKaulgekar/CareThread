import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';
import WorkspaceDashboardTab from '../components/WorkspaceDashboardTab.jsx';
import WorkspacePatientsTab from '../components/WorkspacePatientsTab.jsx';
import WorkspaceScheduleTab from '../components/WorkspaceScheduleTab.jsx';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'patients', label: 'Patients' },
  { key: 'schedule', label: 'Schedule' },
];

export default function WorkspaceDetail() {
  const { workspaceId } = useParams();
  const { token } = useAuth();
  const [tab, setTab] = useState('dashboard');
  const [workspace, setWorkspace] = useState(null);
  const [dash, setDash] = useState(null);
  const [patients, setPatients] = useState(null);
  const [visits, setVisits] = useState(null);
  const [error, setError] = useState('');

  async function loadWorkspace() {
    try {
      const data = await api(`/workspaces/${workspaceId}`, { token });
      setWorkspace(data.workspace);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadDashboard() {
    const data = await api(`/workspaces/${workspaceId}/dashboard`, { token });
    setDash(data);
  }

  async function loadPatients() {
    const data = await api(`/workspaces/${workspaceId}/patients`, { token });
    setPatients(data.patients);
  }

  async function loadVisits() {
    const data = await api(`/workspaces/${workspaceId}/visits`, { token });
    setVisits(data.visits);
  }

  useEffect(() => { loadWorkspace(); }, [workspaceId]);

  useEffect(() => {
    if (!workspace) return;
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'patients') loadPatients();
    if (tab === 'schedule') { loadPatients(); loadVisits(); }
  }, [tab, workspace]);

  if (error) {
    return (
      <div>
        <DashboardNav />
        <div className="container" style={{ padding: 60, textAlign: 'center' }}>
          <p className="error-box" style={{ display: 'inline-block' }}>{error}</p>
          <div><Link to="/doctor" className="btn btn-secondary mt-16">Back to workspaces</Link></div>
        </div>
      </div>
    );
  }

  if (!workspace) {
    return (
      <div>
        <DashboardNav />
        <div className="container text-muted" style={{ padding: 60 }}>Loading workspace…</div>
      </div>
    );
  }

  return (
    <div>
      <DashboardNav title={workspace.title} />
      <div className="container" style={{ padding: '28px 32px 64px' }}>
        <Link to="/doctor" className="text-muted text-sm" style={{ marginBottom: 12, display: 'inline-block' }}>← All workspaces</Link>

        <div className="flex justify-between items-start" style={{ marginBottom: 24 }}>
          <div>
            <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{workspace.drug_name}</div>
            <h1 style={{ fontSize: 26, marginTop: 2 }}>{workspace.title}</h1>
            {workspace.description && <p className="text-muted mt-8" style={{ maxWidth: 520 }}>{workspace.description}</p>}
          </div>
          <div style={codeBox}>
            <div className="text-sm text-muted">Join code</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 20, color: 'var(--purple)' }}>{workspace.code}</div>
          </div>
        </div>

        <div style={tabBar}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{ ...tabBtn, ...(tab === t.key ? tabBtnActive : {}) }}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {tab === 'dashboard' && <WorkspaceDashboardTab dash={dash} />}
          {tab === 'patients' && <WorkspacePatientsTab patients={patients} />}
          {tab === 'schedule' && (
            <WorkspaceScheduleTab
              workspaceId={workspaceId}
              patients={patients}
              visits={visits}
              onChanged={() => { loadVisits(); loadPatients(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const codeBox = { textAlign: 'right', background: 'var(--purple-light)', padding: '10px 18px', borderRadius: 12 };
const tabBar = { display: 'flex', gap: 4, borderBottom: '1.5px solid var(--line-soft)' };
const tabBtn = {
  padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
  fontSize: 14.5, fontWeight: 600, color: 'var(--ink-soft)',
  borderBottom: '2px solid transparent', marginBottom: -1.5,
};
const tabBtnActive = { color: 'var(--purple)', borderBottom: '2px solid var(--purple)' };
