import React, { useEffect, useState } from 'react';
import { api, type DwiSummary } from '../api/client';

const TENANT_ID = 'demo-tenant';
const HUMAN_BASELINE_DAYS = 3.5;
const HUMAN_HOURLY_RATE = 75;

export function ValueDashboard() {
  const [metrics, setMetrics] = useState<DwiSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDwiSummary(TENANT_ID).then(setMetrics).catch((err: Error) => setError(err.message));
  }, []);

  if (error) return <div style={{ color: 'red' }}>Error: {error}</div>;
  if (!metrics) return <div>Loading...</div>;

  const deliveryRate = metrics.workItemsTotal > 0
    ? ((metrics.workItemsDelivered / metrics.workItemsTotal) * 100).toFixed(0)
    : '0';
  const speedMultiplier = metrics.cycleTimeHours > 0
    ? ((HUMAN_BASELINE_DAYS * 24) / metrics.cycleTimeHours).toFixed(0)
    : '-';
  const humanEquivalentUsd = metrics.workItemsDelivered * HUMAN_BASELINE_DAYS * 8 * HUMAN_HOURLY_RATE;
  const savingsPercent = humanEquivalentUsd > 0
    ? (((humanEquivalentUsd - metrics.totalCostUsd) / humanEquivalentUsd) * 100).toFixed(1)
    : '0';

  return (
    <div>
      <h1>Value Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
        <MetricCard
          title="Work Items Delivered"
          value={`${metrics.workItemsDelivered}/${metrics.workItemsTotal}`}
          subtitle={`${deliveryRate}% delivery rate`}
        />
        <MetricCard
          title="PRs Merged"
          value={String(metrics.prsMerged)}
        />
        <MetricCard
          title="Cycle Time"
          value={`${metrics.cycleTimeHours}hrs`}
          subtitle={`vs ${HUMAN_BASELINE_DAYS} days human = ${speedMultiplier}x faster`}
        />
        <MetricCard
          title="Total Cost"
          value={`$${metrics.totalCostUsd.toLocaleString()}`}
        />
        <MetricCard
          title="Revenue"
          value={`$${metrics.totalRevenueUsd.toLocaleString()}`}
        />
        <MetricCard
          title="Savings vs Human"
          value={`${savingsPercent}%`}
          subtitle={`$${(humanEquivalentUsd - metrics.totalCostUsd).toLocaleString()} saved`}
        />
      </div>
    </div>
  );
}

function MetricCard({ title, value, subtitle }: { title: string; value: string; subtitle?: string }) {
  return (
    <div style={{
      border: '1px solid #e0e0e0',
      borderRadius: '8px',
      padding: '1.5rem',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{title}</div>
      <div style={{ fontSize: '2rem', fontWeight: 'bold' }}>{value}</div>
      {subtitle && <div style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>{subtitle}</div>}
    </div>
  );
}
