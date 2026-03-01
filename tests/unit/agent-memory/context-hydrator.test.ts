import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteFile = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs/promises', () => ({
  writeFile: mockWriteFile,
}));

vi.mock('@agentcoders/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
  getDb: vi.fn(),
  agentMemories: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  like: vi.fn(),
  lte: vi.fn(),
}));

// Mock the MemoryStore dependency
const mockGetByAgent = vi.fn();
vi.mock('../../../packages/agent-memory/src/memory-store.js', () => ({
  MemoryStore: vi.fn().mockImplementation(() => ({
    getByAgent: mockGetByAgent,
  })),
}));

const { ContextHydrator } = await import('../../../packages/agent-memory/src/context-hydrator.js');
const { MemoryStore } = await import('../../../packages/agent-memory/src/memory-store.js');

describe('ContextHydrator', () => {
  let hydrator: InstanceType<typeof ContextHydrator>;
  let mockStore: any;

  const sampleMemories = [
    {
      id: 'mem-1',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      category: 'learning',
      key: 'error-handling',
      content: 'Always use try-catch with async/await',
      relevanceScore: 0.9,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'mem-2',
      tenantId: 'tenant-1',
      agentId: 'agent-1',
      category: 'convention',
      key: 'naming',
      content: 'Use camelCase for variables, PascalCase for types',
      relevanceScore: 0.85,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore = new MemoryStore();
    hydrator = new ContextHydrator(mockStore);
  });

  it('should write MEMORY.md to the workspace .claude directory', async () => {
    mockGetByAgent.mockResolvedValueOnce(sampleMemories);

    await hydrator.hydrate('tenant-1', 'agent-1', '/workspace/project');

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, content] = mockWriteFile.mock.calls[0] as [string, string, string];
    expect(filePath).toBe('/workspace/project/.claude/MEMORY.md');
    expect(content).toContain('# Agent Memory (Auto-hydrated)');
    expect(content).toContain('error-handling');
    expect(content).toContain('Always use try-catch with async/await');
    expect(content).toContain('naming');
  });

  it('should filter relevant memories based on task context', async () => {
    const manyMemories = [
      ...sampleMemories,
      {
        id: 'mem-3',
        tenantId: 'tenant-1',
        agentId: 'agent-1',
        category: 'learning',
        key: 'database-optimization',
        content: 'Use indexes on frequently queried columns',
        relevanceScore: 0.7,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    mockGetByAgent.mockResolvedValueOnce(manyMemories);

    await hydrator.hydrate(
      'tenant-1',
      'agent-1',
      '/workspace/project',
      'Fix error handling in the authentication module',
    );

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [, content] = mockWriteFile.mock.calls[0] as [string, string, string];
    // The error-handling memory should be included (key match on "error-handling")
    expect(content).toContain('error-handling');
  });

  it('should not write anything when agent has no memories', async () => {
    mockGetByAgent.mockResolvedValueOnce([]);

    await hydrator.hydrate('tenant-1', 'agent-1', '/workspace/project');

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  it('should group memories by category in the output', async () => {
    mockGetByAgent.mockResolvedValueOnce(sampleMemories);

    await hydrator.hydrate('tenant-1', 'agent-1', '/workspace/project');

    const [, content] = mockWriteFile.mock.calls[0] as [string, string, string];
    // Categories are capitalized as headings
    expect(content).toContain('## Learning');
    expect(content).toContain('## Convention');
  });
});
