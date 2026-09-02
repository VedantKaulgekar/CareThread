import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList } from 'recharts';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';
import StatCard from '../components/analytics/StatCard.jsx';
import ChartCard from '../components/analytics/ChartCard.jsx';
import Timeline from '../components/analytics/Timeline.jsx';
import SearchableTable from '../components/analytics/SearchableTable.jsx';

const DOSAGE_METRIC_OPTIONS = [
  { key: 'bp_systolic', label: 'BP Systolic' },
  { key: 'bp_diastolic', label: 'BP Diastolic' },
  { key: 'heart_rate', label: 'Heart Rate' },
  { key: 'spo2', label: 'SpO2' },
  { key: 'sugar', label: 'Glucose' },
];

const BLUE = '#2563EB';
const GREEN = '#0F6E56';

export default function DoctorAnalyticsDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [drugMetric, setDrugMetric] = useState('heart_rate');
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [patientDetail, setPatientDetail] = useState({});
  const [patientDetailLoading, setPatientDetailLoading] = useState(false);

  useEffect(() => {
    api('/dashboard/doctor/analytics', { token }).then(setData).catch(err => setError(err.message));
  }, []);

  if (error) {
    return (
      <div>
        <DashboardNav title="Practice Analytics" />
        <div className="container" style={{ padding: 60, textAlign: 'center' }}>
          <p className="error-box" style={{ display: 'inline-block' }}>{error}</p>
        </div>
      </div>
    );
  }

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

  const drugChartData = data ? data.dosageImpactByDrug.filter(d => d.metricKey === drugMetric) : [];
  const observations = data?.patientObservations || [];

  const selected = selectedPatientId ? patientDetail[selectedPatientId] : null;
  const selectedVitals = selected?.vitals || [];
  const selectedPatientChart = selected && !selected.error ? buildPatientDosageImpact(selectedVitals) : [];
  const selectedAbnormal = data?.abnormalReadingsOverview.find(p => p.patientId === selectedPatientId);
  const selectedWorkspaces = [...new Map(
    selectedVitals.map(v => [`${v.workspace_title}|${v.drug_name}`, { workspace: v.workspace_title, drug: v.drug_name }])
  ).values()];

  const dosageImpactInsight = data ? biggestShiftInsight(data.dosageImpact) : null;
  const drugChartMetricLabel = DOSAGE_METRIC_OPTIONS.find(m => m.key === drugMetric)?.label || drugMetric;
  const drugImpactInsight = data ? biggestDrugShiftInsight(drugChartData, drugChartMetricLabel) : null;
  const abnormalInsightText = data ? abnormalInsight(data.abnormalReadingsOverview) : null;

  return (
    <div>
      <DashboardNav title="Practice Analytics" />
      <div className="container" style={{ padding: '28px 32px 64px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26 }}>Practice analytics</h1>
          <p className="text-muted mt-8">Patients, appointments, and workload across all of your workspaces.</p>
        </div>

        <div className="analytics-stats-grid">
          <StatCard label="Total patients" value={data?.patients.total ?? '—'} color="purple" />
          <StatCard label="Active patients" value={data?.patients.active ?? '—'} color="teal" />
          <StatCard label="New (30 days)" value={data?.patients.new ?? '—'} color="amber" />
          <StatCard label="Today's appointments" value={data?.appointments.today ?? '—'} color="coral" />
        </div>
        <div className="analytics-stats-grid" style={{ marginTop: -8 }}>
          <StatCard label="Upcoming appointments" value={data?.appointments.upcoming ?? '—'} color="teal" />
          <StatCard label="Completed appointments" value={data?.appointments.completed ?? '—'} color="purple" />
          <StatCard label="Cancelled appointments" value={data?.appointments.cancelled ?? '—'} color="coral" />
          <StatCard label="Active workspaces" value={data?.workload.activeWorkspaces ?? '—'} color="amber" />
        </div>

        <ChartCard
          title="Pre vs post dosage — vitals impact"
          subtitle="Average vitals recorded before dosing vs after dosing, across all your patients and workspaces."
          loading={!data}
          isEmpty={data && data.dosageImpact.every(d => d.pre === null && d.post === null)}
          emptyText="Record pre-dosage and post-dosage vitals on a visit to see this comparison."
        >
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data?.dosageImpact || []}>
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
          {data && (
            <p className="text-muted text-sm" style={{ marginTop: 10 }}>
              Based on {new Set(data.patientResponseOverview.filter(d => d.pre !== null || d.post !== null).map(d => d.patientId)).size} patient(s) with recorded readings.
              {dosageImpactInsight ? ` ${dosageImpactInsight}` : ''}
            </p>
          )}
        </ChartCard>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4, flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 16 }}>Pre vs post dosage — per drug</h3>
              <p className="text-muted text-sm">Which trial drugs show the biggest vitals shift after dosing.</p>
            </div>
            <select value={drugMetric} onChange={e => setDrugMetric(e.target.value)} style={selectStyle}>
              {DOSAGE_METRIC_OPTIONS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
            </select>
          </div>
          {!data ? (
            <p className="text-muted text-sm" style={{ padding: '40px 0', textAlign: 'center' }}>Loading…</p>
          ) : drugChartData.every(d => d.pre === null && d.post === null) ? (
            <p className="text-muted text-sm" style={{ padding: '40px 0', textAlign: 'center' }}>No pre/post dosage data for this metric yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={drugChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                  <XAxis dataKey="drug" tick={{ fontSize: 11 }} />
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
              {drugImpactInsight && <p className="text-muted text-sm" style={{ marginTop: 10 }}>{drugImpactInsight}</p>}
            </>
          )}
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <div style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16 }}>Side effects &amp; observations</h3>
            <p className="text-muted text-sm">Patient-reported concerns and doctor visit notes, most recent first. Click one to open that patient's record.</p>
          </div>
          {!data ? (
            <p className="text-muted text-sm" style={{ padding: '40px 0', textAlign: 'center' }}>Loading…</p>
          ) : observations.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '40px 0', textAlign: 'center' }}>No patient-reported concerns or visit notes yet.</p>
          ) : (
            <div className="flex-col gap-10">
              {observations.map((o, i) => (
                <div
                  key={i}
                  onClick={() => selectPatient(o.patientId)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '1px solid var(--line-soft)',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div className="flex items-center gap-8" style={{ flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{o.patientName}</span>
                      <span className={`badge ${o.kind === 'concern' ? urgencyBadgeClass(o.urgency) : 'badge-open'}`}>
                        <span className="badge-dot" />
                        {o.kind === 'concern' ? `${o.urgency || 'unclear'} urgency` : 'doctor note'}
                      </span>
                      <span className="text-muted text-sm">{o.workspaceTitle}</span>
                    </div>
                    <p style={{ fontSize: 13.5, margin: '6px 0 0', lineHeight: 1.5 }}>{o.text}</p>
                  </div>
                  <span className="text-muted text-sm" style={{ whiteSpace: 'nowrap' }}>
                    {new Date(o.at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Abnormal post-dosage readings overview</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
            Count of out-of-range post-dosage readings per patient (SpO2 &lt; 95, HR &gt; 100, systolic &gt; 140, diastolic &gt; 90, glucose &gt; 140). Click a bar to view that patient's observations.
          </p>
          {!data ? (
            <p className="text-muted text-sm" style={{ padding: '40px 0', textAlign: 'center' }}>Loading…</p>
          ) : data.abnormalReadingsOverview.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '40px 0', textAlign: 'center' }}>No patients enrolled yet.</p>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={Math.max(160, data.abnormalReadingsOverview.length * 34)}>
                <BarChart data={data.abnormalReadingsOverview} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="patientName" tick={{ fontSize: 11 }} width={150} />
                  <Tooltip />
                  <Bar
                    dataKey="abnormalCount"
                    fill={BLUE}
                    radius={[0, 4, 4, 0]}
                    name="Abnormal readings"
                    onClick={(entry) => selectPatient(entry.patientId)}
                    cursor="pointer"
                  >
                    <LabelList dataKey="abnormalCount" position="right" fontSize={11} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {abnormalInsightText && <p className="text-muted text-sm" style={{ marginTop: 10 }}>{abnormalInsightText}</p>}
            </>
          )}
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Patients</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Click a patient to open their full record below.</p>
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
                { key: 'name', label: 'Patient' },
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
                  <Detail label="Abnormal post-dosage readings" value={selectedAbnormal?.abnormalCount ?? 0} />
                  <Detail
                    label="Trials / drugs"
                    value={selectedWorkspaces.length ? selectedWorkspaces.map(w => w.drug).join(', ') : '—'}
                  />
                </div>

                <h4 style={{ fontSize: 14.5, marginBottom: 8 }}>Pre vs post dosage — this patient</h4>
                {selectedPatientChart.every(d => d.pre === null && d.post === null) ? (
                  <p className="text-muted text-sm" style={{ padding: '20px 0' }}>No pre/post dosage readings recorded for this patient yet.</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={selectedPatientChart}>
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
                    <p className="text-muted text-sm" style={{ margin: '10px 0 20px' }}>
                      {singlePatientInsight(selectedPatientChart, selected?.patient?.name)}
                    </p>
                  </>
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

        <ChartCard
          title="Most studied drugs / trials"
          subtitle="Distribution of your workspaces by drug."
          loading={!data}
          isEmpty={data && data.conditions.byDrug.length === 0}
          emptyText="Create a workspace to see this breakdown."
        >
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data?.conditions.byDrug || []} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
              <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
              <Tooltip />
              <Bar dataKey="value" fill={GREEN} radius={[0, 4, 4, 0]} name="Workspaces">
                <LabelList dataKey="value" position="right" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {data && data.conditions.byConditionText.length > 0 && (
          <div className="card" style={{ padding: 24, marginTop: 20 }}>
            <h3 style={{ fontSize: 16, marginBottom: 4 }}>Common reported conditions</h3>
            <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
              Best-effort grouping from patients' free-text medical conditions field — not a coded diagnosis.
            </p>
            <div className="flex gap-8" style={{ flexWrap: 'wrap' }}>
              {data.conditions.byConditionText.map((c, i) => (
                <span key={i} className="badge badge-open">{c.name} · {c.value}</span>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Doctor workload</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Averages across all your workspaces.</p>
          <div className="analytics-workload-grid">
            <Detail label="Total workspaces" value={data?.workload.totalWorkspaces ?? '—'} />
            <Detail label="Active workspaces" value={data?.workload.activeWorkspaces ?? '—'} />
            <Detail label="Avg. visits / workspace" value={data?.workload.avgVisitsPerWorkspace ?? '—'} />
            <Detail label="Avg. patients / workspace" value={data?.workload.avgPatientsPerWorkspace ?? '—'} />
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Frequently visited patients</h3>
          {!data ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : (
            <>
              <SearchableTable
                searchPlaceholder="Search patients…"
                searchKeys={['name', 'email']}
                emptyText="No patient visits recorded yet."
                rows={data.patients.frequentlyVisited}
                onRowClick={row => selectPatient(row.patient_id)}
                columns={[
                  { key: 'name', label: 'Patient' },
                  { key: 'email', label: 'Email' },
                  { key: 'visit_count', label: 'Total visits' },
                  { key: 'completed_visit_count', label: 'Completed' },
                  { key: 'last_visit_at', label: 'Last visit', render: r => r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString() : '—' },
                ]}
              />
              <p className="text-muted text-sm" style={{ marginTop: 10 }}>Click a row to view that patient's observations.</p>
            </>
          )}
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Recent activity</h3>
          <Timeline
            emptyText="Activity across your workspaces will show up here."
            items={(data?.recentActivity || []).map((a, i) => ({
              id: i,
              title: activityTitle(a),
              subtitle: `${a.workspace_title} · ${new Date(a.at).toLocaleString()}`,
              badge: activityBadge(a.type),
              badgeClass: 'badge-active',
            }))}
          />
        </div>
      </div>
    </div>
  );
}

function activityTitle(a) {
  if (a.type === 'enrollment') return `${a.patient_name} joined`;
  if (a.type === 'visit_completed') return `Visit completed with ${a.patient_name}`;
  if (a.type === 'vitals_submitted') return `${a.patient_name} submitted vitals`;
  return a.patient_name;
}

function activityBadge(type) {
  if (type === 'enrollment') return 'enrolled';
  if (type === 'visit_completed') return 'visit';
  if (type === 'vitals_submitted') return 'vitals';
  return type;
}

const selectStyle = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13, background: '#fff' };

function avgOf(arr) {
  return arr.length ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
}

function buildPatientDosageImpact(vitalsRows) {
  const metrics = [
    { key: 'bp_systolic', label: 'BP Systolic' },
    { key: 'bp_diastolic', label: 'BP Diastolic' },
    { key: 'heart_rate', label: 'Heart Rate' },
    { key: 'spo2', label: 'SpO2' },
    { key: 'sugar', label: 'Glucose' },
  ];
  const pre = vitalsRows.filter(v => v.stage === 'pre_dosage');
  const post = vitalsRows.filter(v => v.stage === 'post_dosage');
  return metrics.map(m => ({
    metric: m.label,
    pre: avgOf(pre.map(r => r[m.key]).filter(v => v !== null && v !== undefined)),
    post: avgOf(post.map(r => r[m.key]).filter(v => v !== null && v !== undefined)),
  }));
}

function biggestShiftInsight(dosageImpact) {
  const withBoth = dosageImpact.filter(d => d.pre !== null && d.post !== null);
  if (withBoth.length === 0) return null;
  const withDelta = withBoth.map(d => ({ ...d, delta: +(d.post - d.pre).toFixed(1) }));
  const top = withDelta.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
  if (top.delta === 0) return `${top.metric} shows no average change after dosing.`;
  const dir = top.delta > 0 ? 'rose' : 'dropped';
  return `${top.metric} ${dir} the most after dosing (${top.delta > 0 ? '+' : ''}${top.delta}).`;
}

function biggestDrugShiftInsight(drugChartData, metricLabel) {
  const withBoth = drugChartData.filter(d => d.pre !== null && d.post !== null);
  if (withBoth.length === 0) return null;
  if (withBoth.length === 1) {
    return `${withBoth[0].drug} is the only drug with pre/post ${metricLabel} data so far.`;
  }
  const withDelta = withBoth.map(d => ({ ...d, delta: +(d.post - d.pre).toFixed(1) })).sort(
    (a, b) => Math.abs(b.delta) - Math.abs(a.delta),
  );
  const top = withDelta[0];
  const bottom = withDelta[withDelta.length - 1];
  return `${top.drug} shows the largest ${metricLabel} shift after dosing (${top.delta > 0 ? '+' : ''}${top.delta}); ${bottom.drug} shows the smallest (${bottom.delta > 0 ? '+' : ''}${bottom.delta}).`;
}

function urgencyBadgeClass(urgency) {
  if (urgency === 'high') return 'badge-coral';
  if (urgency === 'medium') return 'badge-amber';
  if (urgency === 'low') return 'badge-active';
  return 'badge-open';
}

function abnormalInsight(abnormalReadingsOverview) {
  const flagged = abnormalReadingsOverview.filter(p => p.abnormalCount >= 2);
  if (flagged.length === 0) return 'No patients currently have repeated (2+) abnormal post-dosage readings.';
  const names = flagged.slice(0, 3).map(p => p.patientName).join(', ');
  return flagged.length > 3
    ? `${flagged.length} patients have 2 or more abnormal post-dosage readings, including ${names}.`
    : `${flagged.length} patient(s) have 2 or more abnormal post-dosage readings: ${names}.`;
}

function singlePatientInsight(chartData, patientName) {
  const withBoth = chartData.filter(d => d.pre !== null && d.post !== null);
  if (withBoth.length === 0) return `No pre/post comparison available for ${patientName || 'this patient'} yet.`;
  const withDelta = withBoth.map(d => ({ ...d, delta: +(d.post - d.pre).toFixed(1) }));
  const top = withDelta.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
  if (top.delta === 0) return `${patientName || 'This patient'} shows no notable change across recorded vitals.`;
  const dir = top.delta > 0 ? 'rose' : 'dropped';
  return `${top.metric} ${dir} the most for ${patientName || 'this patient'} after dosing (${top.delta > 0 ? '+' : ''}${top.delta}).`;
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, marginTop: 2, fontWeight: 700 }}>{value}</div>
    </div>
  );
}