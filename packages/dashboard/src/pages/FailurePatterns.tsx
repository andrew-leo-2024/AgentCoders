import React, { useEffect, useState } from 'react';
import { api, FailurePattern } from '../api/client.js';

const TENANT_ID = 'demo-tenant';

export function FailurePatterns() {
  const [patterns, setPatterns] = useState<FailurePattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getFailurePatterns(TENANT_ID)
      .then(setPatterns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading failure patterns...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;

  const statusColor = (status: FailurePattern['status']): React.CSSProperties => {
    switch (status) {
      case 'active':
        return { backgroundColor: '#ffebee', color: '#c62828', border: '1px solid #ef9a9a' };
      case 'resolved':
        return { backgroundColor: '#e8f5e9', color: '#2e7d32', border: '1px solid #a5d6a7' };
      case 'suppressed':
        return { backgroundColor: '#f5f5f5', color: '#757575', border: '1px solid #e0e0e0' };
    }
  };

  const activeCt = patterns.filter((p) => p.status === 'active').length;
  const resolvedCt = patterns.filter((p) => p.status === 'resolved').length;
  const suppressedCt = patterns.filter((p) => p.status === 'suppressed').length;

  return (
    <div>
      <h1 style={headingStyle}>Failure Patterns</h1>
      <p style={subtitleStyle}>Pattern detection and resolution tracking</p>

      {/* Summary */}
      <div style={summaryBarStyle}>
        <span style={{ ...summaryPill, backgroundColor: '#ffebee', color: '#c62828' }}>
          {activeCt} Active
        </span>
        <span style={{ ...summaryPill, backgroundColor: '#e8f5e9', color: '#2e7d32' }}>
          {resolvedCt} Resolved
        </span>
        <span style={{ ...summaryPill, backgroundColor: '#f5f5f5', color: '#757575' }}>
          {suppressedCt} Suppressed
        </span>
        <span style={totalCount}>{patterns.length} total patterns</span>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={thStyle}>Signature</th>
            <th style={thStyle}>Category</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Count</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>First Seen</th>
            <th style={thStyle}>Last Seen</th>
            <th style={thStyle}>Resolution</th>
          </tr>
        </thead>
        <tbody>
          {patterns.length === 0 ? (
            <tr>
              <td colSpan={7} style={emptyCellStyle}>No failure patterns detected.</td>
            </tr>
          ) : (
            patterns.map((pattern) => (
              <tr key={pattern.id} style={rowStyle}>
                <td style={cellStyle}>
                  <span style={monoStyle}>{pattern.signature}</span>
                </td>
                <td style={cellStyle}>
                  <span style={categoryBadge}>{pattern.category}</span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>
                  {pattern.occurrenceCount}
                </td>
                <td style={cellStyle}>
                  <span style={{ ...statusBadge, ...statusColor(pattern.status) }}>
                    {pattern.status}
                  </span>
                </td>
                <td style={cellStyle}>
                  <span style={monoStyle}>{new Date(pattern.firstSeen).toLocaleDateString()}</span>
                </td>
                <td style={cellStyle}>
                  <span style={monoStyle}>{new Date(pattern.lastSeen).toLocaleDateString()}</span>
                </td>
                <td style={cellStyle}>
                  {pattern.resolution || <span style={{ color: '#bbb' }}>--</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Affected Agents Detail */}
      {patterns.some((p) => p.affectedAgents.length > 0) && (
        <>
          <h2 style={sectionHeading}>Affected Agents by Pattern</h2>
          <div style={agentListContainer}>
            {patterns
              .filter((p) => p.affectedAgents.length > 0)
              .map((p) => (
                <div key={p.id} style={agentListItem}>
                  <div style={agentListSignature}>{p.signature}</div>
                  <div style={agentListAgents}>
                    {p.affectedAgents.map((a) => (
                      <span key={a} style={agentPill}>{a}</span>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
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

const summaryBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem',
};
const summaryPill: React.CSSProperties = {
  padding: '0.375rem 0.75rem', borderRadius: '16px',
  fontSize: '0.8rem', fontWeight: 600,
};
const totalCount: React.CSSProperties = {
  marginLeft: 'auto', fontSize: '0.8rem', color: '#999',
};

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

const categoryBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.5rem',
  backgroundColor: '#fff3e0', color: '#e65100',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500,
};
const statusBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.6rem',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
};

const agentListContainer: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: '0.5rem',
};
const agentListItem: React.CSSProperties = {
  padding: '0.75rem', backgroundColor: '#fafafa',
  borderRadius: '6px', border: '1px solid #eee',
};
const agentListSignature: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.375rem',
};
const agentListAgents: React.CSSProperties = {
  display: 'flex', gap: '0.375rem', flexWrap: 'wrap',
};
const agentPill: React.CSSProperties = {
  display: 'inline-block', padding: '0.15rem 0.5rem',
  backgroundColor: '#e3f2fd', color: '#1565c0',
  borderRadius: '12px', fontSize: '0.75rem',
};
