/**
 * Integration test: DWI (Delivered Work Item) lifecycle.
 *
 * Verifies creating a DWI, progressing through the 6 quality gates,
 * and marking it as billable — all against a real Postgres database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startContainers, stopContainers, getDb, schema } from './setup.js';

let db: ReturnType<typeof getDb>;
let tenantId: string;

beforeAll(async () => {
  await startContainers();
  db = getDb();

  // Seed a tenant for DWI tests
  const [tenant] = await db.insert(schema.tenants).values({
    name: 'DWI Test Tenant',
    slug: 'dwi-test',
    resourceQuotas: { maxAgents: 2, maxConcurrentTasks: 3, dailyBudgetUsd: 100 },
  }).returning();
  tenantId = tenant.id;
}, 120_000);

afterAll(async () => {
  await stopContainers();
}, 30_000);

describe('DWI Lifecycle', () => {
  it('should create a DWI in in_progress status', async () => {
    const [dwi] = await db.insert(schema.dwiRecords).values({
      tenantId,
      agentId: 'agent-coder-1',
      workItemId: 42,
      complexityTier: 'M',
      priceUsd: 75.0,
    }).returning();

    expect(dwi.status).toBe('in_progress');
    expect(dwi.isBillable).toBe(false);
    expect(dwi.workItemExists).toBe(true);
    expect(dwi.prLinked).toBe(false);
  });

  it('should progress through all 6 quality gates', async () => {
    const [dwi] = await db.insert(schema.dwiRecords).values({
      tenantId,
      agentId: 'agent-coder-1',
      workItemId: 100,
      complexityTier: 'L',
      priceUsd: 150.0,
    }).returning();

    // Gate 1: work item exists (default true)
    expect(dwi.workItemExists).toBe(true);

    // Gate 2: PR linked
    await db.update(schema.dwiRecords)
      .set({ prLinked: true, prId: 201 })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 3: CI passed
    await db.update(schema.dwiRecords)
      .set({ ciPassed: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 4: PR approved
    await db.update(schema.dwiRecords)
      .set({ prApproved: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 5: PR merged
    await db.update(schema.dwiRecords)
      .set({ prMerged: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 6: Work item closed
    await db.update(schema.dwiRecords)
      .set({ workItemClosed: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // All gates passed — mark billable
    await db.update(schema.dwiRecords)
      .set({
        isBillable: true,
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(schema.dwiRecords.id, dwi.id));

    const [final] = await db.select()
      .from(schema.dwiRecords)
      .where(eq(schema.dwiRecords.id, dwi.id));

    expect(final.workItemExists).toBe(true);
    expect(final.prLinked).toBe(true);
    expect(final.ciPassed).toBe(true);
    expect(final.prApproved).toBe(true);
    expect(final.prMerged).toBe(true);
    expect(final.workItemClosed).toBe(true);
    expect(final.isBillable).toBe(true);
    expect(final.status).toBe('completed');
    expect(final.completedAt).toBeDefined();
  });

  it('should NOT be billable when gates are incomplete', async () => {
    const [dwi] = await db.insert(schema.dwiRecords).values({
      tenantId,
      agentId: 'agent-coder-2',
      workItemId: 200,
      complexityTier: 'S',
      priceUsd: 35.0,
    }).returning();

    // Only link PR, skip other gates
    await db.update(schema.dwiRecords)
      .set({ prLinked: true, prId: 300 })
      .where(eq(schema.dwiRecords.id, dwi.id));

    const [result] = await db.select()
      .from(schema.dwiRecords)
      .where(eq(schema.dwiRecords.id, dwi.id));

    expect(result.prLinked).toBe(true);
    expect(result.ciPassed).toBe(false);
    expect(result.isBillable).toBe(false);
  });

  it('should track DWI duration', async () => {
    const [dwi] = await db.insert(schema.dwiRecords).values({
      tenantId,
      agentId: 'agent-coder-1',
      workItemId: 300,
      complexityTier: 'XS',
      priceUsd: 15.0,
    }).returning();

    await db.update(schema.dwiRecords)
      .set({
        status: 'failed',
        completedAt: new Date(),
        durationMs: 45000,
      })
      .where(eq(schema.dwiRecords.id, dwi.id));

    const [result] = await db.select()
      .from(schema.dwiRecords)
      .where(eq(schema.dwiRecords.id, dwi.id));

    expect(result.status).toBe('failed');
    expect(result.durationMs).toBe(45000);
    expect(result.isBillable).toBe(false);
  });
});
