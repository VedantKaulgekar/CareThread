import React, { useState } from 'react';
import { api, useAuth } from '../AuthContext.jsx';

const STAGE_LABEL = { pre_dosage: 'Pre-dosage', post_dosage: 'Post-dosage', general: 'General' };

export default function ChecklistPanel({ visit, isDoctor, progress, onProgressChange }) {
  const { token } = useAuth();
  const [saving, setSaving] = useState(null);

  const checklist = visit.checklist;
  const hasChecklist = checklist && (checklist.pre_dosage?.length || checklist.post_dosage?.length || checklist.general?.length);
  if (!hasChecklist) return null;

  async function toggle(stage, item, checked) {
    if (!isDoctor) return;
    setSaving(`${stage}:${item}`);
    try {
      await api(`/visits/${visit.id}/checklist`, {
        method: 'PUT',
        token,
        body: { stage, item, checked },
      });
      onProgressChange?.({ ...progress, [stage]: { ...(progress?.[stage] || {}), [item]: checked } });
    } finally {
      setSaving(null);
    }
  }

  const stages = ['pre_dosage', 'post_dosage', 'general'].filter(s => checklist[s]?.length > 0);

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Protocol checklist</h3>
      <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
        {isDoctor ? 'Confirm each item as it happens during the visit.' : 'Your doctor is confirming these as the visit progresses.'}
      </p>
      {stages.map(stage => (
        <div key={stage} style={{ marginBottom: 14 }}>
          <div className="text-sm" style={{ fontWeight: 700, color: 'var(--purple)', marginBottom: 6 }}>
            {STAGE_LABEL[stage]}
          </div>
          <div className="flex-col gap-6">
            {checklist[stage].map(item => {
              const checked = Boolean(progress?.[stage]?.[item]);
              const isSaving = saving === `${stage}:${item}`;
              return (
                <label key={item} style={{ ...itemRow, opacity: isDoctor ? 1 : 0.85, cursor: isDoctor ? 'pointer' : 'default' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!isDoctor || isSaving}
                    onChange={e => toggle(stage, item, e.target.checked)}
                  />
                  <span style={{ fontSize: 13.5, textDecoration: checked ? 'line-through' : 'none', color: checked ? 'var(--ink-soft)' : 'var(--ink)' }}>
                    {item}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

const itemRow = { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' };
