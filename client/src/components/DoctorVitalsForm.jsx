import React, { useState } from 'react';
import { api, useAuth } from '../AuthContext.jsx';

const initial = { stage: 'pre_dosage', dosage_given: '', doctor_notes: '' };

export default function DoctorVitalsForm({ scheduledVisitId, onSaved }) {
  const { token } = useAuth();
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  function update(field, value) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg('');
    try {
      await api('/vitals/doctor', {
        method: 'PUT',
        token,
        body: {
          scheduled_visit_id: scheduledVisitId,
          stage: form.stage,
          dosage_given: form.dosage_given || null,
          doctor_notes: form.doctor_notes || null,
        },
      });
      setSavedMsg('Saved ✓');
      setForm(f => ({ ...initial, stage: f.stage }));
      onSaved?.();
      setTimeout(() => setSavedMsg(''), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
        Confirm dosage administration and add clinical observations. The patient submits their own readings from the visit record panel.
      </p>

      <div className="field">
        <label>Stage</label>
        <select value={form.stage} onChange={e => update('stage', e.target.value)}>
          <option value="pre_dosage">Pre-dosage</option>
          <option value="post_dosage">Post-dosage</option>
          <option value="general">General checkup</option>
        </select>
      </div>

      <div className="field">
        <label>Dosage given (if applicable)</label>
        <input value={form.dosage_given} onChange={e => update('dosage_given', e.target.value)} placeholder="e.g. 50mg Drug X, tablet" />
      </div>

      <div className="field">
        <label>Clinical notes</label>
        <textarea rows={3} value={form.doctor_notes} onChange={e => update('doctor_notes', e.target.value)} placeholder="Any observations from the visit…" />
      </div>

      <button className="btn btn-primary btn-block" disabled={saving}>
        {saving ? 'Saving…' : 'Save to visit record'}
      </button>
      {savedMsg && <p style={{ color: 'var(--teal)', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: 600 }}>{savedMsg}</p>}
    </form>
  );
}
