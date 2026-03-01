import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Redis instance — injected via constructor
const mockRedisPublish = vi.fn().mockResolvedValue(1);
const mockRedisDisconnect = vi.fn();
const mockRedis = {
  publish: mockRedisPublish,
  disconnect: mockRedisDisconnect,
};

// Mock DB instance — injected via constructor
const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) });
const mockDb = {
  insert: mockInsert,
  select: vi.fn(),
};

// Mock the governance config (module-level import in audit-trail.ts)
vi.mock('../../../packages/governance/src/config.js', () => ({
  getGovernanceConfig: () => ({
    AUDIT_FLUSH_INTERVAL_MS: 5000,
    REDIS_URL: 'redis://localhost:6379',
  }),
}));

// Import after config mock is set up
const { AuditTrail } = await import('../../../packages/governance/src/audit-trail.js');

describe('AuditTrail', () => {
  let trail: InstanceType<typeof AuditTrail>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Inject both mockDb and mockRedis via constructor — no real connections
    trail = new AuditTrail('redis://localhost:6379', mockDb as any, mockRedis as any);
  });

  it('should record events to the internal buffer and publish to Redis', async () => {
    await trail.record({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      eventType: 'task.started',
      category: 'task',
      details: { workItemId: 42 },
    });

    expect(mockRedisPublish).toHaveBeenCalledTimes(1);
    expect(mockRedisPublish).toHaveBeenCalledWith(
      'tenant-1:governance:audit',
      expect.stringContaining('"eventType":"task.started"'),
    );
  });

  it('should add timestamp to recorded events', async () => {
    const beforeRecord = new Date();

    await trail.record({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      eventType: 'agent.spawned',
      category: 'agent',
      details: {},
    });

    const publishedData = JSON.parse(mockRedisPublish.mock.calls[0][1] as string);
    const eventTime = new Date(publishedData.timestamp);
    expect(eventTime.getTime()).toBeGreaterThanOrEqual(beforeRecord.getTime());
  });

  it('should handle Redis publish failures gracefully without throwing', async () => {
    mockRedisPublish.mockRejectedValueOnce(new Error('Redis down'));

    await expect(
      trail.record({
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        eventType: 'task.failed',
        category: 'task',
        details: { error: 'something broke' },
      }),
    ).resolves.toBeUndefined();
  });

  it('should disconnect Redis on stop', () => {
    trail.stop();
    expect(mockRedisDisconnect).toHaveBeenCalledTimes(1);
  });
});
