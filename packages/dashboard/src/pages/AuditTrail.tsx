import React, { useEffect, useState } from 'react';
import { api, AuditEvent } from '../api/client.js';

const TENANT_ID = 'demo-tenant';

export function AuditTrail() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    api.getAuditEvents(TENANT_ID)
      .then(setEvents)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading audit events...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;

  const categories = ['all', ...Array.from(new Set(events.map((e) => e.category)))];
  const filtered = categoryFilter === 'all'
    ? events
    : events.filter((e) => e.category === categoryFilter);

  return (
    <div>
      <h1 style={headingStyle}>Audit Trail</h1>
      <p style={subtitleStyle}>Immutable event log — {events.length} total events</p>

      <div style={filterBarStyle}>
        <label style={labelStyle}>
          Category:
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={selectStyle}
          >
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : cat}
              </option>
            ))}
          </select>
        </label>
        <span style={countStyle}>{filtered.length} events shown</span>
      </div>

      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={thStyle}>Timestamp</th>
            <th style={thStyle}>Agent ID</th>
            <th style={thStyle}>Event Type</th>
            <th style={thStyle}>Category</th>
            <th style={{ ...thStyle, minWidth: '200px' }}>Details</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={5} style={emptyCellStyle}>No audit events found.</td>
            </tr>
          ) : (
            filtered.map((event) => (
              <tr key={event.id} style={rowStyle}>
                <td style={cellStyle}>
                  <span style={monoStyle}>{new Date(event.timestamp).toLocaleString()}</span>
                </td>
                <td style={cellStyle}>
                  <span style={monoStyle}>{event.agentId}</span>
                </td>
                <td style={cellStyle}>
                  <span style={eventTypeBadge}>{event.eventType}</span>
                </td>
                <td style={cellStyle}>
                  <span style={categoryBadge}>{event.category}</span>
                </td>
                <td style={cellStyle}>{event.details}</td>
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

const loadingStyle: React.CSSProperties = {
  padding: '2rem', textAlign: 'center', color: '#666', fontSize: '1.1rem',
};
const errorStyle: React.CSSProperties = {
  padding: '1rem', backgroundColor: '#fdecea', color: '#c62828',
  borderRadius: '6px', border: '1px solid #ef9a9a',
};

const filterBarStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '1rem',
  marginBottom: '1rem', padding: '0.75rem 1rem',
  backgroundColor: '#f5f5f5', borderRadius: '6px',
};
const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
};
const selectStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem', borderRadius: '4px',
  border: '1px solid #ccc', fontSize: '0.875rem',
};
const countStyle: React.CSSProperties = {
  marginLeft: 'auto', fontSize: '0.8rem', color: '#999',
};

const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem',
};
const headerRowStyle: React.CSSProperties = {
  borderBottom: '2px solid #e0e0e0', textAlign: 'left',
};
const thStyle: React.CSSProperties = {
  padding: '0.75rem', fontWeight: 600, color: '#333',
};
const rowStyle: React.CSSProperties = { borderBottom: '1px solid #f0f0f0' };
const cellStyle: React.CSSProperties = { padding: '0.75rem', verticalAlign: 'top' };
const emptyCellStyle: React.CSSProperties = {
  padding: '2rem', textAlign: 'center', color: '#999',
};
const monoStyle: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '0.8rem',
};
const eventTypeBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.5rem',
  backgroundColor: '#e3f2fd', color: '#1565c0',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500,
};
const categoryBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.5rem',
  backgroundColor: '#f3e5f5', color: '#7b1fa2',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500,
};
