import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@agentcoders/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { FallbackChainExecutor } from '../../../packages/model-router/src/fallback-chain.js';
import { BaseProvider } from '../../../packages/model-router/src/providers/base.js';
import type { ModelProvider, ProviderRequest, ProviderResponse, FallbackChain } from '@agentcoders/shared';

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
    return ['mock'];
  }

  async isHealthy(): Promise<boolean> {
    return true;
  }
}

function makeResponse(provider: ModelProvider): ProviderResponse {
  return {
    content: `response from ${provider}`,
    provider,
    modelId: 'model-1',
    inputTokens: 10,
    outputTokens: 20,
    latencyMs: 100,
    costUsd: 0.001,
    finishReason: 'complete',
  };
}

describe('FallbackChainExecutor', () => {
  const request: ProviderRequest = {
    prompt: 'test',
  };

  it('should fall back to secondary when primary fails', async () => {
    const primaryProvider = new MockProvider('anthropic' as ModelProvider, async () => {
      throw new Error('primary down');
    });
    const secondaryProvider = new MockProvider('openai' as ModelProvider, async () =>
      makeResponse('openai' as ModelProvider),
    );

    const providers = new Map<ModelProvider, BaseProvider>();
    providers.set('anthropic' as ModelProvider, primaryProvider);
    providers.set('openai' as ModelProvider, secondaryProvider);

    const executor = new FallbackChainExecutor(providers);
    const chain: FallbackChain = {
      primary: 'anthropic' as ModelProvider,
      secondary: 'openai' as ModelProvider,
      maxRetries: 0,
    };

    const result = await executor.execute(chain, request);
    expect(result.provider).toBe('openai');
    expect(result.content).toBe('response from openai');
  });

  it('should return error when all providers fail', async () => {
    const failingPrimary = new MockProvider('anthropic' as ModelProvider, async () => {
      throw new Error('primary exploded');
    });
    const failingSecondary = new MockProvider('openai' as ModelProvider, async () => {
      throw new Error('secondary exploded');
    });

    const providers = new Map<ModelProvider, BaseProvider>();
    providers.set('anthropic' as ModelProvider, failingPrimary);
    providers.set('openai' as ModelProvider, failingSecondary);

    const executor = new FallbackChainExecutor(providers);
    const chain: FallbackChain = {
      primary: 'anthropic' as ModelProvider,
      secondary: 'openai' as ModelProvider,
      maxRetries: 0,
    };

    await expect(executor.execute(chain, request)).rejects.toThrow('secondary exploded');
  });

  it('should retry primary before falling back based on maxRetries', async () => {
    let primaryCalls = 0;
    const primaryProvider = new MockProvider('anthropic' as ModelProvider, async () => {
      primaryCalls++;
      throw new Error('still failing');
    });
    const secondaryProvider = new MockProvider('openai' as ModelProvider, async () =>
      makeResponse('openai' as ModelProvider),
    );

    const providers = new Map<ModelProvider, BaseProvider>();
    providers.set('anthropic' as ModelProvider, primaryProvider);
    providers.set('openai' as ModelProvider, secondaryProvider);

    const executor = new FallbackChainExecutor(providers);
    const chain: FallbackChain = {
      primary: 'anthropic' as ModelProvider,
      secondary: 'openai' as ModelProvider,
      maxRetries: 2,
    };

    const result = await executor.execute(chain, request);

    // primary should be called 1 (initial) + 2 (retries) = 3 times
    expect(primaryCalls).toBe(3);
    expect(result.provider).toBe('openai');
  });

  it('should use primary when it succeeds', async () => {
    const primaryProvider = new MockProvider('anthropic' as ModelProvider, async () =>
      makeResponse('anthropic' as ModelProvider),
    );
    const secondaryProvider = new MockProvider('openai' as ModelProvider, async () =>
      makeResponse('openai' as ModelProvider),
    );

    const providers = new Map<ModelProvider, BaseProvider>();
    providers.set('anthropic' as ModelProvider, primaryProvider);
    providers.set('openai' as ModelProvider, secondaryProvider);

    const executor = new FallbackChainExecutor(providers);
    const chain: FallbackChain = {
      primary: 'anthropic' as ModelProvider,
      secondary: 'openai' as ModelProvider,
      maxRetries: 1,
    };

    const result = await executor.execute(chain, request);
    expect(result.provider).toBe('anthropic');
    expect(result.content).toBe('response from anthropic');
  });
});
