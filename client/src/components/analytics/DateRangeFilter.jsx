import React from 'react';

export default function DateRangeFilter({ from, to, onChange }) {
  return (
    <div className="flex items-center gap-8" style={{ flexWrap: 'wrap' }}>
      <div className="flex items-center gap-8">
        <label className="text-sm text-muted" style={{ fontWeight: 600 }}>From</label>
        <input type="date" value={from} onChange={e => onChange({ from: e.target.value, to })} style={dateInputStyle} />
      </div>
      <div className="flex items-center gap-8">
        <label className="text-sm text-muted" style={{ fontWeight: 600 }}>To</label>
        <input type="date" value={to} onChange={e => onChange({ from, to: e.target.value })} style={dateInputStyle} />
      </div>
      {(from || to) && (
        <button className="btn btn-ghost btn-sm" onClick={() => onChange({ from: '', to: '' })}>Clear</button>
      )}
    </div>
  );
}

const dateInputStyle = { padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--line)', fontSize: 13.5 };