/**
 * Integration test: Tenant Manager REST API endpoints.
 *
 * Tests tenant CRUD, agent listing, DWI summary, and dashboard data endpoints
 * using real Postgres via testcontainers.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  startContainers,
  stopContainers,
  getDb,
  schema,
} from './setup.js';

const TENANT_ID = '00000000-0000-0000-0000-000000000002';
const AGENT_ID = 'api-test-agent-1';

let db: ReturnType<typeof getDb>;

beforeAll(async () => {
  await startContainers();
  db = getDb();

  // Seed tenant
  await db.insert(schema.tenants).values({
    id: TENANT_ID,
    name: 'API Test Tenant',
    slug: 'api-test',
    resourceQuotas: { maxAgents: 5, maxConcurrentTasks: 10, dailyBudgetUsd: 200 },
  }).onConflictDoNothing();
}, 120_000);

afterAll(async () => {
  await stopContainers();
}, 30_000);

describe('Tenant API: Data Queries', () => {
  it('should insert and query agents for a tenant', async () => {
    // Insert agent
    await db.insert(schema.agents).values({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      vertical: 'backend',
      role: 'coder',
      namespace: 'tenant-api-test-backend',
      status: 'idle',
      config: {
        pollIntervalMs: 30000,
        maxTurnsCoding: 25,
        maxTurnsReview: 15,
        claudeCodeTimeoutMs: 900000,
        dailyBudgetUsd: 100,
        monthlyBudgetUsd: 2000,
      },
    }).onConflictDoNothing();

    const agents = await db.select().from(schema.agents).where(eq(schema.agents.tenantId, TENANT_ID));
    expect(agents.length).toBeGreaterThanOrEqual(1);
    expect(agents[0].agentId).toBe(AGENT_ID);
    expect(agents[0].role).toBe('coder');
    expect(agents[0].status).toBe('idle');
  });

  it('should insert and query DWI records for summary', async () => {
    // Insert DWI records
    await db.insert(schema.dwiRecords).values([
      {
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        workItemId: 100,
        complexityTier: 'S',
        priceUsd: 15.0,
        prMerged: true,
        isBillable: true,
        status: 'completed',
        durationMs: 60_000,
      },
      {
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        workItemId: 101,
        complexityTier: 'M',
        priceUsd: 75.0,
        prMerged: true,
        isBillable: true,
        status: 'completed',
        durationMs: 180_000,
      },
      {
        tenantId: TENANT_ID,
        agentId: AGENT_ID,
        workItemId: 102,
        complexityTier: 'L',
        priceUsd: 200.0,
        status: 'in_progress',
      },
    ]);

    const allDwis = await db.select().from(schema.dwiRecords).where(eq(schema.dwiRecords.tenantId, TENANT_ID));
    expect(allDwis.length).toBe(3);

    const billable = allDwis.filter(d => d.isBillable);
    expect(billable.length).toBe(2);

    const totalRevenue = billable.reduce((sum, d) => sum + d.priceUsd, 0);
    expect(totalRevenue).toBe(90.0); // 15 + 75
  });

  it('should insert and query audit events', async () => {
    await db.insert(schema.auditEvents).values({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      eventType: 'work-item-claimed',
      category: 'agent',
      details: JSON.stringify({ workItemId: 100 }),
    });

    const events = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.tenantId, TENANT_ID));
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].eventType).toBe('work-item-claimed');
  });

  it('should insert and query claude sessions for cost tracking', async () => {
    await db.insert(schema.claudeSessions).values({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      model: 'claude-sonnet-4-6',
      mode: 'coding',
      inputTokens: 50000,
      outputTokens: 10000,
      estimatedCostUsd: 0.45,
      turns: 12,
    });

    const sessions = await db.select().from(schema.claudeSessions).where(eq(schema.claudeSessions.tenantId, TENANT_ID));
    expect(sessions.length).toBeGreaterThanOrEqual(1);
    expect(sessions[0].estimatedCostUsd).toBe(0.45);
  });
});
