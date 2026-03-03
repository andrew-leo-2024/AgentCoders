/**
 * QuotaManager — per-tenant resource quotas.
 *
 * Tracks: maxAgents, maxConcurrentTasks, dailyBudgetUsd, CPU, memory.
 * Updates both the K8s ResourceQuota object and the DB record.
 */

import { eq, and, gte, sql } from 'drizzle-orm';
import { spawn } from 'node:child_process';

import type { Database, Logger } from '@agentcoders/shared';
import { tenants, dwiRecords, claudeSessions } from '@agentcoders/shared';
import type { ResourceQuotas } from '@agentcoders/shared';

import { getTierConfig } from './isolation-tiers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ResourceUsage {
  maxAgents: number;
  activeAgents: number;
  maxConcurrentTasks: number;
  activeTasks: number;
  dailyBudgetUsd: number;
  dailySpentUsd: number;
  cpuRequestTotal: string;
  cpuUsed: string;
  memoryRequestTotal: string;
  memoryUsed: string;
}

export interface QuotaCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  resource: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runKubectl(args: string[]): Promise<{ stdout: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('kubectl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.on('close', (code) => resolve({ stdout, code: code ?? 1 }));
    proc.on('error', () => resolve({ stdout: '', code: 1 }));
  });
}

// ---------------------------------------------------------------------------
// QuotaManager
// ---------------------------------------------------------------------------

export class QuotaManager {
  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  /**
   * Update quotas for a tenant: persists to DB and patches the K8s ResourceQuota.
   */
  async setQuotas(tenantId: string, quotas: Partial<ResourceQuotas>): Promise<void> {
    this.logger.info({ tenantId, quotas }, 'Updating tenant quotas');

    // Fetch current tenant
    const rows = await this.db.select().from(tenants).where(eq(tenants.id, tenantId));
    const tenant = rows[0];
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const merged: ResourceQuotas = {
      maxAgents: quotas.maxAgents ?? tenant.resourceQuotas.maxAgents,
      maxConcurrentTasks: quotas.maxConcurrentTasks ?? tenant.resourceQuotas.maxConcurrentTasks,
      dailyBudgetUsd: quotas.dailyBudgetUsd ?? tenant.resourceQuotas.dailyBudgetUsd,
    };

    // Update DB
    await this.db
      .update(tenants)
      .set({ resourceQuotas: merged, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    // Patch K8s ResourceQuota in tenant namespace
    const ns = `tenant-${tenant.slug}`;
    const tierCfg = getTierConfig(tenant.isolationTier);

    const cpuReqTotal = `${merged.maxAgents * parseInt(tierCfg.defaultCpuRequest)}m`;
    const memReqTotal = `${merged.maxAgents * parseInt(tierCfg.defaultMemoryRequest)}Mi`;
    const cpuLimTotal = `${merged.maxAgents * parseInt(tierCfg.defaultCpuLimit)}m`;
    const memLimTotal = `${merged.maxAgents * parseInt(tierCfg.defaultMemoryLimit)}Mi`;

    const patch = JSON.stringify({
      spec: {
        hard: {
          pods: String(tierCfg.maxPods),
          'requests.cpu': cpuReqTotal,
          'requests.memory': memReqTotal,
          'limits.cpu': cpuLimTotal,
          'limits.memory': memLimTotal,
        },
      },
    });

    const { code } = await runKubectl([
      'patch', 'resourcequota', 'tenant-quota',
      '-n', ns,
      '--type=merge',
      '-p', patch,
    ]);

    if (code !== 0) {
      this.logger.warn({ ns, tenantId }, 'Failed to patch K8s ResourceQuota (namespace may not exist yet)');
    }

    this.logger.info({ tenantId, merged }, 'Quotas updated');
  }

  /**
   * Check whether a tenant is within limits for a given resource.
   */
  async checkQuota(tenantId: string, resource: keyof ResourceQuotas): Promise<QuotaCheckResult> {
    const rows = await this.db.select().from(tenants).where(eq(tenants.id, tenantId));
    const tenant = rows[0];
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const limit = tenant.resourceQuotas[resource];

    // For agent/task counts we'd normally query the agents table.
    // For budget we'd query usage_records. Simplified for MVP — return limit info.
    let current = 0;

    if (resource === 'maxAgents') {
      // Count agents via K8s pods (best-effort)
      const ns = `tenant-${tenant.slug}`;
      const { stdout, code } = await runKubectl([
        'get', 'pods', '-n', ns,
        '-l', 'agentcoders.io/role=agent',
        '-o', 'json',
      ]);
      if (code === 0) {
        try {
          const parsed = JSON.parse(stdout) as { items?: unknown[] };
          current = parsed.items?.length ?? 0;
        } catch {
          current = 0;
        }
      }
    }

    return {
      allowed: current < limit,
      current,
      limit,
      resource,
    };
  }

  /**
   * Get full resource usage snapshot for a tenant.
   */
  async getUsage(tenantId: string): Promise<ResourceUsage> {
    const rows = await this.db.select().from(tenants).where(eq(tenants.id, tenantId));
    const tenant = rows[0];
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    const ns = `tenant-${tenant.slug}`;
    const tierCfg = getTierConfig(tenant.isolationTier);

    // Query K8s for pod count
    let activeAgents = 0;
    const { stdout: podJson, code: podCode } = await runKubectl([
      'get', 'pods', '-n', ns,
      '-l', 'agentcoders.io/role=agent',
      '-o', 'json',
    ]);
    if (podCode === 0) {
      try {
        const parsed = JSON.parse(podJson) as { items?: unknown[] };
        activeAgents = parsed.items?.length ?? 0;
      } catch {
        activeAgents = 0;
      }
    }

    // Query K8s resource quota usage
    let cpuUsed = '0m';
    let memoryUsed = '0Mi';
    const { stdout: quotaJson, code: quotaCode } = await runKubectl([
      'get', 'resourcequota', 'tenant-quota', '-n', ns, '-o', 'json',
    ]);
    if (quotaCode === 0) {
      try {
        const parsed = JSON.parse(quotaJson) as { status?: { used?: Record<string, string> } };
        cpuUsed = parsed.status?.used?.['requests.cpu'] ?? '0m';
        memoryUsed = parsed.status?.used?.['requests.memory'] ?? '0Mi';
      } catch {
        // keep defaults
      }
    }

    // Count active (non-terminal) DWI work items for this tenant
    const activeDwis = await this.db.select({ count: sql<number>`count(*)::int` })
      .from(dwiRecords)
      .where(and(
        eq(dwiRecords.tenantId, tenantId),
        sql`${dwiRecords.status} IN ('in_progress', 'pending_review')`,
      ));
    const activeTasks = activeDwis[0]?.count ?? 0;

    // Aggregate today's Claude session costs for this tenant
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const dailyCosts = await this.db.select({ total: sql<number>`coalesce(sum(${claudeSessions.estimatedCostUsd}), 0)::real` })
      .from(claudeSessions)
      .where(and(
        eq(claudeSessions.tenantId, tenantId),
        gte(claudeSessions.startedAt, todayStart),
      ));
    const dailySpentUsd = Math.round((dailyCosts[0]?.total ?? 0) * 100) / 100;

    return {
      maxAgents: tenant.resourceQuotas.maxAgents,
      activeAgents,
      maxConcurrentTasks: tenant.resourceQuotas.maxConcurrentTasks,
      activeTasks,
      dailyBudgetUsd: tenant.resourceQuotas.dailyBudgetUsd,
      dailySpentUsd,
      cpuRequestTotal: `${tenant.resourceQuotas.maxAgents * parseInt(tierCfg.defaultCpuRequest)}m`,
      cpuUsed,
      memoryRequestTotal: `${tenant.resourceQuotas.maxAgents * parseInt(tierCfg.defaultMemoryRequest)}Mi`,
      memoryUsed,
    };
  }
}
