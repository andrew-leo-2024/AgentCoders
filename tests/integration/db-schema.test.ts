/**
 * Integration test: DB schema migrations and Drizzle CRUD.
 *
 * Verifies that migrations create all expected tables and that
 * basic Drizzle ORM operations work end-to-end against real Postgres.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { startContainers, stopContainers, getDb, schema } from './setup.js';

let db: ReturnType<typeof getDb>;

beforeAll(async () => {
  await startContainers();
  db = getDb();
}, 120_000);

afterAll(async () => {
  await stopContainers();
}, 30_000);

describe('DB Schema Migrations', () => {
  it('should create all expected tables', async () => {
    const result = await db.execute(sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    const tableNames = result.rows.map((r: Record<string, unknown>) => r['table_name'] as string);

    const expectedTables = [
      'agent_actions',
      'agent_memories',
      'agent_skills',
      'agents',
      'audit_events',
      'claude_sessions',
      'decision_provenance',
      'dwi_records',
      'enhancement_runs',
      'escalations',
      'failure_patterns',
      'insurance_claims',
      'insurance_policies',
      'invoices',
      'management_configs',
      'messages',
      'model_route_logs',
      'model_routes',
      'pr_log',
      'skill_scores',
      'skills',
      'subscriptions',
      'telemetry_records',
      'tenants',
      'usage_records',
      'work_item_log',
    ];

    for (const table of expectedTables) {
      expect(tableNames).toContain(table);
    }
  });

  it('should create all expected enums', async () => {
    const result = await db.execute(sql`
      SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname
    `);

    const enumNames = result.rows.map((r: Record<string, unknown>) => r['typname'] as string);

    expect(enumNames).toContain('isolation_tier');
    expect(enumNames).toContain('agent_role');
    expect(enumNames).toContain('dwi_status');
    expect(enumNames).toContain('subscription_plan');
  });

  it('should insert and select a tenant via Drizzle ORM', async () => {
    const [inserted] = await db.insert(schema.tenants).values({
      name: 'Integration Test Co',
      slug: 'int-test-co',
      resourceQuotas: { maxAgents: 3, maxConcurrentTasks: 5, dailyBudgetUsd: 50 },
    }).returning();

    expect(inserted.id).toBeDefined();
    expect(inserted.name).toBe('Integration Test Co');
    expect(inserted.slug).toBe('int-test-co');
    expect(inserted.isolationTier).toBe('namespace');
    expect(inserted.subscriptionPlan).toBe('starter');
    expect(inserted.status).toBe('provisioning');
  });

  it('should enforce unique slug constraint', async () => {
    await db.insert(schema.tenants).values({
      name: 'Unique Slug Test',
      slug: 'unique-slug-test',
      resourceQuotas: { maxAgents: 1, maxConcurrentTasks: 1, dailyBudgetUsd: 10 },
    });

    await expect(
      db.insert(schema.tenants).values({
        name: 'Duplicate Slug',
        slug: 'unique-slug-test',
        resourceQuotas: { maxAgents: 1, maxConcurrentTasks: 1, dailyBudgetUsd: 10 },
      }),
    ).rejects.toThrow();
  });
});
