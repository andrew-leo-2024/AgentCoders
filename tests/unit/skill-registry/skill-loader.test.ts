import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs/promises', () => ({
  mkdir: mockMkdir,
  writeFile: mockWriteFile,
}));

vi.mock('@agentcoders/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

const { SkillLoader } = await import('../../../packages/skill-registry/src/skill-loader.js');

describe('SkillLoader', () => {
  let loader: InstanceType<typeof SkillLoader>;

  beforeEach(() => {
    vi.clearAllMocks();
    loader = new SkillLoader();
  });

  it('should write skill files to workspace .claude/skills directory', async () => {
    const skills = [
      {
        id: 'skill-1',
        name: 'test-skill',
        category: 'testing' as const,
        version: '1.0.0',
        description: 'A test skill',
        content: '# Test Skill\n\nDo testing things.',
        isBuiltin: false,
        createdAt: new Date(),
      },
      {
        id: 'skill-2',
        name: 'deploy-skill',
        category: 'devops' as const,
        version: '1.0.0',
        description: 'A deploy skill',
        content: '# Deploy Skill\n\nDeploy to production.',
        isBuiltin: false,
        createdAt: new Date(),
      },
    ];

    const paths = await loader.writeToWorkspace(skills, '/workspace/project');

    // Should create the skills directory
    expect(mockMkdir).toHaveBeenCalledWith(
      '/workspace/project/.claude/skills',
      { recursive: true },
    );

    // Should create a directory for each skill
    expect(mockMkdir).toHaveBeenCalledWith(
      '/workspace/project/.claude/skills/test-skill',
      { recursive: true },
    );
    expect(mockMkdir).toHaveBeenCalledWith(
      '/workspace/project/.claude/skills/deploy-skill',
      { recursive: true },
    );

    // Should write SKILL.md for each skill
    expect(mockWriteFile).toHaveBeenCalledTimes(2);
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/workspace/project/.claude/skills/test-skill/SKILL.md',
      '# Test Skill\n\nDo testing things.',
      'utf-8',
    );
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/workspace/project/.claude/skills/deploy-skill/SKILL.md',
      '# Deploy Skill\n\nDeploy to production.',
      'utf-8',
    );

    // Should return written paths
    expect(paths).toHaveLength(2);
    expect(paths[0]).toBe('/workspace/project/.claude/skills/test-skill/SKILL.md');
    expect(paths[1]).toBe('/workspace/project/.claude/skills/deploy-skill/SKILL.md');
  });

  it('should load builtin skills with expected structure', async () => {
    const builtins = await loader.loadBuiltins();

    expect(builtins.length).toBeGreaterThanOrEqual(1);

    for (const skill of builtins) {
      expect(skill).toHaveProperty('name');
      expect(skill).toHaveProperty('category');
      expect(skill).toHaveProperty('version');
      expect(skill).toHaveProperty('description');
      expect(skill).toHaveProperty('content');
      expect(skill.isBuiltin).toBe(true);
      expect(typeof skill.name).toBe('string');
      expect(typeof skill.content).toBe('string');
      expect(skill.content.length).toBeGreaterThan(0);
    }
  });

  it('should include specific well-known builtin skills', async () => {
    const builtins = await loader.loadBuiltins();
    const names = builtins.map((s) => s.name);

    expect(names).toContain('frontend-design');
    expect(names).toContain('tdd-workflow');
    expect(names).toContain('security-audit');
    expect(names).toContain('api-design');
  });

  it('should handle empty skills array without errors', async () => {
    const paths = await loader.writeToWorkspace([], '/workspace/project');

    // Should still create the skills directory
    expect(mockMkdir).toHaveBeenCalledWith(
      '/workspace/project/.claude/skills',
      { recursive: true },
    );
    // No files should be written
    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(paths).toHaveLength(0);
  });
});
