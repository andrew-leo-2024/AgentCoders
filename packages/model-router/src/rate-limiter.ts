import type { ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';

const logger = createLogger('model-router:rate-limiter');

interface TokenBucket {
  tokens: number;
  lastRefillAt: number;
  tokensPerMinute: number;
}

/**
 * Token bucket rate limiter that enforces per-provider request rate limits.
 * Each provider gets its own bucket with a configurable tokens-per-minute rate.
 */
export class TokenBucketRateLimiter {
  private buckets = new Map<ModelProvider, TokenBucket>();
  private defaultTokensPerMinute: number;

  constructor(defaultTokensPerMinute: number = 60) {
    this.defaultTokensPerMinute = defaultTokensPerMinute;
  }

  /**
   * Configure the rate limit for a specific provider.
   */
  configure(provider: ModelProvider, tokensPerMinute: number): void {
    this.buckets.set(provider, {
      tokens: tokensPerMinute,
      lastRefillAt: Date.now(),
      tokensPerMinute,
    });
    logger.info({ provider, tokensPerMinute }, 'Rate limit configured');
  }

  /**
   * Acquire a token from the provider's bucket.
   * If the bucket is empty, waits until a token becomes available.
   */
  async acquire(provider: ModelProvider): Promise<void> {
    const bucket = this.getOrCreateBucket(provider);
    this.refill(bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return;
    }

    // Bucket is empty — calculate wait time until next token is available
    const tokensPerMs = bucket.tokensPerMinute / 60_000;
    const waitMs = Math.ceil((1 - bucket.tokens) / tokensPerMs);

    logger.debug({ provider, waitMs }, 'Rate limit reached — waiting for token');

    await this.sleep(waitMs);

    // Refill after waiting
    this.refill(bucket);
    bucket.tokens -= 1;
  }

  /**
   * Check if a provider has available capacity without consuming a token.
   */
  hasCapacity(provider: ModelProvider): boolean {
    const bucket = this.getOrCreateBucket(provider);
    this.refill(bucket);
    return bucket.tokens >= 1;
  }

  /**
   * Returns the number of available tokens for a provider.
   */
  getAvailableTokens(provider: ModelProvider): number {
    const bucket = this.getOrCreateBucket(provider);
    this.refill(bucket);
    return Math.floor(bucket.tokens);
  }

  /**
   * Get or create a bucket for a provider with default settings.
   */
  private getOrCreateBucket(provider: ModelProvider): TokenBucket {
    let bucket = this.buckets.get(provider);
    if (!bucket) {
      bucket = {
        tokens: this.defaultTokensPerMinute,
        lastRefillAt: Date.now(),
        tokensPerMinute: this.defaultTokensPerMinute,
      };
      this.buckets.set(provider, bucket);
    }
    return bucket;
  }

  /**
   * Refill the bucket based on elapsed time since last refill.
   */
  private refill(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsedMs = now - bucket.lastRefillAt;
    const tokensToAdd = (elapsedMs / 60_000) * bucket.tokensPerMinute;

    bucket.tokens = Math.min(bucket.tokensPerMinute, bucket.tokens + tokensToAdd);
    bucket.lastRefillAt = now;
  }

  /**
   * Sleep for the given duration in milliseconds.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
