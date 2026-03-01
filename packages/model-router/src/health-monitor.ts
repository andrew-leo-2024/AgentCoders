import type { ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';

const logger = createLogger('model-router:health');

interface ProviderHealth {
  consecutiveFailures: number;
  consecutiveSuccesses: number;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  isDisabled: boolean;
  disabledAt: number | null;
}

/**
 * Tracks the health of each model provider.
 * Automatically disables a provider after N consecutive failures
 * and re-enables it after a cooldown period.
 */
export class HealthMonitor {
  private health = new Map<ModelProvider, ProviderHealth>();
  private maxConsecutiveFailures: number;
  private cooldownMs: number;

  /**
   * @param maxConsecutiveFailures Number of consecutive failures before disabling a provider.
   * @param cooldownMs Milliseconds to wait before re-enabling a disabled provider.
   */
  constructor(maxConsecutiveFailures: number = 5, cooldownMs: number = 60_000) {
    this.maxConsecutiveFailures = maxConsecutiveFailures;
    this.cooldownMs = cooldownMs;
  }

  /**
   * Record a successful call to a provider.
   * Resets the consecutive failure counter and re-enables the provider if disabled.
   */
  recordSuccess(provider: ModelProvider): void {
    const state = this.getOrCreate(provider);
    state.consecutiveFailures = 0;
    state.consecutiveSuccesses += 1;
    state.lastSuccessAt = Date.now();

    if (state.isDisabled) {
      state.isDisabled = false;
      state.disabledAt = null;
      logger.info({ provider }, 'Provider re-enabled after successful call');
    }
  }

  /**
   * Record a failed call to a provider.
   * Disables the provider if consecutive failures exceed the threshold.
   */
  recordFailure(provider: ModelProvider): void {
    const state = this.getOrCreate(provider);
    state.consecutiveFailures += 1;
    state.consecutiveSuccesses = 0;
    state.lastFailureAt = Date.now();

    if (state.consecutiveFailures >= this.maxConsecutiveFailures && !state.isDisabled) {
      state.isDisabled = true;
      state.disabledAt = Date.now();
      logger.warn({
        provider,
        consecutiveFailures: state.consecutiveFailures,
        cooldownMs: this.cooldownMs,
      }, 'Provider disabled due to consecutive failures');
    }
  }

  /**
   * Check if a provider is considered healthy.
   * A provider is healthy if it is not disabled, or if the cooldown period has elapsed.
   */
  isHealthy(provider: ModelProvider): boolean {
    const state = this.health.get(provider);

    // Unknown providers are assumed healthy
    if (!state) return true;

    // If not disabled, it is healthy
    if (!state.isDisabled) return true;

    // Check if cooldown has elapsed
    if (state.disabledAt && (Date.now() - state.disabledAt) >= this.cooldownMs) {
      // Cooldown elapsed — re-enable and allow a trial
      state.isDisabled = false;
      state.disabledAt = null;
      state.consecutiveFailures = 0;
      logger.info({ provider, cooldownMs: this.cooldownMs }, 'Provider re-enabled after cooldown');
      return true;
    }

    return false;
  }

  /**
   * Returns the health state for a provider.
   */
  getHealth(provider: ModelProvider): ProviderHealth | undefined {
    return this.health.get(provider);
  }

  /**
   * Returns all tracked providers and their health states.
   */
  getAllHealth(): Map<ModelProvider, ProviderHealth> {
    return new Map(this.health);
  }

  /**
   * Get or create a health record for a provider.
   */
  private getOrCreate(provider: ModelProvider): ProviderHealth {
    let state = this.health.get(provider);
    if (!state) {
      state = {
        consecutiveFailures: 0,
        consecutiveSuccesses: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        isDisabled: false,
        disabledAt: null,
      };
      this.health.set(provider, state);
    }
    return state;
  }
}
