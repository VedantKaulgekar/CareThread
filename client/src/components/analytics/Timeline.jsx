import React, { useState } from 'react';

export default function Timeline({ items, emptyText = 'Nothing here yet.' }) {
  if (!items || items.length === 0) {
    return <p className="text-muted text-sm" style={{ padding: '24px 0', textAlign: 'center' }}>{emptyText}</p>;
  }
  return (
    <div className="flex-col gap-10">
      {items.map((item, i) => <TimelineRow key={item.id ?? i} item={item} />)}
    </div>
  );
}

function TimelineRow({ item }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = Boolean(item.detail);

  return (
    <div style={{ borderBottom: '1px solid var(--line-soft)' }}>
      <div style={{ ...rowStyle, cursor: hasDetail ? 'pointer' : 'default' }} onClick={() => hasDetail && setExpanded(e => !e)}>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14.5 }}>{item.title}</div>
          <div className="text-muted text-sm">{item.subtitle}</div>
        </div>
        <div className="flex items-center gap-8">
          {item.badge && <span className={`badge ${item.badgeClass || 'badge-completed'}`}><span className="badge-dot" />{item.badge}</span>}
          {hasDetail && <span className="text-sm" style={{ color: 'var(--purple)', fontWeight: 600 }}>{expanded ? 'Hide ▲' : 'View ▼'}</span>}
        </div>
      </div>
      {hasDetail && expanded && (
        <div style={detailBox}>
          <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>{item.detail}</p>
        </div>
      )}
    </div>
  );
}

const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 4px' };
const detailBox = { padding: '10px 14px 14px', background: 'var(--purple-light)', borderRadius: 10, margin: '0 0 10px' };