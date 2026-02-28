import React, { useEffect, useState } from 'react';

interface DashboardMetrics {
  workItemsDelivered: number;
  workItemsTotal: number;
  prsMerged: number;
  cycleTimeHours: number;
  humanBaselineDays: number;
  totalCostUsd: number;
  humanEquivalentUsd: number;
  savingsPercent: number;
}

export function ValueDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);

  useEffect(() => {
    // Placeholder — will fetch from API
    setMetrics({
      workItemsDelivered: 47,
      workItemsTotal: 52,
      prsMerged: 43,
      cycleTimeHours: 4.2,
      humanBaselineDays: 3.5,
      totalCostUsd: 2100,
      humanEquivalentUsd: 38400,
      savingsPercent: 94.5,
    });
  }, []);

  if (!metrics) return <div>Loading...</div>;

  const deliveryRate = ((metrics.workItemsDelivered / metrics.workItemsTotal) * 100).toFixed(0);
  const speedMultiplier = ((metrics.humanBaselineDays * 24) / metrics.cycleTimeHours).toFixed(0);

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
          subtitle={`vs ${metrics.humanBaselineDays} days human = ${speedMultiplier}x faster`}
        />
        <MetricCard
          title="Total Cost"
          value={`$${metrics.totalCostUsd.toLocaleString()}`}
        />
        <MetricCard
          title="Human Equivalent"
          value={`$${metrics.humanEquivalentUsd.toLocaleString()}`}
        />
        <MetricCard
          title="Savings"
          value={`${metrics.savingsPercent}%`}
          subtitle={`$${(metrics.humanEquivalentUsd - metrics.totalCostUsd).toLocaleString()} saved`}
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
