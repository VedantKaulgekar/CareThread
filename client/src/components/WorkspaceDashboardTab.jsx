import React from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts';

const STATUS_COLORS = { Scheduled: '#A5680F', Active: '#0F6E56', Completed: '#8B899B', Missed: '#C8562F', Cancelled: '#D3D1C7' };

export default function WorkspaceDashboardTab({ dash }) {
  if (!dash) return <p className="text-muted" style={{ padding: 40, textAlign: 'center' }}>Loading analytics…</p>;

  const performanceData = [
    { metric: 'Temp (°F)', pre: dash.drugPerformance.preDosage.avgTemperature, post: dash.drugPerformance.postDosage.avgTemperature },
    { metric: 'Systolic', pre: dash.drugPerformance.preDosage.avgSystolic, post: dash.drugPerformance.postDosage.avgSystolic },
    { metric: 'Diastolic', pre: dash.drugPerformance.preDosage.avgDiastolic, post: dash.drugPerformance.postDosage.avgDiastolic },
    { metric: 'Sugar', pre: dash.drugPerformance.preDosage.avgSugar, post: dash.drugPerformance.postDosage.avgSugar },
    { metric: 'SpO₂', pre: dash.drugPerformance.preDosage.avgSpo2, post: dash.drugPerformance.postDosage.avgSpo2 },
    { metric: 'Heart rate', pre: dash.drugPerformance.preDosage.avgHeartRate, post: dash.drugPerformance.postDosage.avgHeartRate },
  ].filter(d => d.pre !== null || d.post !== null);

  const trendData = dash.trend.map((t, i) => ({ ...t, label: `#${i + 1}` }));

  return (
    <div>
      <div style={statsGrid}>
        <StatCard label="Enrolled patients" value={dash.patientCount} color="purple" />
        <StatCard label="Total visits" value={dash.totalVisits} color="teal" />
        <StatCard label="Upcoming" value={dash.upcomingVisits} color="amber" />
        <StatCard label="Completed" value={dash.completedVisits} color="coral" />
      </div>

      <div style={mainGrid}>
        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, marginBottom: 14 }}>Drug performance — pre vs post dosage</h3>
          <p className="text-muted text-sm" style={{ marginBottom: 12 }}>Average vitals across all patients in this workspace, before vs after dosage.</p>
          {performanceData.length === 0 ? (
            <EmptyChart text="No pre/post dosage vitals recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                <XAxis dataKey="metric" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="pre" fill="#5B4FBF" name="Pre-dosage" radius={[4, 4, 0, 0]} />
                <Bar dataKey="post" fill="#0F6E56" name="Post-dosage" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 15, marginBottom: 12 }}>Visit status</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={dash.statusBreakdown.filter(s => s.value > 0)} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                {dash.statusBreakdown.filter(s => s.value > 0).map((entry, i) => (
                  <Cell key={i} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card" style={{ padding: 24, marginTop: 20 }}>
        <h3 style={{ fontSize: 16, marginBottom: 14 }}>Vitals trend across all visits</h3>
        {trendData.length === 0 ? (
          <EmptyChart text="Vitals will appear here once visits start recording data." />
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
    </div>
  );
}

function StatCard({ label, value, color }) {
  const colorMap = { purple: 'var(--purple)', teal: 'var(--teal)', amber: 'var(--amber)', coral: 'var(--coral)' };
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: colorMap[color], marginTop: 4, fontFamily: 'Fraunces, serif' }}>{value}</div>
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

const statsGrid = { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 24 };
const mainGrid = { display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 20, alignItems: 'start' };
