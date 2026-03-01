import type {
  ModelProvider,
  ProviderRequest,
  ProviderResponse,
  RoutingStrategy,
  FallbackChain,
} from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import type { BaseProvider } from './providers/base.js';
import { RoutingStrategyEngine } from './strategy.js';
import { FallbackChainExecutor } from './fallback-chain.js';
import { CostCalculator } from './cost-calculator.js';
import { TokenBucketRateLimiter } from './rate-limiter.js';
import { HealthMonitor } from './health-monitor.js';
import { ModelRegistry } from './model-registry.js';

const logger = createLogger('model-router');

export interface RouteOptions {
  strategy?: RoutingStrategy;
  preferredProvider?: ModelProvider;
}

/**
 * ModelRouter is the main entry point for model-agnostic LLM routing.
 * It composes all sub-components:
 * - ModelRegistry for route lookup
 * - RoutingStrategyEngine for route selection
 * - TokenBucketRateLimiter for throttling
 * - FallbackChainExecutor for resilience
 * - HealthMonitor for provider health tracking
 * - CostCalculator for cost tracking
 */
export class ModelRouter {
  private providers = new Map<ModelProvider, BaseProvider>();
  private strategyEngine: RoutingStrategyEngine;
  private fallbackExecutor: FallbackChainExecutor;
  private costCalculator: CostCalculator;
  private rateLimiter: TokenBucketRateLimiter;
  private healthMonitor: HealthMonitor;
  private registry: ModelRegistry;
  private defaultStrategy: RoutingStrategy;

  constructor(options?: {
    defaultStrategy?: RoutingStrategy;
    rateLimit?: number;
    maxFailures?: number;
    cooldownMs?: number;
  }) {
    this.defaultStrategy = options?.defaultStrategy ?? 'quality-optimized';
    this.strategyEngine = new RoutingStrategyEngine();
    this.costCalculator = new CostCalculator();
    this.rateLimiter = new TokenBucketRateLimiter(options?.rateLimit ?? 60);
    this.healthMonitor = new HealthMonitor(options?.maxFailures ?? 5, options?.cooldownMs ?? 60_000);
    this.registry = new ModelRegistry();
    this.fallbackExecutor = new FallbackChainExecutor(this.providers);

    logger.info({ defaultStrategy: this.defaultStrategy }, 'ModelRouter initialized');
  }

  /**
   * Register a provider implementation.
   */
  registerProvider(provider: BaseProvider): void {
    this.providers.set(provider.provider, provider);
    logger.info({ provider: provider.provider }, 'Provider registered');
  }

  /**
   * Get the model registry for route management.
   */
  getRegistry(): ModelRegistry {
    return this.registry;
  }

  /**
   * Get the health monitor for observability.
   */
  getHealthMonitor(): HealthMonitor {
    return this.healthMonitor;
  }

  /**
   * Get the rate limiter for configuration.
   */
  getRateLimiter(): TokenBucketRateLimiter {
    return this.rateLimiter;
  }

  /**
   * Route a request to the appropriate model provider.
   *
   * 1. Looks up available routes for the tenant
   * 2. Filters by preferred provider (if specified)
   * 3. Filters by healthy providers
   * 4. Uses the routing strategy to select the best route
   * 5. Applies rate limiting
   * 6. Executes the request with fallback chain for resilience
   * 7. Records metrics (latency, cost, health)
   */
  async route(
    tenantId: string,
    agentId: string,
    request: ProviderRequest,
    options?: RouteOptions,
  ): Promise<ProviderResponse> {
    const strategy = options?.strategy ?? this.defaultStrategy;

    logger.debug({ tenantId, agentId, strategy, preferredProvider: options?.preferredProvider }, 'Routing request');

    // 1. Get available routes for this tenant
    let routes = this.registry.getActiveRoutes(tenantId);

    if (routes.length === 0) {
      throw new Error(`No active routes found for tenant ${tenantId}. Register routes via the model registry.`);
    }

    // 2. Filter by preferred provider if specified
    if (options?.preferredProvider) {
      const filtered = routes.filter((r) => r.provider === options.preferredProvider);
      if (filtered.length > 0) {
        routes = filtered;
      } else {
        logger.warn({
          tenantId,
          preferredProvider: options.preferredProvider,
        }, 'Preferred provider has no active routes — falling back to all routes');
      }
    }

    // 3. Filter by healthy providers
    const healthyRoutes = routes.filter((r) => this.healthMonitor.isHealthy(r.provider));
    if (healthyRoutes.length > 0) {
      routes = healthyRoutes;
    } else {
      logger.warn({ tenantId }, 'No healthy providers — attempting all available routes');
    }

    // 4. Select route using strategy
    const selectedRoute = this.strategyEngine.selectRoute(routes, strategy);

    // 5. Apply rate limiting
    await this.rateLimiter.acquire(selectedRoute.provider);

    // 6. Execute with fallback chain
    const fallbackChain = this.buildFallbackChain(selectedRoute, routes);

    let response: ProviderResponse;
    try {
      if (fallbackChain) {
        response = await this.fallbackExecutor.execute(fallbackChain, request);
      } else {
        // No fallback — call provider directly
        const provider = this.providers.get(selectedRoute.provider);
        if (!provider) {
          throw new Error(`Provider ${selectedRoute.provider} is not registered`);
        }
        response = await provider.generate(request);
      }

      // 7. Record success metrics
      this.healthMonitor.recordSuccess(response.provider);
      this.strategyEngine.recordLatency(selectedRoute.id, response.latencyMs);

      logger.info({
        tenantId,
        agentId,
        routeId: selectedRoute.id,
        provider: response.provider,
        modelId: response.modelId,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
        costUsd: response.costUsd,
      }, 'Request routed successfully');

      return response;
    } catch (err) {
      // Record failure
      this.healthMonitor.recordFailure(selectedRoute.provider);

      logger.error({
        tenantId,
        agentId,
        routeId: selectedRoute.id,
        provider: selectedRoute.provider,
        err: err instanceof Error ? err.message : String(err),
      }, 'Request routing failed');

      throw err;
    }
  }

  /**
   * Build a fallback chain from the selected route and available alternatives.
   */
  private buildFallbackChain(
    selectedRoute: { provider: ModelProvider; id: string },
    allRoutes: Array<{ provider: ModelProvider; id: string }>,
  ): FallbackChain | null {
    // Find alternative providers for fallback
    const alternatives = allRoutes.filter(
      (r) => r.provider !== selectedRoute.provider && this.providers.has(r.provider as ModelProvider),
    );

    if (alternatives.length === 0) return null;

    const chain: FallbackChain = {
      primary: selectedRoute.provider,
      secondary: alternatives[0]!.provider,
      maxRetries: 1,
    };

    if (alternatives.length > 1) {
      chain.tertiary = alternatives[1]!.provider;
    }

    return chain;
  }
}
