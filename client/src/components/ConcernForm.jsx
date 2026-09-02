import React, { useState } from 'react';
import { api, useAuth } from '../AuthContext.jsx';

export default function ConcernForm({ workspaceId }) {
  const { token } = useAuth();
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSubmitting(true);
    setError('');
    setResult(null);
    try {
      const data = await api(`/workspaces/${workspaceId}/visit-requests`, {
        method: 'POST',
        token,
        body: { concern_text: text },
      });
      setResult(data.request);
      setText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <h3 style={{ fontSize: 16, marginBottom: 4 }}>Not feeling right?</h3>
      <p className="text-muted text-sm" style={{ marginBottom: 14 }}>
        Describe how you're feeling between visits — your doctor will be notified, and if it sounds urgent, they're alerted right away.
      </p>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div style={resultBox}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Sent to your doctor</div>
          <p className="text-muted text-sm" style={{ marginTop: 4 }}>
            They'll review it and reach out or schedule a visit if needed.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <textarea
          required
          rows={3}
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="e.g. I've had a headache since yesterday that isn't going away"
          style={{ width: '100%', padding: '11px 14px', borderRadius: 9, border: '1.5px solid var(--line)', marginBottom: 10 }}
        />
        <button className="btn btn-primary btn-sm" disabled={submitting || !text.trim()}>
          {submitting ? 'Sending…' : 'Send to doctor'}
        </button>
      </form>
    </div>
  );
}

const resultBox = { padding: 12, background: 'var(--teal-light)', borderRadius: 10, marginBottom: 14 };
