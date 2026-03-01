import type { ModelRoute } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';

const logger = createLogger('model-router:registry');

/**
 * In-memory registry of available model routes.
 * Stores routes per tenant and provides lookup/query capabilities.
 * Can be extended to persist to the database.
 */
export class ModelRegistry {
  /** All routes indexed by route ID */
  private routes = new Map<string, ModelRoute>();
  /** Routes indexed by tenant ID */
  private tenantRoutes = new Map<string, Set<string>>();

  /**
   * Register a new model route.
   * If a route with the same ID already exists, it is overwritten.
   */
  register(route: ModelRoute): void {
    this.routes.set(route.id, route);

    // Index by tenant
    let tenantSet = this.tenantRoutes.get(route.tenantId);
    if (!tenantSet) {
      tenantSet = new Set();
      this.tenantRoutes.set(route.tenantId, tenantSet);
    }
    tenantSet.add(route.id);

    logger.info({
      routeId: route.id,
      tenantId: route.tenantId,
      provider: route.provider,
      modelId: route.modelId,
    }, 'Model route registered');
  }

  /**
   * Unregister a model route by ID.
   */
  unregister(routeId: string): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;

    this.routes.delete(routeId);

    const tenantSet = this.tenantRoutes.get(route.tenantId);
    if (tenantSet) {
      tenantSet.delete(routeId);
      if (tenantSet.size === 0) {
        this.tenantRoutes.delete(route.tenantId);
      }
    }

    logger.info({ routeId, tenantId: route.tenantId }, 'Model route unregistered');
    return true;
  }

  /**
   * Get all routes for a tenant.
   */
  getRoutes(tenantId: string): ModelRoute[] {
    const routeIds = this.tenantRoutes.get(tenantId);
    if (!routeIds) return [];

    const routes: ModelRoute[] = [];
    for (const id of routeIds) {
      const route = this.routes.get(id);
      if (route) routes.push(route);
    }
    return routes;
  }

  /**
   * Get a specific route by ID.
   */
  getRoute(id: string): ModelRoute | undefined {
    return this.routes.get(id);
  }

  /**
   * Get all active routes for a tenant.
   */
  getActiveRoutes(tenantId: string): ModelRoute[] {
    return this.getRoutes(tenantId).filter((r) => r.isActive);
  }

  /**
   * Update the active status of a route.
   */
  setActive(routeId: string, isActive: boolean): boolean {
    const route = this.routes.get(routeId);
    if (!route) return false;

    route.isActive = isActive;
    logger.info({ routeId, isActive }, 'Route active status updated');
    return true;
  }

  /**
   * Returns the total number of registered routes.
   */
  get size(): number {
    return this.routes.size;
  }

  /**
   * Returns all registered routes across all tenants.
   */
  getAllRoutes(): ModelRoute[] {
    return Array.from(this.routes.values());
  }
}
