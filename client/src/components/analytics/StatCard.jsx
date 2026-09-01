import React from 'react';

const COLOR_MAP = { purple: 'var(--purple)', teal: 'var(--teal)', amber: 'var(--amber)', coral: 'var(--coral)' };

export default function StatCard({ label, value, color = 'purple', sub }) {
  return (
    <div className="card" style={{ padding: '18px 20px' }}>
      <div className="text-sm text-muted" style={{ fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: COLOR_MAP[color] || COLOR_MAP.purple, marginTop: 4, fontFamily: 'Fraunces, serif' }}>
        {value}
      </div>
      {sub && <div className="text-muted text-sm mt-8">{sub}</div>}
    </div>
  );
}