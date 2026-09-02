import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, useAuth } from '../AuthContext.jsx';

const URGENCY_STYLE = {
  high: { bg: 'var(--coral-light)', fg: 'var(--coral)', label: 'High' },
  medium: { bg: 'var(--amber-light)', fg: 'var(--amber)', label: 'Medium' },
  low: { bg: 'var(--teal-light)', fg: 'var(--teal)', label: 'Low' },
  unclear: { bg: 'var(--line-soft)', fg: 'var(--ink-soft)', label: 'Unclear' },
};

export default function VisitRequestsPanel({ workspaceId, onScheduled }) {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState(null);
  const [schedulingId, setSchedulingId] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ scheduled_at: '', title: '' });

  async function refresh() {
    const data = await api(`/workspaces/${workspaceId}/visit-requests`, { token });
    setRequests(data.requests);
  }

  useEffect(() => { refresh(); }, [workspaceId]);

  async function handleSchedule(e, requestId) {
    e.preventDefault();
    await api(`/visit-requests/${requestId}/schedule`, {
      method: 'POST',
      token,
      body: { ...scheduleForm, scheduled_at: new Date(scheduleForm.scheduled_at).toISOString() },
    });
    setSchedulingId(null);
    setScheduleForm({ scheduled_at: '', title: '' });
    refresh();
    onScheduled?.();
  }

  async function handleDismiss(requestId) {
    await api(`/visit-requests/${requestId}/dismiss`, { method: 'POST', token });
    refresh();
  }

  if (!requests) return null;

  const pending = requests.filter(r => r.status === 'pending');
  if (pending.length === 0) return null;

  return (
    <div className="card" style={{ padding: 20, marginBottom: 20, borderColor: 'var(--coral)' }}>
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Patient concerns awaiting review</h3>
      <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
        Triaged by urgency — nothing here is a diagnosis, just how quickly a patient's message may need attention.
      </p>
      <div className="flex-col gap-10">
        {pending.map(r => {
          const u = URGENCY_STYLE[r.urgency] || URGENCY_STYLE.unclear;
          return (
            <div key={r.id} style={{ padding: 14, border: '1px solid var(--line-soft)', borderRadius: 10 }}>
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-8">
                    <span style={{ ...pillStyle, background: u.bg, color: u.fg }}>{u.label} urgency</span>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{r.patient_name}</span>
                  </div>
                  <p style={{ fontSize: 14, margin: '8px 0 4px' }}>{r.concern_text}</p>
                  {r.urgency_reasoning && (
                    <p className="text-muted text-sm" style={{ fontStyle: 'italic' }}>AI reasoning: {r.urgency_reasoning}</p>
                  )}
                </div>
                <div className="flex gap-8">
                  <button className="btn btn-secondary btn-sm" onClick={() => setSchedulingId(schedulingId === r.id ? null : r.id)}>
                    Schedule visit
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => handleDismiss(r.id)}>Dismiss</button>
                </div>
              </div>

              {schedulingId === r.id && (
                <form onSubmit={(e) => handleSchedule(e, r.id)} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--line-soft)' }}>
                  <div className="field-row">
                    <div className="field">
                      <label>Date &amp; time</label>
                      <input
                        type="datetime-local" required
                        value={scheduleForm.scheduled_at}
                        onChange={e => setScheduleForm(f => ({ ...f, scheduled_at: e.target.value }))}
                      />
                    </div>
                    <div className="field">
                      <label>Visit label</label>
                      <input
                        value={scheduleForm.title}
                        onChange={e => setScheduleForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. Unscheduled check-in"
                      />
                    </div>
                  </div>
                  <button className="btn btn-primary btn-sm">Confirm and schedule</button>
                </form>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const pillStyle = { fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 999 };
