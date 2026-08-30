import React from 'react';

export default function WorkspacePatientsTab({ patients }) {
  if (!patients) return <p className="text-muted" style={{ padding: 40, textAlign: 'center' }}>Loading patients…</p>;

  if (patients.length === 0) {
    return (
      <div className="card" style={{ padding: 48, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>👥</div>
        <h3 style={{ marginBottom: 8 }}>No patients enrolled yet</h3>
        <p className="text-muted">Share the workspace's join code with your patients to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-col gap-14">
      {patients.map(p => (
        <div key={p.id} className="card" style={{ padding: 20 }}>
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-12">
                <div style={avatarStyle}>{p.name?.[0]?.toUpperCase()}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                  <div className="text-muted text-sm">{p.email}</div>
                </div>
              </div>
            </div>
            <span className={`badge ${p.enrollment_status === 'active' ? 'badge-active' : 'badge-completed'}`}>
              <span className="badge-dot" />{p.enrollment_status}
            </span>
          </div>

          <div style={detailsGrid}>
            <Detail label="Age" value={p.age ?? '—'} />
            <Detail label="Gender" value={p.gender || '—'} />
            <Detail label="Phone" value={p.phone || '—'} />
            <Detail label="Joined" value={new Date(p.joined_at).toLocaleDateString()} />
            <Detail label="Visits" value={`${p.completed_visit_count} / ${p.visit_count} completed`} />
            <Detail label="Next visit" value={p.next_visit_at ? new Date(p.next_visit_at).toLocaleString() : 'None scheduled'} />
          </div>

          {p.medical_conditions && (
            <div style={conditionsBox}>
              <div className="text-sm" style={{ fontWeight: 600, marginBottom: 4 }}>Medical conditions / medication</div>
              <div className="text-sm text-muted">{p.medical_conditions}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 14, marginTop: 2 }}>{value}</div>
    </div>
  );
}

const avatarStyle = {
  width: 40, height: 40, borderRadius: '50%', background: 'var(--teal)', color: 'white',
  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700,
};
const detailsGrid = { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginTop: 18 };
const conditionsBox = { marginTop: 14, padding: 12, background: 'var(--paper)', borderRadius: 10, border: '1px solid var(--line-soft)' };
