import type { ModelRoute, RoutingStrategy } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';

const logger = createLogger('model-router:strategy');

/**
 * Per-route latency tracking for latency-optimized strategy.
 */
interface LatencyRecord {
  totalMs: number;
  count: number;
}

/**
 * Implements routing strategy logic to select the best ModelRoute
 * from a set of candidates based on the chosen strategy.
 */
export class RoutingStrategyEngine {
  private roundRobinIndex = 0;
  private latencyRecords = new Map<string, LatencyRecord>();

  /**
   * Selects a route from the given candidates using the specified strategy.
   * Only considers active routes.
   */
  selectRoute(routes: ModelRoute[], strategy: RoutingStrategy): ModelRoute {
    const activeRoutes = routes.filter((r) => r.isActive);

    if (activeRoutes.length === 0) {
      throw new Error('No active routes available for selection');
    }

    let selected: ModelRoute;

    switch (strategy) {
      case 'cost-optimized':
        selected = this.selectCostOptimized(activeRoutes);
        break;
      case 'quality-optimized':
        selected = this.selectQualityOptimized(activeRoutes);
        break;
      case 'latency-optimized':
        selected = this.selectLatencyOptimized(activeRoutes);
        break;
      case 'round-robin':
        selected = this.selectRoundRobin(activeRoutes);
        break;
      default: {
        const _exhaustive: never = strategy;
        throw new Error(`Unknown routing strategy: ${_exhaustive}`);
      }
    }

    logger.debug({
      strategy,
      selectedRoute: selected.id,
      provider: selected.provider,
      modelId: selected.modelId,
    }, 'Route selected');

    return selected;
  }

  /**
   * Records latency for a route so the latency-optimized strategy
   * can use historical data for selection.
   */
  recordLatency(routeId: string, latencyMs: number): void {
    const existing = this.latencyRecords.get(routeId);
    if (existing) {
      existing.totalMs += latencyMs;
      existing.count += 1;
    } else {
      this.latencyRecords.set(routeId, { totalMs: latencyMs, count: 1 });
    }
  }

  /**
   * Returns the average latency for a route, or Infinity if no data.
   */
  getAverageLatency(routeId: string): number {
    const record = this.latencyRecords.get(routeId);
    if (!record || record.count === 0) return Infinity;
    return record.totalMs / record.count;
  }

  /**
   * Cost-optimized: select the cheapest route based on input pricing.
   * Uses output pricing as a tiebreaker.
   */
  private selectCostOptimized(routes: ModelRoute[]): ModelRoute {
    return routes.reduce((cheapest, route) => {
      const cheapestCost = cheapest.pricing.inputPer1kTokens + cheapest.pricing.outputPer1kTokens;
      const routeCost = route.pricing.inputPer1kTokens + route.pricing.outputPer1kTokens;
      return routeCost < cheapestCost ? route : cheapest;
    });
  }

  /**
   * Quality-optimized: select the highest priority route.
   * Lower priority number = higher quality.
   */
  private selectQualityOptimized(routes: ModelRoute[]): ModelRoute {
    return routes.reduce((best, route) => {
      return route.priority < best.priority ? route : best;
    });
  }

  /**
   * Latency-optimized: select the route with the lowest average latency.
   * Falls back to priority if no latency data is available.
   */
  private selectLatencyOptimized(routes: ModelRoute[]): ModelRoute {
    return routes.reduce((fastest, route) => {
      const fastestLatency = this.getAverageLatency(fastest.id);
      const routeLatency = this.getAverageLatency(route.id);
      return routeLatency < fastestLatency ? route : fastest;
    });
  }

  /**
   * Round-robin: cycle through routes sequentially.
   */
  private selectRoundRobin(routes: ModelRoute[]): ModelRoute {
    const index = this.roundRobinIndex % routes.length;
    this.roundRobinIndex += 1;
    return routes[index]!;
  }
}
