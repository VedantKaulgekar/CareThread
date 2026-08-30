import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';

const STATUS_CLASS = {
  scheduled: 'badge-open',
  active: 'badge-active',
  completed: 'badge-completed',
  missed: 'badge-completed',
  cancelled: 'badge-completed',
};

export default function WorkspaceScheduleTab({ workspaceId, patients, visits, onChanged }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patient_id: '', scheduled_at: '', title: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const activePatients = (patients || []).filter(p => p.enrollment_status === 'active');

  async function handleSchedule(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api(`/workspaces/${workspaceId}/visits`, {
        method: 'POST',
        token,
        body: { ...form, scheduled_at: new Date(form.scheduled_at).toISOString() },
      });
      setForm({ patient_id: '', scheduled_at: '', title: '' });
      setShowForm(false);
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(visitId) {
    await api(`/visits/${visitId}`, { method: 'PUT', token, body: { status: 'cancelled' } });
    onChanged?.();
  }

  if (!visits) return <p className="text-muted" style={{ padding: 40, textAlign: 'center' }}>Loading schedule…</p>;

  const upcoming = visits.filter(v => v.status === 'scheduled' || v.status === 'active').sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at));
  const past = visits.filter(v => !['scheduled', 'active'].includes(v.status)).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at));

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 17 }}>Schedule</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(s => !s)} disabled={activePatients.length === 0}>
          {showForm ? 'Cancel' : '+ Schedule a visit'}
        </button>
      </div>

      {activePatients.length === 0 && (
        <p className="text-muted text-sm" style={{ marginBottom: 16 }}>Enroll at least one patient before scheduling visits.</p>
      )}

      {showForm && (
        <div className="card" style={{ padding: 20, marginBottom: 20 }}>
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={handleSchedule}>
            <div className="field-row">
              <div className="field">
                <label>Patient</label>
                <select required value={form.patient_id} onChange={e => setForm(f => ({ ...f, patient_id: e.target.value }))}>
                  <option value="">Select a patient</option>
                  {activePatients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Date &amp; time</label>
                <input type="datetime-local" required value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
              </div>
            </div>
            <div className="field">
              <label>Visit label</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Visit 3 — Day 21" />
            </div>
            <button className="btn btn-primary" disabled={saving}>{saving ? 'Scheduling…' : 'Schedule visit'}</button>
          </form>
        </div>
      )}

      <h4 style={sectionLabel}>Upcoming</h4>
      {upcoming.length === 0 ? (
        <p className="text-muted text-sm" style={{ marginBottom: 20 }}>No upcoming visits scheduled.</p>
      ) : (
        <div className="flex-col gap-10" style={{ marginBottom: 24 }}>
          {upcoming.map(v => (
            <VisitRow key={v.id} v={v} onEnter={() => navigate(`/room/${v.room_code}`)} onCancel={() => handleCancel(v.id)} />
          ))}
        </div>
      )}

      <h4 style={sectionLabel}>Past</h4>
      {past.length === 0 ? (
        <p className="text-muted text-sm">No past visits yet.</p>
      ) : (
        <div className="flex-col gap-10">
          {past.map(v => <VisitRow key={v.id} v={v} readOnly />)}
        </div>
      )}
    </div>
  );
}

function VisitRow({ v, onEnter, onCancel, readOnly }) {
  return (
    <div style={rowStyle}>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14.5 }}>{v.title || 'Trial Visit'} · {v.patient_name}</div>
        <div className="text-muted text-sm" style={{ marginTop: 2 }}>{new Date(v.scheduled_at).toLocaleString()}</div>
      </div>
      <div className="flex items-center gap-12">
        <span className={`badge ${STATUS_CLASS[v.status]}`}><span className="badge-dot" />{v.status}</span>
        {!readOnly && v.status === 'scheduled' && (
          <>
            <button className="btn btn-secondary btn-sm" onClick={onEnter}>Enter</button>
            <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
          </>
        )}
        {!readOnly && v.status === 'active' && (
          <button className="btn btn-secondary btn-sm" onClick={onEnter}>Enter</button>
        )}
      </div>
    </div>
  );
}

const sectionLabel = { fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 };
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', border: '1px solid var(--line-soft)', borderRadius: 10, background: 'var(--paper-raised)' };
