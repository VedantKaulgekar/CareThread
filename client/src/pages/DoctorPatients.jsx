import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';
import SearchableTable from '../components/analytics/SearchableTable.jsx';
import Timeline from '../components/analytics/Timeline.jsx';

const BLUE = '#2563EB';
const GREEN = '#0F6E56';

const METRICS = [
  { key: 'bp_systolic', label: 'BP Systolic' },
  { key: 'bp_diastolic', label: 'BP Diastolic' },
  { key: 'heart_rate', label: 'Heart Rate' },
  { key: 'spo2', label: 'SpO2' },
  { key: 'sugar', label: 'Glucose' },
];

export default function DoctorPatients() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientDetail, setPatientDetail] = useState({});
  const [patientDetailLoading, setPatientDetailLoading] = useState(false);

  useEffect(() => {
    api('/dashboard/doctor/analytics', { token }).then(setData).catch(err => setError(err.message));
  }, []);

  const selectPatient = (patientId) => {
    if (selectedPatientId === patientId) {
      setSelectedPatientId(null);
      return;
    }
    setSelectedPatientId(patientId);
    if (!patientDetail[patientId]) {
      setPatientDetailLoading(true);
      api(`/dashboard/doctor/patients/${patientId}/vitals`, { token })
        .then(res => setPatientDetail(prev => ({ ...prev, [patientId]: res })))
        .catch(err => setPatientDetail(prev => ({ ...prev, [patientId]: { error: err.message } })))
        .finally(() => setPatientDetailLoading(false));
    }
  };

  if (error) {
    return (
      <div>
        <DashboardNav title="Patients" />
        <div className="container" style={{ padding: 60, textAlign: 'center' }}>
          <p className="error-box" style={{ display: 'inline-block' }}>{error}</p>
        </div>
      </div>
    );
  }

  const selected = selectedPatientId ? patientDetail[selectedPatientId] : null;
  const selectedVitals = selected?.vitals || [];
  const selectedChart = selected && !selected.error ? buildDosageImpact(selectedVitals) : [];
  const selectedWorkspaces = [...new Map(
    selectedVitals.map(v => [`${v.workspace_title}|${v.drug_name}`, { workspace: v.workspace_title, drug: v.drug_name }])
  ).values()];
  const observationsForSelected = (data?.patientObservations || []).filter(o => o.patientId === selectedPatientId);

  return (
    <div>
      <DashboardNav title="Patients" />
      <div className="container" style={{ padding: '28px 32px 64px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26 }}>Patient records</h1>
          <p className="text-muted mt-8">Click a patient's name to open their full record — vitals, visit history, and reported concerns.</p>
        </div>

        <div className="card" style={{ padding: 24 }}>
          {!data ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : (
            <SearchableTable
              searchPlaceholder="Search patients…"
              searchKeys={['name', 'email']}
              emptyText="No patients enrolled yet."
              rows={data.patients.list}
              onRowClick={row => selectPatient(row.id)}
              columns={[
                { key: 'name', label: 'Patient', render: r => <span style={{ fontWeight: 600, color: 'var(--purple)' }}>{r.name}</span> },
                { key: 'email', label: 'Email' },
                { key: 'enrollmentStatus', label: 'Status' },
                { key: 'joinedAt', label: 'Joined', render: r => r.joinedAt ? new Date(r.joinedAt).toLocaleDateString() : '—' },
              ]}
            />
          )}
        </div>

        {selectedPatientId && (
          <div className="card" style={{ padding: 24, marginTop: 20 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
              <h3 style={{ fontSize: 16 }}>
                Patient record — {selected?.patient?.name || '…'}
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedPatientId(null)}>Close</button>
            </div>
            {patientDetailLoading && !selected ? (
              <p className="text-muted text-sm">Loading record…</p>
            ) : selected?.error ? (
              <p className="error-box" style={{ display: 'inline-block' }}>{selected.error}</p>
            ) : (
              <>
                <div className="flex gap-16" style={{ flexWrap: 'wrap', marginBottom: 20 }}>
                  <Detail label="Age" value={selected?.patient?.age ?? '—'} />
                  <Detail label="Gender" value={selected?.patient?.gender ?? '—'} />
                  <Detail label="Medical conditions" value={selected?.patient?.medical_conditions || '—'} />
                  <Detail
                    label="Trials / drugs"
                    value={selectedWorkspaces.length ? selectedWorkspaces.map(w => w.drug).join(', ') : '—'}
                  />
                </div>

                <h4 style={{ fontSize: 14.5, marginBottom: 8 }}>Pre vs post dosage</h4>
                {selectedChart.every(d => d.pre === null && d.post === null) ? (
                  <p className="text-muted text-sm" style={{ padding: '20px 0' }}>No pre/post dosage readings recorded for this patient yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={selectedChart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                      <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="pre" fill={BLUE} radius={[4, 4, 0, 0]} name="Pre-dosage avg">
                        <LabelList dataKey="pre" position="top" fontSize={11} />
                      </Bar>
                      <Bar dataKey="post" fill={GREEN} radius={[4, 4, 0, 0]} name="Post-dosage avg">
                        <LabelList dataKey="post" position="top" fontSize={11} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}

                <h4 style={{ fontSize: 14.5, margin: '20px 0 8px' }}>Side effects &amp; observations</h4>
                {observationsForSelected.length === 0 ? (
                  <p className="text-muted text-sm" style={{ padding: '10px 0 20px' }}>No reported concerns or visit notes for this patient yet.</p>
                ) : (
                  <div className="flex-col gap-8" style={{ marginBottom: 20 }}>
                    {observationsForSelected.map((o, i) => (
                      <div key={i} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--line-soft)' }}>
                        <div className="flex items-center gap-8" style={{ flexWrap: 'wrap' }}>
                          <span className={`badge ${o.kind === 'concern' ? urgencyBadgeClass(o.urgency) : 'badge-open'}`}>
                            <span className="badge-dot" />
                            {o.kind === 'concern' ? `${o.urgency || 'unclear'} urgency` : 'doctor note'}
                          </span>
                          <span className="text-muted text-sm">{new Date(o.at).toLocaleDateString()}</span>
                        </div>
                        <p style={{ fontSize: 13.5, margin: '6px 0 0', lineHeight: 1.5 }}>{o.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                <h4 style={{ fontSize: 14.5, margin: '20px 0 8px' }}>Visit history</h4>
                <Timeline
                  emptyText="No vitals recorded for this patient yet."
                  items={selectedVitals.map(v => ({
                    id: v.id,
                    title: `${v.stage.replace('_', ' ')} · ${v.workspace_title} (${v.drug_name})`,
                    subtitle: new Date(v.scheduled_at).toLocaleString(),
                    badge: v.stage.replace('_', ' '),
                    badgeClass: v.stage === 'post_dosage' ? 'badge-active' : 'badge-open',
                    detail: [
                      v.bp_systolic != null && v.bp_diastolic != null ? `BP: ${v.bp_systolic}/${v.bp_diastolic}` : null,
                      v.heart_rate != null ? `HR: ${v.heart_rate} bpm` : null,
                      v.spo2 != null ? `SpO2: ${v.spo2}%` : null,
                      v.sugar != null ? `Glucose: ${v.sugar} mg/dL` : null,
                      v.temperature != null ? `Temp: ${v.temperature}°F` : null,
                      v.dosage_given ? `Dosage: ${v.dosage_given}` : null,
                      v.doctor_notes ? `Notes: ${v.doctor_notes}` : null,
                    ].filter(Boolean).join('  ·  ') || null,
                  }))}
                />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function buildDosageImpact(vitalsRows) {
  const avgOf = arr => (arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null);
  const pre = vitalsRows.filter(v => v.stage === 'pre_dosage');
  const post = vitalsRows.filter(v => v.stage === 'post_dosage');
  return METRICS.map(m => ({
    metric: m.label,
    pre: avgOf(pre.map(r => r[m.key]).filter(v => v !== null && v !== undefined)),
    post: avgOf(post.map(r => r[m.key]).filter(v => v !== null && v !== undefined)),
  }));
}

function urgencyBadgeClass(urgency) {
  if (urgency === 'high') return 'badge-coral';
  if (urgency === 'medium') return 'badge-amber';
  if (urgency === 'low') return 'badge-active';
  return 'badge-open';
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 15, marginTop: 2, fontWeight: 700, maxWidth: 260, overflowWrap: 'anywhere' }}>{value}</div>
    </div>
  );
}
