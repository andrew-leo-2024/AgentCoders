import React, { useEffect, useState } from 'react';
import { api, TelemetryRecord } from '../api/client.js';

const TENANT_ID = 'demo-tenant';

export function TelemetryDashboard() {
  const [records, setRecords] = useState<TelemetryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getTelemetry(TENANT_ID)
      .then(setRecords)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading telemetry data...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;

  // Compute summaries
  const totalMetrics = records.length;
  const uniqueAgents = Array.from(new Set(records.map((r) => r.agentId)));
  const uniqueMetricNames = Array.from(new Set(records.map((r) => r.metricName)));
  const recentRecords = [...records]
    .sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime())
    .slice(0, 20);

  // Agent with most records
  const agentCounts: Record<string, number> = {};
  for (const r of records) {
    agentCounts[r.agentId] = (agentCounts[r.agentId] || 0) + 1;
  }
  const topAgents = Object.entries(agentCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div>
      <h1 style={headingStyle}>Telemetry Dashboard</h1>
      <p style={subtitleStyle}>Real-time metrics overview</p>

      {/* Summary Cards */}
      <div style={cardsGridStyle}>
        <SummaryCard title="Total Records" value={String(totalMetrics)} />
        <SummaryCard title="Unique Agents" value={String(uniqueAgents.length)} />
        <SummaryCard title="Metric Types" value={String(uniqueMetricNames.length)} />
      </div>

      {/* Top Agents */}
      <h2 style={sectionHeading}>Top Agents by Record Count</h2>
      <div style={topAgentsGrid}>
        {topAgents.map(([agentId, count]) => (
          <div key={agentId} style={topAgentCard}>
            <div style={topAgentName}>{agentId}</div>
            <div style={topAgentCount}>{count} records</div>
          </div>
        ))}
        {topAgents.length === 0 && (
          <div style={{ color: '#999' }}>No agent data available.</div>
        )}
      </div>

      {/* Recent Records Table */}
      <h2 style={sectionHeading}>Recent Records</h2>
      <table style={tableStyle}>
        <thead>
          <tr style={headerRowStyle}>
            <th style={thStyle}>Recorded At</th>
            <th style={thStyle}>Agent ID</th>
            <th style={thStyle}>Metric</th>
            <th style={thStyle}>Value</th>
            <th style={thStyle}>Unit</th>
            <th style={thStyle}>Tags</th>
          </tr>
        </thead>
        <tbody>
          {recentRecords.length === 0 ? (
            <tr>
              <td colSpan={6} style={emptyCellStyle}>No telemetry records found.</td>
            </tr>
          ) : (
            recentRecords.map((record) => (
              <tr key={record.id} style={rowStyle}>
                <td style={cellStyle}>
                  <span style={monoStyle}>{new Date(record.recordedAt).toLocaleString()}</span>
                </td>
                <td style={cellStyle}>
                  <span style={monoStyle}>{record.agentId}</span>
                </td>
                <td style={cellStyle}>
                  <span style={metricBadge}>{record.metricName}</span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 600 }}>
                  {record.metricValue.toLocaleString()}
                </td>
                <td style={cellStyle}>{record.unit}</td>
                <td style={cellStyle}>
                  {Object.entries(record.tags).map(([k, v]) => (
                    <span key={k} style={tagBadge}>{k}={v}</span>
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

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div style={summaryCardStyle}>
      <div style={summaryCardTitle}>{title}</div>
      <div style={summaryCardValue}>{value}</div>
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

const cardsGridStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1rem',
};
const summaryCardStyle: React.CSSProperties = {
  border: '1px solid #e0e0e0', borderRadius: '8px',
  padding: '1.25rem', textAlign: 'center',
};
const summaryCardTitle: React.CSSProperties = {
  fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const summaryCardValue: React.CSSProperties = {
  fontSize: '2rem', fontWeight: 'bold', color: '#1a237e',
};

const topAgentsGrid: React.CSSProperties = {
  display: 'flex', gap: '0.75rem', flexWrap: 'wrap',
};
const topAgentCard: React.CSSProperties = {
  padding: '0.75rem 1rem', backgroundColor: '#e8eaf6',
  borderRadius: '6px', minWidth: '140px',
};
const topAgentName: React.CSSProperties = {
  fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600,
};
const topAgentCount: React.CSSProperties = {
  fontSize: '0.75rem', color: '#5c6bc0', marginTop: '0.25rem',
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
const metricBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.5rem',
  backgroundColor: '#e0f2f1', color: '#00695c',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 500,
};
const tagBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.1rem 0.4rem',
  backgroundColor: '#f5f5f5', color: '#616161',
  borderRadius: '3px', fontSize: '0.7rem', marginRight: '0.25rem',
};
