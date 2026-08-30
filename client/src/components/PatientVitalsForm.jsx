import React, { useState } from 'react';
import { api, useAuth } from '../AuthContext.jsx';

const initial = {
  stage: 'pre_dosage',
  temperature: '', bp_systolic: '', bp_diastolic: '', sugar: '', spo2: '', heart_rate: '',
};

export default function PatientVitalsForm({ scheduledVisitId, onSaved }) {
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
      await api('/vitals/patient', {
        method: 'PUT',
        token,
        body: {
          scheduled_visit_id: scheduledVisitId,
          stage: form.stage,
          temperature: form.temperature ? parseFloat(form.temperature) : null,
          bp_systolic: form.bp_systolic ? parseInt(form.bp_systolic) : null,
          bp_diastolic: form.bp_diastolic ? parseInt(form.bp_diastolic) : null,
          sugar: form.sugar ? parseFloat(form.sugar) : null,
          spo2: form.spo2 ? parseFloat(form.spo2) : null,
          heart_rate: form.heart_rate ? parseInt(form.heart_rate) : null,
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
        Use your own thermometer, BP cuff, glucometer, or pulse oximeter and enter the readings below.
      </p>

      <div className="field">
        <label>Stage</label>
        <select value={form.stage} onChange={e => update('stage', e.target.value)}>
          <option value="pre_dosage">Pre-dosage</option>
          <option value="post_dosage">Post-dosage</option>
          <option value="general">General checkup</option>
        </select>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Temperature (°F)</label>
          <input type="number" step="0.1" value={form.temperature} onChange={e => update('temperature', e.target.value)} placeholder="98.6" />
        </div>
        <div className="field">
          <label>Heart rate (bpm)</label>
          <input type="number" value={form.heart_rate} onChange={e => update('heart_rate', e.target.value)} placeholder="72" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>BP systolic</label>
          <input type="number" value={form.bp_systolic} onChange={e => update('bp_systolic', e.target.value)} placeholder="120" />
        </div>
        <div className="field">
          <label>BP diastolic</label>
          <input type="number" value={form.bp_diastolic} onChange={e => update('bp_diastolic', e.target.value)} placeholder="80" />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label>Blood sugar (mg/dL)</label>
          <input type="number" step="0.1" value={form.sugar} onChange={e => update('sugar', e.target.value)} placeholder="98" />
        </div>
        <div className="field">
          <label>SpO₂ (%)</label>
          <input type="number" step="0.1" value={form.spo2} onChange={e => update('spo2', e.target.value)} placeholder="98" />
        </div>
      </div>

      <button className="btn btn-teal btn-block" disabled={saving}>
        {saving ? 'Saving…' : 'Submit my readings'}
      </button>
      {savedMsg && <p style={{ color: 'var(--teal)', fontSize: 13, marginTop: 8, textAlign: 'center', fontWeight: 600 }}>{savedMsg}</p>}
    </form>
  );
}
