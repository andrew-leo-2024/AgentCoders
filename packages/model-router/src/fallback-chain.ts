import type { FallbackChain, ProviderRequest, ProviderResponse, ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import type { BaseProvider } from './providers/base.js';

const logger = createLogger('model-router:fallback');

interface FailureRecord {
  consecutiveFailures: number;
  lastFailureAt: number;
}

/**
 * Executes a request through a fallback chain of providers.
 * Tries the primary provider first, then secondary, then tertiary.
 * Tracks failures per provider for observability.
 */
export class FallbackChainExecutor {
  private providers: Map<ModelProvider, BaseProvider>;
  private failures = new Map<string, FailureRecord>();

  constructor(providers: Map<ModelProvider, BaseProvider>) {
    this.providers = providers;
  }

  /**
   * Execute a request through the fallback chain.
   * Tries each provider in order: primary -> secondary -> tertiary.
   * Throws the last encountered error if all providers fail.
   */
  async execute(chain: FallbackChain, request: ProviderRequest): Promise<ProviderResponse> {
    const providerIds = [chain.primary, chain.secondary];
    if (chain.tertiary) {
      providerIds.push(chain.tertiary);
    }

    let lastError: Error | null = null;

    for (const providerId of providerIds) {
      const provider = this.providers.get(providerId as ModelProvider);
      if (!provider) {
        logger.warn({ providerId }, 'Provider not found in fallback chain — skipping');
        continue;
      }

      for (let attempt = 0; attempt <= chain.maxRetries; attempt++) {
        try {
          const response = await provider.generate(request);
          this.recordSuccess(providerId);

          if (providerId !== chain.primary) {
            logger.info({ providerId, primary: chain.primary }, 'Request served by fallback provider');
          }

          return response;
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err));
          this.recordFailure(providerId);

          logger.warn({
            providerId,
            attempt: attempt + 1,
            maxRetries: chain.maxRetries,
            err: lastError.message,
          }, 'Provider attempt failed');
        }
      }
    }

    throw lastError ?? new Error('All providers in fallback chain failed');
  }

  /**
   * Records a successful call to a provider, resetting its failure count.
   */
  private recordSuccess(providerId: string): void {
    this.failures.delete(providerId);
  }

  /**
   * Records a failed call to a provider.
   */
  private recordFailure(providerId: string): void {
    const existing = this.failures.get(providerId);
    if (existing) {
      existing.consecutiveFailures += 1;
      existing.lastFailureAt = Date.now();
    } else {
      this.failures.set(providerId, {
        consecutiveFailures: 1,
        lastFailureAt: Date.now(),
      });
    }
  }

  /**
   * Returns the failure record for a given provider.
   */
  getFailureRecord(providerId: string): FailureRecord | undefined {
    return this.failures.get(providerId);
  }
}
