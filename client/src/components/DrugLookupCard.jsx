import React, { useState } from 'react';
import { api, useAuth } from '../AuthContext.jsx';

export default function DrugLookupCard({ drugName }) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function handleLookup() {
    if (!drugName?.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api(`/mcp/drug-lookup?name=${encodeURIComponent(drugName.trim())}`, { token });
      if (data.result?.status === 'error') {
        setError(data.result.error_message || 'Lookup failed');
      } else {
        setResult(data.result);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={handleLookup}
        disabled={!drugName?.trim() || loading}
      >
        {loading ? 'Looking up…' : '🔎 Look up drug info (FDA)'}
      </button>

      {error && (
        <div className="text-sm text-muted" style={{ marginTop: 8 }}>
          Couldn't find FDA data for "{drugName}" — you can still create the workspace, this is just reference info.
        </div>
      )}

      {result && !error && (
        <div style={resultBox}>
          {result.brand_name && <Row label="Brand name" value={result.brand_name} />}
          {result.generic_name && <Row label="Generic name" value={result.generic_name} />}
          {result.manufacturer && <Row label="Manufacturer" value={result.manufacturer} />}
          {result.product_type && <Row label="Product type" value={result.product_type} />}
          {Array.isArray(result.route) && result.route.length > 0 && (
            <Row label="Route" value={result.route.join(', ')} />
          )}
          {result.marketing_status && <Row label="Marketing status" value={result.marketing_status} />}
          {!result.brand_name && !result.generic_name && (
            <div className="text-sm text-muted">No structured details returned — raw match found in FDA database.</div>
          )}
          <div className="text-sm text-muted" style={{ marginTop: 8, fontSize: 11.5 }}>
            Source: openFDA, via MCP · reference only, not medical advice
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between" style={{ fontSize: 13, padding: '3px 0' }}>
      <span className="text-muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const resultBox = {
  marginTop: 10,
  padding: 12,
  background: 'var(--paper)',
  borderRadius: 10,
  border: '1px solid var(--line-soft)',
};
