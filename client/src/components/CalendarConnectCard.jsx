import React, { useEffect, useState } from 'react';
import { api, useAuth } from '../AuthContext.jsx';

export default function CalendarConnectCard() {
  const { token } = useAuth();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const data = await api('/calendar/status', { token });
      setStatus(data);
    } catch {
      setStatus({ configured: false, connected: false });
    }
  }

  useEffect(() => {
    refresh();
    const params = new URLSearchParams(window.location.search);
    if (params.get('calendar') === 'connected') {
      window.history.replaceState({}, '', window.location.pathname);
      refresh();
    }
    if (params.get('calendar') === 'error') {
      setError('Something went wrong connecting your calendar. Please try again.');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  async function handleConnect() {
    setBusy(true);
    setError('');
    try {
      const data = await api('/calendar/connect', { token });
      window.location.href = data.url;
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    try {
      await api('/calendar/disconnect', { method: 'POST', token });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <h3 style={{ fontSize: 17, marginBottom: 4 }}>Google Calendar</h3>
      <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
        Sync your scheduled visits to your Google Calendar automatically.
      </p>

      {!status.configured && (
        <div className="text-sm text-muted" style={{ padding: 12, background: 'var(--paper)', borderRadius: 10 }}>
          Calendar sync isn't set up on this server yet — this needs a Google Cloud OAuth configuration first.
        </div>
      )}

      {status.configured && error && <div className="error-box">{error}</div>}

      {status.configured && (
        status.connected ? (
          <div className="flex items-center justify-between">
            <span className="badge badge-active"><span className="badge-dot" />Connected</span>
            <button className="btn btn-secondary btn-sm" onClick={handleDisconnect} disabled={busy}>
              {busy ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        ) : (
          <button className="btn btn-primary btn-sm" onClick={handleConnect} disabled={busy}>
            {busy ? 'Redirecting…' : 'Connect Google Calendar'}
          </button>
        )
      )}
    </div>
  );
}
