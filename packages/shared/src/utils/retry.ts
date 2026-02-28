import type { Logger } from './logger.js';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffFactor: number;
  retryableErrors?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffFactor: 2,
};

export async function retry<T>(
  fn: () => Promise<T>,
  opts?: Partial<RetryOptions>,
  logger?: Logger,
): Promise<T> {
  const options = { ...DEFAULT_OPTIONS, ...opts };
  let lastError: unknown;

  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (options.retryableErrors && !options.retryableErrors(error)) {
        throw error;
      }

      if (attempt === options.maxAttempts) break;

      const delay = Math.min(
        options.baseDelayMs * Math.pow(options.backoffFactor, attempt - 1),
        options.maxDelayMs,
      );
      const jitter = delay * 0.1 * Math.random();

      logger?.warn({ attempt, delay: delay + jitter, error: String(error) }, 'Retrying after error');
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError;
}
