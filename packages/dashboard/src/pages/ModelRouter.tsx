import React, { useEffect, useState } from 'react';
import { api, ModelRoute } from '../api/client.js';

const TENANT_ID = 'demo-tenant';

export function ModelRouter() {
  const [routes, setRoutes] = useState<ModelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getModelRoutes(TENANT_ID)
      .then(setRoutes)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading model routes...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;

  // Cost summary by provider
  const providerSummary: Record<string, { count: number; active: number; avgInputCost: number; avgOutputCost: number }> = {};
  for (const route of routes) {
    if (!providerSummary[route.provider]) {
      providerSummary[route.provider] = { count: 0, active: 0, avgInputCost: 0, avgOutputCost: 0 };
    }
    const s = providerSummary[route.provider];
    s.count += 1;
    if (route.isActive) s.active += 1;
    s.avgInputCost += route.costPerInputToken;
    s.avgOutputCost += route.costPerOutputToken;
  }
  for (const key of Object.keys(providerSummary)) {
    const s = providerSummary[key];
    s.avgInputCost = s.avgInputCost / s.count;
    s.avgOutputCost = s.avgOutputCost / s.count;
  }

  const sortedRoutes = [...routes].sort((a, b) => a.priority - b.priority);

  return (
    <div>
      <h1 style={headingStyle}>Model Router</h1>
      <p style={subtitleStyle}>Model routing configuration and cost analysis</p>

      {/* Provider Cost Summary */}
      <h2 style={sectionHeading}>Cost Summary by Provider</h2>
      <div style={costGridStyle}>
        {Object.entries(providerSummary).map(([provider, summary]) => (
          <div key={provider} style={costCardStyle}>
            <div style={costCardProvider}>{provider}</div>
            <div style={costCardRow}>
              <span style={costLabel}>Models:</span>
              <span style={costValue}>{summary.count} ({summary.active} active)</span>
            </div>
            <div style={costCardRow}>
              <span style={costLabel}>Avg Input Cost:</span>
              <span style={costValue}>${summary.avgInputCost.toFixed(6)}/token</span>
            </div>
            <div style={costCardRow}>
              <span style={costLabel}>Avg Output Cost:</span>
              <span style={costValue}>${summary.avgOutputCost.toFixed(6)}/token</span>
            </div>
          </div>
        ))}
        {Object.keys(providerSummary).length === 0 && (
          <div style={{ color: '#999' }}>No providers configured.</div>
        )}
      </div>

      {/* Route Table */}
      <h2 style={sectionHeading}>Registered Routes</h2>
      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={{ ...thStyle, textAlign: 'center', width: '60px' }}>Priority</th>
            <th style={thStyle}>Provider</th>
            <th style={thStyle}>Model ID</th>
            <th style={{ ...thStyle, textAlign: 'center' }}>Active</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Input Cost</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Output Cost</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Max Tokens</th>
            <th style={thStyle}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {sortedRoutes.length === 0 ? (
            <tr>
              <td colSpan={8} style={emptyCellStyle}>No model routes configured.</td>
            </tr>
          ) : (
            sortedRoutes.map((route) => (
              <tr
                key={route.id}
                style={{
                  ...rowStyle,
                  opacity: route.isActive ? 1 : 0.5,
                }}
              >
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  <span style={priorityBadge}>{route.priority}</span>
                </td>
                <td style={cellStyle}>
                  <span style={providerBadge}>{route.provider}</span>
                </td>
                <td style={cellStyle}>
                  <span style={monoStyle}>{route.modelId}</span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-block', width: '10px', height: '10px',
                    borderRadius: '50%',
                    backgroundColor: route.isActive ? '#4caf50' : '#bdbdbd',
                  }} />
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  ${route.costPerInputToken.toFixed(6)}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  ${route.costPerOutputToken.toFixed(6)}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>
                  {route.maxTokens.toLocaleString()}
                </td>
                <td style={cellStyle}>
                  {route.tags.map((tag) => (
                    <span key={tag} style={tagBadge}>{tag}</span>
                  ))}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// --- Styles ---

const headingStyle: React.CSSProperties = { margin: '0 0 0.25rem 0' };
const subtitleStyle: React.CSSProperties = { color: '#666', marginTop: 0 };
const sectionHeading: React.CSSProperties = { fontSize: '1.1rem', marginTop: '2rem', marginBottom: '0.75rem' };

const loadingStyle: React.CSSProperties = {
  padding: '2rem', textAlign: 'center', color: '#666', fontSize: '1.1rem',
};
const errorStyle: React.CSSProperties = {
  padding: '1rem', backgroundColor: '#fdecea', color: '#c62828',
  borderRadius: '6px', border: '1px solid #ef9a9a',
};

const costGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
  gap: '1rem', marginBottom: '1rem',
};
const costCardStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0', borderRadius: '8px', padding: '1rem',
};
const costCardProvider: React.CSSProperties = {
  fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem',
  color: '#1a237e',
};
const costCardRow: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between',
  fontSize: '0.8rem', marginBottom: '0.25rem',
};
const costLabel: React.CSSProperties = { color: '#666' };
const costValue: React.CSSProperties = { fontFamily: 'monospace', fontWeight: 500 };

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem',
};
const headerRowStyle: React.CSSProperties = {
  borderBottom: '2px solid #e0e0e0', textAlign: 'left',
};
const thStyle: React.CSSProperties = { padding: '0.75rem', fontWeight: 600, color: '#333' };
const rowStyle: React.CSSProperties = { borderBottom: '1px solid #f0f0f0' };
const cellStyle: React.CSSProperties = { padding: '0.75rem', verticalAlign: 'top' };
const emptyCellStyle: React.CSSProperties = {
  padding: '2rem', textAlign: 'center', color: '#999',
};
const monoStyle: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.8rem' };

const priorityBadge: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: '28px', height: '28px', borderRadius: '50%',
  backgroundColor: '#e8eaf6', color: '#283593',
  fontSize: '0.8rem', fontWeight: 700,
};
const providerBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.5rem',
  backgroundColor: '#e0f7fa', color: '#006064',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500,
};
const tagBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.1rem 0.4rem',
  backgroundColor: '#f5f5f5', color: '#616161',
  borderRadius: '3px', fontSize: '0.7rem', marginRight: '0.25rem',
};
