import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReturning = vi.fn();
const mockOrderBy = vi.fn();

const mockDb = {
  insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: mockReturning,
    }),
  }),
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: mockOrderBy,
      }),
    }),
  }),
  update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn(),
    }),
  }),
  delete: vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([]),
    }),
  }),
};

// Import MemoryStore — no module mocks needed; db is injected via constructor
const { MemoryStore } = await import('../../../packages/agent-memory/src/memory-store.js');

describe('MemoryStore', () => {
  let store: InstanceType<typeof MemoryStore>;

  const sampleRow = {
    id: 'mem-1',
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    category: 'learning',
    key: 'typescript-patterns',
    content: 'Use discriminated unions for exhaustive matching',
    relevanceScore: 0.9,
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-01'),
    expiresAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Inject the mock db via constructor — bypasses getDb() entirely
    store = new MemoryStore(mockDb as any);
  });

  it('should create a memory entry and return the mapped result', async () => {
    mockReturning.mockResolvedValueOnce([sampleRow]);

    const result = await store.create({
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      category: 'learning',
      key: 'typescript-patterns',
      content: 'Use discriminated unions for exhaustive matching',
      relevanceScore: 0.9,
    });

    expect(result.id).toBe('mem-1');
    expect(result.key).toBe('typescript-patterns');
    expect(result.content).toBe('Use discriminated unions for exhaustive matching');
    expect(result.relevanceScore).toBe(0.9);
    expect(result.expiresAt).toBeUndefined();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('should return null when getting a non-existent memory', async () => {
    mockDb.select.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });

    const result = await store.get('non-existent');
    expect(result).toBeNull();
  });

  it('should search memories by key pattern', async () => {
    const matchingRows = [
      { ...sampleRow, id: 'mem-1', key: 'typescript-patterns' },
      { ...sampleRow, id: 'mem-2', key: 'typescript-generics' },
    ];
    mockOrderBy.mockResolvedValueOnce(matchingRows);

    const results = await store.search('tenant-1', 'agent-1', 'typescript');

    expect(results).toHaveLength(2);
    expect(results[0]!.key).toBe('typescript-patterns');
    expect(results[1]!.key).toBe('typescript-generics');
  });

  it('should retrieve memories for an agent ordered by relevance', async () => {
    const rows = [
      { ...sampleRow, id: 'mem-1', relevanceScore: 0.95 },
      { ...sampleRow, id: 'mem-2', relevanceScore: 0.80 },
    ];
    mockOrderBy.mockResolvedValueOnce(rows);

    const results = await store.getByAgent('tenant-1', 'agent-1');

    expect(results).toHaveLength(2);
    expect(results[0]!.relevanceScore).toBe(0.95);
    expect(results[1]!.relevanceScore).toBe(0.80);
  });
});
