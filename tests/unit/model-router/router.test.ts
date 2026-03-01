import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@agentcoders/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { ModelRouter } from '../../../packages/model-router/src/router.js';
import { BaseProvider } from '../../../packages/model-router/src/providers/base.js';
import type { ProviderRequest, ProviderResponse, ModelProvider, ModelRoute } from '@agentcoders/shared';

class MockProvider extends BaseProvider {
  readonly provider: ModelProvider;
  private generateFn: (req: ProviderRequest) => Promise<ProviderResponse>;

  constructor(provider: ModelProvider, generateFn: (req: ProviderRequest) => Promise<ProviderResponse>) {
    super();
    this.provider = provider;
    this.generateFn = generateFn;
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    return this.generateFn(request);
  }

  listModels(): string[] {
    return ['mock-model'];
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

function makeRoute(overrides: Partial<ModelRoute> & { id: string; tenantId: string; provider: ModelProvider }): ModelRoute {
  return {
    modelId: 'claude-3',
    capabilities: {
      maxTokens: 4096,
      supportsVision: false,
      supportsTools: true,
      supportsStreaming: true,
      contextWindow: 200000,
    },
    pricing: {
      inputPer1kTokens: 0.015,
      outputPer1kTokens: 0.075,
      currency: 'USD',
    },
    isActive: true,
    priority: 1,
    ...overrides,
  };
}

describe('ModelRouter', () => {
  let router: ModelRouter;
  let mockResponse: ProviderResponse;

  beforeEach(() => {
    router = new ModelRouter({ defaultStrategy: 'cost-optimized', rateLimit: 1000 });
    mockResponse = {
      content: 'Hello from mock',
      provider: 'anthropic' as ModelProvider,
      modelId: 'claude-3',
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 200,
      costUsd: 0.003,
      finishReason: 'complete',
    };
  });

  it('should throw when no routes are registered for a tenant', async () => {
    const provider = new MockProvider('anthropic' as ModelProvider, async () => mockResponse);
    router.registerProvider(provider);

    await expect(
      router.route('unknown-tenant', 'agent-1', { prompt: 'hi' }),
    ).rejects.toThrow(/No active routes found/);
  });

  it('should route to the registered provider and return response', async () => {
    const provider = new MockProvider('anthropic' as ModelProvider, async () => mockResponse);
    router.registerProvider(provider);

    const registry = router.getRegistry();
    registry.register(makeRoute({
      id: 'route-1',
      tenantId: 'tenant-1',
      provider: 'anthropic' as ModelProvider,
    }));

    const result = await router.route(
      'tenant-1',
      'agent-1',
      { prompt: 'test' },
    );

    expect(result.content).toBe('Hello from mock');
    expect(result.provider).toBe('anthropic');
    expect(result.costUsd).toBe(0.003);
  });

  it('should track cost data in the response', async () => {
    const expensiveResponse: ProviderResponse = {
      content: 'expensive result',
      provider: 'anthropic' as ModelProvider,
      modelId: 'claude-3',
      inputTokens: 5000,
      outputTokens: 2000,
      latencyMs: 500,
      costUsd: 0.225,
      finishReason: 'complete',
    };
    const provider = new MockProvider('anthropic' as ModelProvider, async () => expensiveResponse);
    router.registerProvider(provider);

    const registry = router.getRegistry();
    registry.register(makeRoute({
      id: 'route-2',
      tenantId: 'tenant-2',
      provider: 'anthropic' as ModelProvider,
    }));

    const result = await router.route(
      'tenant-2',
      'agent-1',
      { prompt: 'big request' },
    );

    expect(result.costUsd).toBe(0.225);
    expect(result.inputTokens).toBe(5000);
    expect(result.outputTokens).toBe(2000);
  });
});
