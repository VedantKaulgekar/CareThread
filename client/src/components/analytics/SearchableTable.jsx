import React, { useState, useMemo } from 'react';

export default function SearchableTable({ columns, rows, searchKeys, emptyText = 'No results.', searchPlaceholder = 'Search…' }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter(row => searchKeys.some(key => String(row[key] ?? '').toLowerCase().includes(q)));
  }, [rows, query, searchKeys]);

  return (
    <div>
      <input placeholder={searchPlaceholder} value={query} onChange={e => setQuery(e.target.value)} style={searchInputStyle} />
      {filtered.length === 0 ? (
        <p className="text-muted text-sm" style={{ padding: '24px 0', textAlign: 'center' }}>{emptyText}</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>{columns.map(col => <th key={col.key} style={thStyle}>{col.label}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => (
                <tr key={row.id ?? row.patient_id ?? i} style={trStyle}>
                  {columns.map(col => <td key={col.key} style={tdStyle}>{col.render ? col.render(row) : row[col.key]}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const searchInputStyle = { width: '100%', maxWidth: 320, padding: '10px 14px', borderRadius: 9, border: '1.5px solid var(--line)', fontSize: 14, marginBottom: 16 };
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 14 };
const thStyle = { textAlign: 'left', padding: '10px 12px', borderBottom: '1.5px solid var(--line-soft)', color: 'var(--ink-soft)', fontWeight: 600, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: '0.03em' };
const trStyle = { borderBottom: '1px solid var(--line-soft)' };
const tdStyle = { padding: '10px 12px' };