import React, { useEffect, useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';
import StatCard from '../components/analytics/StatCard.jsx';
import ChartCard from '../components/analytics/ChartCard.jsx';
import DateRangeFilter from '../components/analytics/DateRangeFilter.jsx';
import Timeline from '../components/analytics/Timeline.jsx';

const VITAL_METRICS = [
  { key: 'systolic', label: 'BP Systolic', color: '#5B4FBF', unit: 'mmHg' },
  { key: 'diastolic', label: 'BP Diastolic', color: '#0F6E56', unit: 'mmHg' },
  { key: 'heart_rate', label: 'Heart Rate', color: '#C8562F', unit: 'bpm' },
  { key: 'spo2', label: 'SpO₂', color: '#A5680F', unit: '%' },
  { key: 'sugar', label: 'Glucose', color: '#3C3489', unit: 'mg/dL' },
  { key: 'temperature', label: 'Temperature', color: '#8B899B', unit: '°F' },
];

const STATUS_CLASS = { scheduled: 'badge-open', active: 'badge-active', completed: 'badge-completed', missed: 'badge-completed', cancelled: 'badge-completed' };

export default function PatientAnalyticsDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });

  useEffect(() => {
    api('/dashboard/patient/analytics', { token }).then(setData).catch(err => setError(err.message));
  }, []);

  const filteredVitalsTrend = useMemo(() => {
    if (!data) return [];
    return data.vitals.trend
      .filter(v => {
        const d = new Date(v.date);
        if (range.from && d < new Date(range.from)) return false;
        if (range.to && d > new Date(range.to + 'T23:59:59')) return false;
        return true;
      })
      .map((v, i) => ({ ...v, label: `#${i + 1}` }));
  }, [data, range]);

  const filteredAppointments = useMemo(() => {
    if (!data) return [];
    return data.appointments.list.filter(v => {
      const d = new Date(v.scheduled_at);
      if (range.from && d < new Date(range.from)) return false;
      if (range.to && d > new Date(range.to + 'T23:59:59')) return false;
      return true;
    });
  }, [data, range]);

  const insights = useMemo(() => buildInsights(data), [data]);

  if (error) {
    return (
      <div>
        <DashboardNav title="Health Analytics" />
        <div className="container" style={{ padding: 60, textAlign: 'center' }}>
          <p className="error-box" style={{ display: 'inline-block' }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <DashboardNav title="Health Analytics" />
      <div className="container" style={{ padding: '28px 32px 64px' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 26 }}>Your health analytics</h1>
          <p className="text-muted mt-8">A combined view of your appointments, vitals, and medical history across every workspace.</p>
        </div>

        <div className="analytics-stats-grid">
          <StatCard label="Total appointments" value={data?.appointments.total ?? '—'} color="purple" />
          <StatCard label="Upcoming" value={data?.appointments.upcoming ?? '—'} color="teal" />
          <StatCard label="Completed" value={data?.appointments.completed ?? '—'} color="amber" />
          <StatCard label="Cancelled / missed" value={data ? data.appointments.cancelled + data.appointments.missed : '—'} color="coral" />
        </div>

        <div style={{ marginBottom: 16 }}>
          <DateRangeFilter from={range.from} to={range.to} onChange={setRange} />
        </div>

        <ChartCard
          title="Vitals trend"
          subtitle="Readings across all your visits (filtered by date range above). Weight/BMI aren't tracked in this project yet."
          loading={!data}
          isEmpty={data && filteredVitalsTrend.length === 0}
          emptyText="Your vitals will appear here once a visit records them."
        >
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={filteredVitalsTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {VITAL_METRICS.map(m => (
                <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={{ r: 3 }} name={m.label} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="analytics-main-grid">
          <ChartCard
            title="Appointment history"
            subtitle="Appointments per month."
            loading={!data}
            isEmpty={data && data.appointments.trend.length === 0}
            emptyText="No appointment history yet."
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data?.appointments.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#5B4FBF" radius={[4, 4, 0, 0]} name="Appointments" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 14 }}>Health trend insights</h3>
            {!data ? (
              <p className="text-muted text-sm">Loading…</p>
            ) : insights.length === 0 ? (
              <p className="text-muted text-sm">Not enough recorded vitals yet to show a trend.</p>
            ) : (
              <div className="flex-col gap-10">
                {insights.map((ins, i) => (
                  <div key={i} style={insightRow}>
                    <span style={{ fontWeight: 600 }}>{ins.metric}</span>
                    <span style={{ color: ins.color }}>{ins.text}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Medication overview</h3>
          {!data ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : data.medications.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '20px 0', textAlign: 'center' }}>No active medications recorded yet.</p>
          ) : (
            <div className="flex-col gap-10">
              {data.medications.map(m => (
                <div key={m.workspace_id} style={medRow}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{m.drug_name}</div>
                    <div className="text-muted text-sm">{m.workspace_title}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 14 }}>{m.dosage_given || 'No dosage recorded yet'}</div>
                    {m.doctor_submitted_at && <div className="text-muted text-sm">Last updated {new Date(m.doctor_submitted_at).toLocaleDateString()}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Medical history timeline</h3>
          <Timeline
            emptyText="Your completed visits will show up here."
            items={(data?.medicalHistory || []).map(h => ({
              id: h.id,
              title: h.title || 'Trial visit',
              subtitle: `${h.workspace_title} · Dr. ${h.doctor_name} · ${new Date(h.completed_at || h.scheduled_at).toLocaleString()}`,
              badge: 'completed',
              badgeClass: 'badge-completed',
              detail: h.ai_summary || h.doctor_notes || null,
            }))}
          />
        </div>

        <div className="card" style={{ padding: 24, marginTop: 20 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>All appointments</h3>
          {!data ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : filteredAppointments.length === 0 ? (
            <p className="text-muted text-sm" style={{ padding: '20px 0', textAlign: 'center' }}>No appointments in this range.</p>
          ) : (
            <div className="flex-col gap-10">
              {filteredAppointments.map(v => (
                <div key={v.id} style={apptRow}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14.5 }}>{v.title || 'Trial Visit'}</div>
                    <div className="text-muted text-sm">{v.workspace_title} · Dr. {v.doctor_name}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="text-sm">{new Date(v.scheduled_at).toLocaleString()}</div>
                    <span className={`badge ${STATUS_CLASS[v.status] || 'badge-completed'}`}><span className="badge-dot" />{v.status}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildInsights(data) {
  if (!data) return [];
  const trend = data.vitals.trend;
  const insights = [];
  VITAL_METRICS.forEach(m => {
    const points = trend.map(t => t[m.key]).filter(v => v !== null && v !== undefined);
    if (points.length < 2) return;
    const delta = +(points[points.length - 1] - points[0]).toFixed(1);
    if (delta === 0) return;
    const direction = delta > 0 ? 'up' : 'down';
    insights.push({
      metric: m.label,
      text: `${direction === 'up' ? '▲' : '▼'} ${Math.abs(delta)} ${m.unit} since your first recorded reading`,
      color: direction === 'up' ? 'var(--coral)' : 'var(--teal)',
    });
  });
  return insights;
}

const insightRow = { display: 'flex', justifyContent: 'space-between', fontSize: 13.5, padding: '8px 0', borderBottom: '1px solid var(--line-soft)' };
const medRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--line-soft)' };
const apptRow = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--line-soft)' };