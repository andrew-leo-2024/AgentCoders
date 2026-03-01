import React, { useEffect, useState } from 'react';
import { api, InsurancePolicy, InsuranceClaim } from '../api/client.js';

const TENANT_ID = 'demo-tenant';

export function InsuranceDashboard() {
  const [policies, setPolicies] = useState<InsurancePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getInsurancePolicies(TENANT_ID)
      .then(setPolicies)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={loadingStyle}>Loading insurance data...</div>;
  if (error) return <div style={errorStyle}>Error: {error}</div>;

  const allClaims = policies.flatMap((p) => p.claims);
  const compliantCount = policies.filter((p) => p.isCompliant).length;
  const totalCoverage = policies.reduce((sum, p) => sum + p.coverageLimit, 0);
  const totalPremium = policies.reduce((sum, p) => sum + p.premiumMonthly, 0);

  return (
    <div>
      <h1 style={headingStyle}>AI-Insurance &amp; SLA Compliance</h1>
      <p style={subtitleStyle}>Active policies, claims, and compliance status</p>

      {/* Summary Cards */}
      <div style={cardsGridStyle}>
        <SummaryCard title="Active Policies" value={String(policies.length)} />
        <SummaryCard
          title="SLA Compliant"
          value={`${compliantCount}/${policies.length}`}
          highlight={compliantCount === policies.length ? 'green' : 'amber'}
        />
        <SummaryCard title="Total Coverage" value={`$${totalCoverage.toLocaleString()}`} />
        <SummaryCard title="Monthly Premium" value={`$${totalPremium.toLocaleString()}`} />
        <SummaryCard title="Total Claims" value={String(allClaims.length)} />
        <SummaryCard
          title="Pending Claims"
          value={String(allClaims.filter((c) => c.status === 'pending').length)}
          highlight={allClaims.some((c) => c.status === 'pending') ? 'amber' : 'green'}
        />
      </div>

      {/* Policies Table */}
      <h2 style={sectionHeading}>Policies</h2>
      {policies.length === 0 ? (
        <div style={emptyState}>No insurance policies found.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              <th style={thStyle}>Policy Type</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Coverage Limit</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Monthly Premium</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>SLA Target</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>SLA Actual</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Compliant</th>
              <th style={thStyle}>Active Since</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Claims</th>
            </tr>
          </thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.id} style={rowStyle}>
                <td style={cellStyle}>
                  <span style={policyTypeBadge}>{policy.policyType}</span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  ${policy.coverageLimit.toLocaleString()}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace' }}>
                  ${policy.premiumMonthly.toLocaleString()}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  {policy.slaTarget}%
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  <span style={{
                    fontWeight: 600,
                    color: policy.slaActual >= policy.slaTarget ? '#2e7d32' : '#c62828',
                  }}>
                    {policy.slaActual}%
                  </span>
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  <span style={policy.isCompliant ? compliantBadge : nonCompliantBadge}>
                    {policy.isCompliant ? 'Yes' : 'No'}
                  </span>
                </td>
                <td style={cellStyle}>
                  {new Date(policy.activeSince).toLocaleDateString()}
                </td>
                <td style={{ ...cellStyle, textAlign: 'center' }}>
                  {policy.claims.length}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Claims Table */}
      <h2 style={sectionHeading}>Claims History</h2>
      {allClaims.length === 0 ? (
        <div style={emptyState}>No claims filed.</div>
      ) : (
        <table style={tableStyle}>
          <thead>
            <tr style={headerRowStyle}>
              <th style={thStyle}>Claim ID</th>
              <th style={thStyle}>Reason</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Filed</th>
              <th style={thStyle}>Resolved</th>
            </tr>
          </thead>
          <tbody>
            {allClaims
              .sort((a, b) => new Date(b.filedAt).getTime() - new Date(a.filedAt).getTime())
              .map((claim) => (
                <tr key={claim.id} style={rowStyle}>
                  <td style={cellStyle}>
                    <span style={monoStyle}>{claim.id.slice(0, 12)}</span>
                  </td>
                  <td style={cellStyle}>{claim.reason}</td>
                  <td style={{ ...cellStyle, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                    ${claim.amount.toLocaleString()}
                  </td>
                  <td style={cellStyle}>
                    <span style={claimStatusBadge(claim.status)}>{claim.status}</span>
                  </td>
                  <td style={cellStyle}>
                    {new Date(claim.filedAt).toLocaleDateString()}
                  </td>
                  <td style={cellStyle}>
                    {claim.resolvedAt ? new Date(claim.resolvedAt).toLocaleDateString() : '--'}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  highlight,
}: {
  title: string;
  value: string;
  highlight?: 'green' | 'amber';
}) {
  const valueColor = highlight === 'green' ? '#2e7d32' : highlight === 'amber' ? '#f57f17' : '#1a237e';
  return (
    <div style={summaryCardStyle}>
      <div style={summaryCardTitle}>{title}</div>
      <div style={{ ...summaryCardValue, color: valueColor }}>{value}</div>
    </div>
  );
}

const claimStatusBadge = (status: InsuranceClaim['status']): React.CSSProperties => {
  const colors: Record<string, { bg: string; fg: string }> = {
    pending: { bg: '#fff8e1', fg: '#f57f17' },
    approved: { bg: '#e3f2fd', fg: '#1565c0' },
    denied: { bg: '#ffebee', fg: '#c62828' },
    paid: { bg: '#e8f5e9', fg: '#2e7d32' },
  };
  const c = colors[status] || { bg: '#f5f5f5', fg: '#666' };
  return {
    display: 'inline-block', padding: '0.2rem 0.6rem',
    backgroundColor: c.bg, color: c.fg,
    borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
  };
};

// --- Styles ---

const headingStyle: React.CSSProperties = { margin: '0 0 0.25rem 0' };
const subtitleStyle: React.CSSProperties = { color: '#666', marginTop: 0 };
const sectionHeading: React.CSSProperties = { fontSize: '1.1rem', marginTop: '2rem', marginBottom: '0.75rem' };
const emptyState: React.CSSProperties = { padding: '2rem', textAlign: 'center', color: '#999' };

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
  fontSize: '0.8rem', color: '#666', marginBottom: '0.5rem',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
const summaryCardValue: React.CSSProperties = {
  fontSize: '1.75rem', fontWeight: 'bold',
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
const monoStyle: React.CSSProperties = { fontFamily: 'monospace', fontSize: '0.8rem' };

const policyTypeBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.6rem',
  backgroundColor: '#e8eaf6', color: '#283593',
  borderRadius: '4px', fontSize: '0.85rem', fontWeight: 600,
};
const compliantBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.5rem',
  backgroundColor: '#e8f5e9', color: '#2e7d32',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
};
const nonCompliantBadge: React.CSSProperties = {
  display: 'inline-block', padding: '0.2rem 0.5rem',
  backgroundColor: '#ffebee', color: '#c62828',
  borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600,
};
