import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @agentcoders/shared before importing source modules
vi.mock('@agentcoders/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { EnhancementPipeline } from '../../../packages/enhancement-layer/src/pipeline.js';
import { PipelineBuilder } from '../../../packages/enhancement-layer/src/pipeline-builder.js';
import type { EnhancementStage, StageContext, StageOutput } from '../../../packages/enhancement-layer/src/stage-interface.js';

function makeContext(overrides: Partial<StageContext> = {}): StageContext {
  return {
    tenantId: 'tenant-1',
    agentId: 'agent-1',
    metadata: {},
    ...overrides,
  };
}

function makeStage(
  name: string,
  type: 'amplifier' | 'stabilizer' | 'codec' | 'armour',
  executeFn: (input: string, ctx: StageContext) => Promise<StageOutput>,
): EnhancementStage {
  return { name, type, execute: executeFn };
}

describe('EnhancementPipeline', () => {
  it('should pass through input unchanged when pipeline has no stages', async () => {
    const config = { amplifiers: {}, stabilizers: {}, codecs: {}, armours: {} };
    const pipeline = new EnhancementPipeline(config);

    const result = await pipeline.execute('hello world', makeContext());

    expect(result.originalInput).toBe('hello world');
    expect(result.enhancedOutput).toBe('hello world');
    expect(result.stages).toHaveLength(0);
    expect(result.finalScore).toBe(1.0);
  });

  it('should track timing and stage results through execution', async () => {
    const config = { amplifiers: {}, stabilizers: {}, codecs: {}, armours: {} };
    const pipeline = new EnhancementPipeline(config);

    const upperStage = makeStage('upper', 'codec', async (input) => ({
      content: input.toUpperCase(),
      modified: true,
      details: { transform: 'uppercase' },
    }));

    const noopStage = makeStage('noop', 'stabilizer', async (input) => ({
      content: input,
      modified: false,
      details: { confidence: 0.95 },
    }));

    pipeline.addStage(upperStage);
    pipeline.addStage(noopStage);

    const result = await pipeline.execute('hello', makeContext());

    expect(result.enhancedOutput).toBe('HELLO');
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0]!.stage).toBe('upper');
    expect(result.stages[0]!.modified).toBe(true);
    expect(result.stages[0]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.stages[1]!.stage).toBe('noop');
    expect(result.stages[1]!.modified).toBe(false);
    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle stage failures gracefully and continue', async () => {
    const config = { amplifiers: {}, stabilizers: {}, codecs: {}, armours: {} };
    const pipeline = new EnhancementPipeline(config);

    const failStage = makeStage('fail', 'amplifier', async () => {
      throw new Error('Stage exploded');
    });

    const okStage = makeStage('ok', 'codec', async (input) => ({
      content: input + '!',
      modified: true,
      details: {},
    }));

    pipeline.addStage(failStage);
    pipeline.addStage(okStage);

    const result = await pipeline.execute('test', makeContext());

    expect(result.enhancedOutput).toBe('test!');
    expect(result.stages).toHaveLength(2);
    expect(result.stages[0]!.details).toHaveProperty('failed', true);
    expect(result.stages[0]!.details).toHaveProperty('error', 'Stage exploded');
    expect(result.stages[1]!.modified).toBe(true);
    // Score should be penalized for the failure
    expect(result.finalScore).toBeLessThan(1.0);
  });
});

describe('PipelineBuilder', () => {
  it('should create a valid pipeline config via builder pattern', () => {
    const pipeline = PipelineBuilder.create()
      .withAmplifiers({})
      .withStabilizers({})
      .withCodecs({})
      .withArmours({})
      .build();

    expect(pipeline).toBeInstanceOf(EnhancementPipeline);
    const config = pipeline.getConfig();
    expect(config).toHaveProperty('amplifiers');
    expect(config).toHaveProperty('stabilizers');
    expect(config).toHaveProperty('codecs');
    expect(config).toHaveProperty('armours');
  });

  it('should add security scanner stage when armour config enables it', () => {
    const pipeline = PipelineBuilder.create()
      .withArmours({
        securityScanner: { enabled: true, checks: ['xss', 'secrets'] },
      })
      .build();

    const stages = pipeline.getStages();
    expect(stages.length).toBeGreaterThanOrEqual(1);
    const scannerStage = stages.find((s) => s.name === 'security-scanner');
    expect(scannerStage).toBeDefined();
    expect(scannerStage!.type).toBe('armour');
  });
});
