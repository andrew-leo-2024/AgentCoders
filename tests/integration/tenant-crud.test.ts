/**
 * Integration test: Tenant CRUD operations.
 *
 * Verifies tenant creation with defaults, unique slug enforcement,
 * updates, and status transitions — all against a real Postgres database.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startContainers, stopContainers, getDb, schema } from './setup.js';

let db: ReturnType<typeof getDb>;

beforeAll(async () => {
  await startContainers();
  db = getDb();
}, 120_000);

afterAll(async () => {
  await stopContainers();
}, 30_000);

describe('Tenant CRUD', () => {
  it('should create a tenant with correct defaults', async () => {
    const [tenant] = await db.insert(schema.tenants).values({
      name: 'Acme Corp',
      slug: 'acme-corp',
      resourceQuotas: { maxAgents: 5, maxConcurrentTasks: 10, dailyBudgetUsd: 200 },
    }).returning();

    expect(tenant.id).toBeDefined();
    expect(tenant.name).toBe('Acme Corp');
    expect(tenant.slug).toBe('acme-corp');
    expect(tenant.isolationTier).toBe('namespace');
    expect(tenant.subscriptionPlan).toBe('starter');
    expect(tenant.status).toBe('provisioning');
    expect(tenant.verticals).toEqual([]);
    expect(tenant.createdAt).toBeInstanceOf(Date);
    expect(tenant.updatedAt).toBeInstanceOf(Date);
  });

  it('should enforce unique slug constraint', async () => {
    await db.insert(schema.tenants).values({
      name: 'First Tenant',
      slug: 'unique-slug-crud',
      resourceQuotas: { maxAgents: 1, maxConcurrentTasks: 1, dailyBudgetUsd: 10 },
    });

    await expect(
      db.insert(schema.tenants).values({
        name: 'Second Tenant',
        slug: 'unique-slug-crud',
        resourceQuotas: { maxAgents: 1, maxConcurrentTasks: 1, dailyBudgetUsd: 10 },
      }),
    ).rejects.toThrow();
  });

  it('should update tenant name and plan', async () => {
    const [tenant] = await db.insert(schema.tenants).values({
      name: 'Update Test',
      slug: 'update-test',
      resourceQuotas: { maxAgents: 2, maxConcurrentTasks: 4, dailyBudgetUsd: 50 },
    }).returning();

    await db.update(schema.tenants)
      .set({ name: 'Updated Name', subscriptionPlan: 'growth', updatedAt: new Date() })
      .where(eq(schema.tenants.id, tenant.id));

    const [updated] = await db.select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenant.id));

    expect(updated.name).toBe('Updated Name');
    expect(updated.subscriptionPlan).toBe('growth');
  });

  it('should transition tenant status through lifecycle', async () => {
    const [tenant] = await db.insert(schema.tenants).values({
      name: 'Lifecycle Test',
      slug: 'lifecycle-test',
      resourceQuotas: { maxAgents: 1, maxConcurrentTasks: 1, dailyBudgetUsd: 10 },
    }).returning();

    expect(tenant.status).toBe('provisioning');

    // Activate
    await db.update(schema.tenants)
      .set({ status: 'active' })
      .where(eq(schema.tenants.id, tenant.id));

    const [active] = await db.select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenant.id));
    expect(active.status).toBe('active');

    // Suspend
    await db.update(schema.tenants)
      .set({ status: 'suspended' })
      .where(eq(schema.tenants.id, tenant.id));

    const [suspended] = await db.select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenant.id));
    expect(suspended.status).toBe('suspended');

    // Deprovision
    await db.update(schema.tenants)
      .set({ status: 'deprovisioning' })
      .where(eq(schema.tenants.id, tenant.id));

    const [deprovisioning] = await db.select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenant.id));
    expect(deprovisioning.status).toBe('deprovisioning');
  });

  it('should store and retrieve JSONB verticals', async () => {
    const verticals = [
      { name: 'Frontend', type: 'frontend', namespace: 'tenant-jsonb-test-frontend', agentCount: 2 },
      { name: 'Backend', type: 'backend', namespace: 'tenant-jsonb-test-backend', agentCount: 3 },
    ];

    const [tenant] = await db.insert(schema.tenants).values({
      name: 'JSONB Verticals Test',
      slug: 'jsonb-verticals',
      verticals,
      resourceQuotas: { maxAgents: 5, maxConcurrentTasks: 10, dailyBudgetUsd: 100 },
    }).returning();

    const [result] = await db.select()
      .from(schema.tenants)
      .where(eq(schema.tenants.id, tenant.id));

    expect(result.verticals).toEqual(verticals);
  });
});
