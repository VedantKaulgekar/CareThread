import React from 'react';

export default function ChartCard({ title, subtitle, loading, error, isEmpty, emptyText, children, height = 240 }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      {title && <h3 style={{ fontSize: 16, marginBottom: subtitle ? 4 : 14 }}>{title}</h3>}
      {subtitle && <p className="text-muted text-sm" style={{ marginBottom: 12 }}>{subtitle}</p>}

      {loading ? (
        <div style={{ ...stateBox, height }}>Loading…</div>
      ) : error ? (
        <div style={{ ...stateBox, height, color: 'var(--coral)' }}>{error}</div>
      ) : isEmpty ? (
        <div style={{ ...stateBox, height }}>{emptyText || 'No data available yet.'}</div>
      ) : (
        children
      )}
    </div>
  );
}

const stateBox = {
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'var(--ink-soft)', fontSize: 13.5, textAlign: 'center', padding: '0 40px',
};