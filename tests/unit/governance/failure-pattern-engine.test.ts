import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock DB
const mockSelect = vi.fn();
const mockReturning = vi.fn();
const mockUpdate = vi.fn();

const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: mockSelect,
        orderBy: vi.fn().mockResolvedValue([]),
      }),
    }),
  }),
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: mockReturning,
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: mockUpdate,
    }),
  }),
};

// Mock Redis — injected via constructor
const mockRedisPublish = vi.fn().mockResolvedValue(1);
const mockRedisDisconnect = vi.fn();
const mockRedis = {
  publish: mockRedisPublish,
  disconnect: mockRedisDisconnect,
};

const { FailurePatternEngine } = await import(
  '../../../packages/governance/src/failure-pattern-engine.js'
);

describe('FailurePatternEngine', () => {
  let engine: InstanceType<typeof FailurePatternEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Inject mockDb and mockRedis via constructor — no real connections
    engine = new FailurePatternEngine('redis://localhost:6379', mockDb as any, mockRedis as any);

    // Reset default mock behavior
    mockSelect.mockResolvedValue([]);
    mockUpdate.mockResolvedValue(undefined);
  });

  it('should create a new pattern on first failure', async () => {
    mockSelect.mockResolvedValueOnce([]);

    const insertedRow = {
      id: 'pattern-1',
      tenantId: 'tenant-1',
      patternHash: 'abc123',
      signature: 'TypeError: Cannot read properties of undefined',
      category: 'unknown',
      occurrenceCount: 1,
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      resolution: null,
      status: 'active',
    };
    mockReturning.mockResolvedValueOnce([insertedRow]);

    const error = new TypeError('Cannot read properties of undefined');
    const result = await engine.recordFailure('tenant-1', error, 'unknown');

    expect(result.occurrenceCount).toBe(1);
    expect(result.signature).toContain('Cannot read properties of undefined');
    expect(result.status).toBe('active');
    expect(mockRedisPublish).toHaveBeenCalled();
  });

  it('should increment count on repeated failure with same hash', async () => {
    const existingRow = {
      id: 'pattern-2',
      tenantId: 'tenant-1',
      patternHash: 'def456',
      signature: 'Error: Connection refused',
      category: 'infrastructure',
      occurrenceCount: 3,
      firstSeenAt: new Date('2024-01-01'),
      lastSeenAt: new Date('2024-01-10'),
      resolution: null,
      status: 'active',
    };

    mockSelect.mockResolvedValueOnce([existingRow]);
    mockUpdate.mockResolvedValueOnce(undefined);

    const error = new Error('Connection refused');
    const result = await engine.recordFailure('tenant-1', error, 'infrastructure');

    expect(result.occurrenceCount).toBe(4);
    expect(result.id).toBe('pattern-2');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('should publish high-frequency alert when threshold is reached', async () => {
    const existingRow = {
      id: 'pattern-3',
      tenantId: 'tenant-1',
      patternHash: 'ghi789',
      signature: 'Error: Timeout',
      category: 'unknown',
      occurrenceCount: 4, // Will become 5 (threshold)
      firstSeenAt: new Date(),
      lastSeenAt: new Date(),
      resolution: null,
      status: 'active',
    };

    mockSelect.mockResolvedValueOnce([existingRow]);
    mockUpdate.mockResolvedValueOnce(undefined);

    const error = new Error('Timeout');
    await engine.recordFailure('tenant-1', error, 'unknown');

    expect(mockRedisPublish).toHaveBeenCalledWith(
      'tenant-1:governance:failure-alert',
      expect.any(String),
    );
  });

  it('should disconnect Redis on stop', () => {
    engine.stop();
    expect(mockRedisDisconnect).toHaveBeenCalledTimes(1);
  });
});
