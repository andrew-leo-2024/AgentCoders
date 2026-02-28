/**
 * Isolation tier definitions and logic for multi-tenant provisioning.
 *
 * Three tiers:
 *   namespace              – shared DB (row-level isolation), shared Redis (channel-prefixed)
 *   namespace-dedicated-db – own Postgres + Redis StatefulSets inside a dedicated namespace
 *   dedicated-cluster      – fully isolated K8s cluster (Terraform, Phase 5)
 */

import type { IsolationTier, Tenant } from '@agentcoders/shared';

// ---------------------------------------------------------------------------
// Tier configuration
// ---------------------------------------------------------------------------

export interface TierConfig {
  /** Human-readable label */
  label: string;
  /** Whether the tenant gets a dedicated Postgres instance */
  dedicatedDb: boolean;
  /** Whether the tenant gets a dedicated Redis instance */
  dedicatedRedis: boolean;
  /** Whether the tenant gets a full cluster */
  dedicatedCluster: boolean;
  /** Default CPU request per agent pod */
  defaultCpuRequest: string;
  /** Default CPU limit per agent pod */
  defaultCpuLimit: string;
  /** Default memory request per agent pod */
  defaultMemoryRequest: string;
  /** Default memory limit per agent pod */
  defaultMemoryLimit: string;
  /** Maximum pods allowed in the namespace */
  maxPods: number;
}

const TIER_CONFIGS: Record<IsolationTier, TierConfig> = {
  namespace: {
    label: 'Namespace (shared infra)',
    dedicatedDb: false,
    dedicatedRedis: false,
    dedicatedCluster: false,
    defaultCpuRequest: '250m',
    defaultCpuLimit: '1000m',
    defaultMemoryRequest: '256Mi',
    defaultMemoryLimit: '1Gi',
    maxPods: 20,
  },
  'namespace-dedicated-db': {
    label: 'Namespace + Dedicated DB',
    dedicatedDb: true,
    dedicatedRedis: true,
    dedicatedCluster: false,
    defaultCpuRequest: '500m',
    defaultCpuLimit: '2000m',
    defaultMemoryRequest: '512Mi',
    defaultMemoryLimit: '2Gi',
    maxPods: 50,
  },
  'dedicated-cluster': {
    label: 'Dedicated Cluster',
    dedicatedDb: true,
    dedicatedRedis: true,
    dedicatedCluster: true,
    defaultCpuRequest: '500m',
    defaultCpuLimit: '4000m',
    defaultMemoryRequest: '512Mi',
    defaultMemoryLimit: '4Gi',
    maxPods: 200,
  },
};

/**
 * Return the resource-limits and template configuration for a given tier.
 */
export function getTierConfig(tier: IsolationTier): TierConfig {
  return TIER_CONFIGS[tier];
}

// ---------------------------------------------------------------------------
// Kustomize overlay generation
// ---------------------------------------------------------------------------

/**
 * Build a Kustomize overlay YAML string for a tenant namespace.
 * This is written to disk and applied via `kubectl apply -k`.
 */
export function generateKustomization(tenant: Pick<Tenant, 'id' | 'slug' | 'isolationTier' | 'resourceQuotas'>): string {
  const tierCfg = getTierConfig(tenant.isolationTier);
  const ns = `tenant-${tenant.slug}`;

  const lines: string[] = [
    'apiVersion: kustomize.config.k8s.io/v1beta1',
    'kind: Kustomization',
    '',
    `namespace: ${ns}`,
    '',
    'resources:',
    '  - namespace.yaml',
    '  - rbac.yaml',
    '  - network-policy.yaml',
    '  - resource-quota.yaml',
  ];

  if (tierCfg.dedicatedDb) {
    lines.push('  - postgres-statefulset.yaml');
  }
  if (tierCfg.dedicatedRedis) {
    lines.push('  - redis-statefulset.yaml');
  }

  lines.push('');
  lines.push('commonLabels:');
  lines.push(`  agentcoders.io/tenant-id: "${tenant.id}"`);
  lines.push(`  agentcoders.io/tenant-slug: "${tenant.slug}"`);
  lines.push(`  agentcoders.io/isolation-tier: "${tenant.isolationTier}"`);
  lines.push('');
  lines.push('commonAnnotations:');
  lines.push(`  agentcoders.io/max-agents: "${tenant.resourceQuotas.maxAgents}"`);
  lines.push(`  agentcoders.io/daily-budget-usd: "${tenant.resourceQuotas.dailyBudgetUsd}"`);

  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Database connection string
// ---------------------------------------------------------------------------

/**
 * Return the Postgres connection string for a tenant.
 *
 *  - `namespace` tier: shared DATABASE_URL (from env) — row-level isolation via tenant_id
 *  - `namespace-dedicated-db` and `dedicated-cluster`: per-tenant Postgres in-cluster service
 */
export function getDbConnectionString(tenant: Pick<Tenant, 'slug' | 'isolationTier'>): string {
  if (tenant.isolationTier === 'namespace') {
    // Shared DB — callers filter by tenant_id
    return process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/agentcoders';
  }

  // Dedicated DB deployed inside tenant namespace
  const ns = `tenant-${tenant.slug}`;
  const host = `postgres.${ns}.svc.cluster.local`;
  return `postgresql://agentcoders:agentcoders@${host}:5432/agentcoders`;
}

// ---------------------------------------------------------------------------
// Redis prefix
// ---------------------------------------------------------------------------

/**
 * Return the Redis key/channel prefix for a tenant.
 * All Redis keys and pub/sub channels are prefixed to prevent cross-tenant leakage
 * even when tenants share a single Redis instance.
 */
export function getRedisPrefix(tenant: Pick<Tenant, 'id'>): string {
  return `tenant:${tenant.id}:`;
}
