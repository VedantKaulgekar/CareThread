import React, { useEffect, useState } from 'react';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { api, useAuth } from '../AuthContext.jsx';
import DashboardNav from '../components/DashboardNav.jsx';
import StatCard from '../components/analytics/StatCard.jsx';
import ChartCard from '../components/analytics/ChartCard.jsx';
import Timeline from '../components/analytics/Timeline.jsx';
import SearchableTable from '../components/analytics/SearchableTable.jsx';

const GENDER_COLORS = ['#5B4FBF', '#0F6E56', '#C8562F', '#A5680F', '#8B899B'];

export default function DoctorAnalyticsDashboard() {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

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

  const genderData = data ? Object.entries(data.patients.demographics.gender).map(([name, value]) => ({ name, value })) : [];
  const ageData = data ? Object.entries(data.patients.demographics.ageBuckets).map(([name, value]) => ({ name, value })) : [];

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

        <div className="analytics-main-grid-even">
          <ChartCard
            title="Patient growth"
            subtitle="New enrollments per month across all workspaces."
            loading={!data}
            isEmpty={data && data.patients.growth.length === 0}
            emptyText="Enrollments will appear here once patients join."
          >
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={data?.patients.growth || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#5B4FBF" strokeWidth={2} dot={{ r: 3 }} name="New patients" />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Appointment trends"
            subtitle="Appointments scheduled per month."
            loading={!data}
            isEmpty={data && data.appointments.trend.length === 0}
            emptyText="No appointment history yet."
          >
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={data?.appointments.trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#0F6E56" radius={[4, 4, 0, 0]} name="Appointments" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="analytics-main-grid-even">
          <ChartCard
            title="Patient demographics — gender"
            loading={!data}
            isEmpty={data && genderData.length === 0}
            emptyText="No gender data recorded for your patients yet."
            height={220}
          >
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" innerRadius={40} outerRadius={70} paddingAngle={3}>
                  {genderData.map((entry, i) => <Cell key={i} fill={GENDER_COLORS[i % GENDER_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Patient demographics — age"
            loading={!data}
            isEmpty={data && ageData.every(a => a.value === 0)}
            emptyText="No age data recorded for your patients yet."
            height={220}
          >
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EFEDE4" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#A5680F" radius={[4, 4, 0, 0]} name="Patients" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

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
              <Bar dataKey="value" fill="#5B4FBF" radius={[0, 4, 4, 0]} name="Workspaces" />
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
            <SearchableTable
              searchPlaceholder="Search patients…"
              searchKeys={['name', 'email']}
              emptyText="No patient visits recorded yet."
              rows={data.patients.frequentlyVisited}
              columns={[
                { key: 'name', label: 'Patient' },
                { key: 'email', label: 'Email' },
                { key: 'visit_count', label: 'Total visits' },
                { key: 'completed_visit_count', label: 'Completed' },
                { key: 'last_visit_at', label: 'Last visit', render: r => r.last_visit_at ? new Date(r.last_visit_at).toLocaleDateString() : '—' },
              ]}
            />
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

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 18, marginTop: 2, fontWeight: 700 }}>{value}</div>
    </div>
  );
}