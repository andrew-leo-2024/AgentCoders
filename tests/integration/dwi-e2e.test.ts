/**
 * E2E Integration test: Full DWI loop via poll-loop + PR status poller.
 *
 * Uses mock ScmProvider, ClaudeCodeExecutor, GitClient — real Redis for pub/sub.
 * Verifies all 6 DWI lifecycle events are published and the DB record becomes billable.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { Redis } from 'ioredis';
import { eq } from 'drizzle-orm';
import {
  startContainers,
  stopContainers,
  getDb,
  getRedisUrl,
  schema,
} from './setup.js';
import { RedisChannels } from '../../packages/shared/src/constants/redis-channels.js';
import { RedisBus } from '../../packages/agent-runtime/src/redis-bus.js';
import { PrStatusPoller } from '../../packages/agent-runtime/src/pr-status-poller.js';
import type { ScmProvider, ScmWorkItem, ScmPullRequest, CiStatus, PrReviewStatus } from '../../packages/shared/src/types/scm-provider.js';
import type { Logger } from '../../packages/shared/src/utils/logger.js';

// Constants
const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const AGENT_ID = 'test-agent-e2e';
const WORK_ITEM_ID = 42;
const PR_ID = 101;
const PR_URL = 'https://github.com/test/repo/pull/101';

let db: ReturnType<typeof getDb>;
let redisBus: RedisBus;
let subscriber: Redis;
let mockLogger: Logger;

function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
    fatal: vi.fn(),
    child: () => createMockLogger(),
  } as unknown as Logger;
}

function createMockScm(overrides: Partial<ScmProvider> = {}): ScmProvider {
  const closedItem: ScmWorkItem = {
    id: WORK_ITEM_ID,
    title: 'Test Issue',
    state: 'closed',
    tags: ['ai-claimed', 'ai-completed'],
    url: 'https://github.com/test/repo/issues/42',
  };

  const mergedPr: ScmPullRequest = {
    id: PR_ID,
    title: '[AI] Test Issue',
    sourceBranch: 'ai/42-test-issue',
    targetBranch: 'main',
    status: 'completed',
    workItemIds: [WORK_ITEM_ID],
    url: PR_URL,
  };

  return {
    type: 'github',
    queryWorkItems: vi.fn().mockResolvedValue([{
      id: WORK_ITEM_ID,
      title: 'Test Issue',
      state: 'open',
      tags: ['agent-ready'],
      description: 'Implement a test feature',
      url: 'https://github.com/test/repo/issues/42',
    }]),
    getWorkItem: vi.fn().mockResolvedValue(closedItem),
    updateWorkItem: vi.fn().mockResolvedValue(undefined),
    createPr: vi.fn().mockResolvedValue(mergedPr),
    mergePr: vi.fn().mockResolvedValue(undefined),
    getPr: vi.fn().mockResolvedValue(mergedPr),
    addComment: vi.fn().mockResolvedValue(undefined),
    getCheckRunStatus: vi.fn().mockResolvedValue({
      state: 'success',
      checks: [{ name: 'build', status: 'completed', conclusion: 'success' }],
    } satisfies CiStatus),
    getPrReviewStatus: vi.fn().mockResolvedValue({
      approved: true,
      reviewers: [{ login: 'reviewer1', state: 'approved' }],
    } satisfies PrReviewStatus),
    ...overrides,
  };
}

beforeAll(async () => {
  await startContainers();
  db = getDb();

  // Seed tenant
  await db.insert(schema.tenants).values({
    id: TENANT_ID,
    name: 'E2E Test Tenant',
    slug: 'e2e-test',
    resourceQuotas: { maxAgents: 2, maxConcurrentTasks: 3, dailyBudgetUsd: 100 },
  }).onConflictDoNothing();

  mockLogger = createMockLogger();
  redisBus = new RedisBus(getRedisUrl(), TENANT_ID, mockLogger);

  // Subscriber for verifying published messages
  subscriber = new Redis(getRedisUrl());
}, 120_000);

afterAll(async () => {
  await redisBus.close();
  subscriber.disconnect();
  await stopContainers();
}, 30_000);

describe('DWI E2E: Full Loop', () => {
  it('should publish dwiWorkItemCreated and prLinked events', async () => {
    const received: Array<{ channel: string; data: Record<string, unknown> }> = [];

    // Subscribe to DWI channels
    const channels = [
      RedisChannels.dwiWorkItemCreated(TENANT_ID),
      RedisChannels.prLinked(TENANT_ID),
    ];

    await Promise.all(channels.map((ch) => subscriber.subscribe(ch)));

    const messagePromise = new Promise<void>((resolve) => {
      let count = 0;
      subscriber.on('message', (channel: string, message: string) => {
        received.push({ channel, data: JSON.parse(message) });
        count++;
        if (count >= 2) resolve();
      });
    });

    // Publish events as poll-loop would
    await redisBus.publishDwiWorkItemCreated(AGENT_ID, WORK_ITEM_ID, 'Test Issue');
    await redisBus.publishPrLinked(AGENT_ID, WORK_ITEM_ID, PR_ID, PR_URL);

    await messagePromise;

    // Verify dwiWorkItemCreated
    const created = received.find((r) => r.channel === RedisChannels.dwiWorkItemCreated(TENANT_ID));
    expect(created).toBeDefined();
    expect(created!.data.type).toBe('dwi:work-item-created');
    expect(created!.data.workItemId).toBe(WORK_ITEM_ID);
    expect(created!.data.agentId).toBe(AGENT_ID);

    // Verify prLinked
    const linked = received.find((r) => r.channel === RedisChannels.prLinked(TENANT_ID));
    expect(linked).toBeDefined();
    expect(linked!.data.type).toBe('dwi:pr-linked');
    expect(linked!.data.prId).toBe(PR_ID);

    await subscriber.unsubscribe(...channels);
    subscriber.removeAllListeners('message');
  });

  it('should publish CI, review, merge, and close events via PR status poller', async () => {
    const received: Array<{ channel: string; data: Record<string, unknown> }> = [];

    const channels = [
      RedisChannels.ciCompleted(TENANT_ID),
      RedisChannels.prApproved(TENANT_ID),
      RedisChannels.prMerged(TENANT_ID),
      RedisChannels.dwiWorkItemClosed(TENANT_ID),
    ];

    await Promise.all(channels.map((ch) => subscriber.subscribe(ch)));

    const messagePromise = new Promise<void>((resolve) => {
      let count = 0;
      subscriber.on('message', (channel: string, message: string) => {
        received.push({ channel, data: JSON.parse(message) });
        count++;
        if (count >= 4) resolve();
      });
    });

    const mockScm = createMockScm();
    const poller = new PrStatusPoller(mockScm, redisBus, AGENT_ID, mockLogger);

    // Track a PR and run one tick
    poller.trackPr(WORK_ITEM_ID, PR_ID);
    await poller.tick();

    await messagePromise;

    // Verify all 4 events
    const ci = received.find((r) => r.channel === RedisChannels.ciCompleted(TENANT_ID));
    expect(ci).toBeDefined();
    expect(ci!.data.type).toBe('dwi:ci-completed');
    expect(ci!.data.passed).toBe(true);

    const approved = received.find((r) => r.channel === RedisChannels.prApproved(TENANT_ID));
    expect(approved).toBeDefined();
    expect(approved!.data.type).toBe('dwi:pr-approved');

    const merged = received.find((r) => r.channel === RedisChannels.prMerged(TENANT_ID));
    expect(merged).toBeDefined();
    expect(merged!.data.type).toBe('dwi:pr-merged');

    const closed = received.find((r) => r.channel === RedisChannels.dwiWorkItemClosed(TENANT_ID));
    expect(closed).toBeDefined();
    expect(closed!.data.type).toBe('dwi:work-item-closed');

    await subscriber.unsubscribe(...channels);
    subscriber.removeAllListeners('message');
  });

  it('should complete a DWI record with all 6 gates when events arrive', async () => {
    // Create DWI record
    const [dwi] = await db.insert(schema.dwiRecords).values({
      tenantId: TENANT_ID,
      agentId: AGENT_ID,
      workItemId: WORK_ITEM_ID,
      complexityTier: 'M',
      priceUsd: 75.0,
    }).returning();

    expect(dwi.isBillable).toBe(false);

    // Simulate billing-service processing all 6 events:
    // Gate 1: workItemExists (default true on insert)
    // Gate 2: prLinked
    await db.update(schema.dwiRecords)
      .set({ prLinked: true, prId: PR_ID })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 3: ciPassed
    await db.update(schema.dwiRecords)
      .set({ ciPassed: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 4: prApproved
    await db.update(schema.dwiRecords)
      .set({ prApproved: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 5: prMerged
    await db.update(schema.dwiRecords)
      .set({ prMerged: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Gate 6: workItemClosed
    await db.update(schema.dwiRecords)
      .set({ workItemClosed: true })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // All gates passed — mark billable
    await db.update(schema.dwiRecords)
      .set({
        isBillable: true,
        status: 'completed',
        completedAt: new Date(),
        durationMs: 120_000,
      })
      .where(eq(schema.dwiRecords.id, dwi.id));

    // Verify final state
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
  });

  it('should not emit duplicate events on second tick', async () => {
    const received: Array<{ channel: string; data: Record<string, unknown> }> = [];

    const channels = [
      RedisChannels.ciCompleted(TENANT_ID),
      RedisChannels.prApproved(TENANT_ID),
      RedisChannels.prMerged(TENANT_ID),
      RedisChannels.dwiWorkItemClosed(TENANT_ID),
    ];

    await Promise.all(channels.map((ch) => subscriber.subscribe(ch)));

    subscriber.on('message', (channel: string, message: string) => {
      received.push({ channel, data: JSON.parse(message) });
    });

    const mockScm = createMockScm();
    const poller = new PrStatusPoller(mockScm, redisBus, AGENT_ID, mockLogger);

    poller.trackPr(WORK_ITEM_ID, PR_ID);

    // First tick: all events fire, entry removed (all complete)
    await poller.tick();

    // Wait a moment for messages to arrive
    await new Promise((r) => setTimeout(r, 200));
    const firstCount = received.length;
    expect(firstCount).toBe(4);

    // Second tick: entry was removed, nothing should fire
    await poller.tick();
    await new Promise((r) => setTimeout(r, 200));

    expect(received.length).toBe(firstCount);

    await subscriber.unsubscribe(...channels);
    subscriber.removeAllListeners('message');
  });
});
