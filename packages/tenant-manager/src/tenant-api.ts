/**
 * tenant-api.ts — REST API entry point for the tenant-manager service.
 *
 * Uses raw Node.js http module (no Express).
 * Parses URL, routes requests, returns JSON.
 */

import * as http from 'node:http';
import { eq } from 'drizzle-orm';

import {
  createLogger,
  loadConfig,
  tenantManagerConfigSchema,
  getDb,
  tenants,
  auditEvents,
  telemetryRecords,
  failurePatterns,
  modelRoutes,
  skills,
  managementConfigs,
  enhancementRuns,
  insurancePolicies,
} from '@agentcoders/shared';
import type { TenantVertical, VerticalType } from '@agentcoders/shared';

import { OnboardingService, type SignupParams } from './onboarding.js';
import { QuotaManager } from './quota-manager.js';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const logger = createLogger('tenant-manager');

let config: ReturnType<typeof loadConfig<typeof tenantManagerConfigSchema>>;
try {
  config = loadConfig(tenantManagerConfigSchema);
} catch (err) {
  logger.warn({ err }, 'Config validation failed — using defaults for development');
  config = {
    DATABASE_URL: process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/agentcoders',
    REDIS_URL: process.env['REDIS_URL'] ?? 'redis://localhost:6379',
    LOG_LEVEL: 'info',
    NODE_ENV: 'development',
    STRIPE_SECRET_KEY: process.env['STRIPE_SECRET_KEY'] ?? 'sk_test_placeholder',
    K8S_IN_CLUSTER: false,
    HEALTH_PORT: Number(process.env['HEALTH_PORT'] ?? 8082),
  } as ReturnType<typeof loadConfig<typeof tenantManagerConfigSchema>>;
}

const db = getDb(config.DATABASE_URL);
const onboarding = new OnboardingService(db, logger);
const quotaManager = new QuotaManager(db, logger);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function parseJsonBody<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error('Invalid JSON body');
  }
}

/** Simple URL pattern matching for /api/tenants/:id and /api/tenants/:id/suffix */
function matchRoute(
  pathname: string,
  method: string,
): { route: string; tenantId?: string } | null {

  // Health
  if (pathname === '/healthz') return { route: 'healthz' };
  if (pathname === '/readyz') return { route: 'readyz' };

  // POST /api/tenants
  if (pathname === '/api/tenants' && method === 'POST') {
    return { route: 'create-tenant' };
  }

  // /api/tenants/:id patterns
  const tenantMatch = /^\/api\/tenants\/([a-f0-9-]{36})$/.exec(pathname);
  if (tenantMatch) {
    const tenantId = tenantMatch[1];
    if (method === 'GET') return { route: 'get-tenant', tenantId };
    if (method === 'PATCH') return { route: 'update-tenant', tenantId };
    if (method === 'DELETE') return { route: 'delete-tenant', tenantId };
  }

  // POST /api/tenants/:id/verticals
  const verticalMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/verticals$/.exec(pathname);
  if (verticalMatch && method === 'POST') {
    return { route: 'add-vertical', tenantId: verticalMatch[1] };
  }

  // GET /api/tenants/:id/usage
  const usageMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/usage$/.exec(pathname);
  if (usageMatch && method === 'GET') {
    return { route: 'get-usage', tenantId: usageMatch[1] };
  }

  // GET /api/tenants/:id/provisioning-status
  const statusMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/provisioning-status$/.exec(pathname);
  if (statusMatch && method === 'GET') {
    return { route: 'provisioning-status', tenantId: statusMatch[1] };
  }

  // GET /api/tenants/:id/audit
  const auditMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/audit$/.exec(pathname);
  if (auditMatch && method === 'GET') {
    return { route: 'get-audit', tenantId: auditMatch[1] };
  }

  // GET /api/tenants/:id/telemetry
  const telemetryMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/telemetry$/.exec(pathname);
  if (telemetryMatch && method === 'GET') {
    return { route: 'get-telemetry', tenantId: telemetryMatch[1] };
  }

  // GET /api/tenants/:id/failure-patterns
  const failurePatternsMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/failure-patterns$/.exec(pathname);
  if (failurePatternsMatch && method === 'GET') {
    return { route: 'get-failure-patterns', tenantId: failurePatternsMatch[1] };
  }

  // GET /api/tenants/:id/model-routes
  const modelRoutesMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/model-routes$/.exec(pathname);
  if (modelRoutesMatch && method === 'GET') {
    return { route: 'get-model-routes', tenantId: modelRoutesMatch[1] };
  }

  // GET /api/skills
  if (pathname === '/api/skills' && method === 'GET') {
    return { route: 'get-skills' };
  }

  // GET /api/tenants/:id/management
  const managementMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/management$/.exec(pathname);
  if (managementMatch && method === 'GET') {
    return { route: 'get-management', tenantId: managementMatch[1] };
  }

  // GET /api/tenants/:id/enhancements
  const enhancementsMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/enhancements$/.exec(pathname);
  if (enhancementsMatch && method === 'GET') {
    return { route: 'get-enhancements', tenantId: enhancementsMatch[1] };
  }

  // GET /api/tenants/:id/insurance
  const insuranceMatch = /^\/api\/tenants\/([a-f0-9-]{36})\/insurance$/.exec(pathname);
  if (insuranceMatch && method === 'GET') {
    return { route: 'get-insurance', tenantId: insuranceMatch[1] };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
  const method = req.method ?? 'GET';
  const matched = matchRoute(url.pathname, method);

  if (!matched) {
    jsonResponse(res, 404, { error: 'Not found' });
    return;
  }

  switch (matched.route) {
    // ----- Health -----
    case 'healthz': {
      jsonResponse(res, 200, { status: 'ok' });
      return;
    }

    case 'readyz': {
      // Could check DB connectivity; for MVP just return ok
      jsonResponse(res, 200, { status: 'ok' });
      return;
    }

    // ----- Create tenant -----
    case 'create-tenant': {
      const raw = await readBody(req);
      const params = parseJsonBody<SignupParams>(raw);

      if (!params.name || !params.slug) {
        jsonResponse(res, 400, { error: 'name and slug are required' });
        return;
      }

      const tenant = await onboarding.createTenantFromSignup(params);
      jsonResponse(res, 201, tenant);
      return;
    }

    // ----- Get tenant -----
    case 'get-tenant': {
      const rows = await db.select().from(tenants).where(eq(tenants.id, matched.tenantId!));
      if (rows.length === 0) {
        jsonResponse(res, 404, { error: 'Tenant not found' });
        return;
      }
      jsonResponse(res, 200, rows[0]);
      return;
    }

    // ----- Update tenant -----
    case 'update-tenant': {
      const raw = await readBody(req);
      const updates = parseJsonBody<Record<string, unknown>>(raw);

      // Only allow safe fields to be updated
      const allowed: Record<string, unknown> = {};
      if ('name' in updates && typeof updates['name'] === 'string') allowed['name'] = updates['name'];
      if ('subscriptionPlan' in updates) allowed['subscriptionPlan'] = updates['subscriptionPlan'];
      if ('resourceQuotas' in updates) allowed['resourceQuotas'] = updates['resourceQuotas'];

      if (Object.keys(allowed).length === 0) {
        jsonResponse(res, 400, { error: 'No valid fields to update' });
        return;
      }

      await db
        .update(tenants)
        .set({ ...allowed, updatedAt: new Date() })
        .where(eq(tenants.id, matched.tenantId!));

      const rows = await db.select().from(tenants).where(eq(tenants.id, matched.tenantId!));
      jsonResponse(res, 200, rows[0] ?? { error: 'Tenant not found' });
      return;
    }

    // ----- Delete (deactivate) tenant -----
    case 'delete-tenant': {
      await db
        .update(tenants)
        .set({ status: 'deprovisioning', updatedAt: new Date() })
        .where(eq(tenants.id, matched.tenantId!));

      jsonResponse(res, 200, { message: 'Tenant marked for deprovisioning', tenantId: matched.tenantId });
      return;
    }

    // ----- Add vertical -----
    case 'add-vertical': {
      const raw = await readBody(req);
      const vertical = parseJsonBody<{ name: string; type: VerticalType; agentCount?: number }>(raw);

      if (!vertical.name || !vertical.type) {
        jsonResponse(res, 400, { error: 'name and type are required' });
        return;
      }

      const rows = await db.select().from(tenants).where(eq(tenants.id, matched.tenantId!));
      if (rows.length === 0) {
        jsonResponse(res, 404, { error: 'Tenant not found' });
        return;
      }

      const tenant = rows[0];
      const existingVerticals: TenantVertical[] = (tenant.verticals as TenantVertical[]) ?? [];
      const ns = `tenant-${tenant.slug}-${vertical.type}`;
      const newVertical: TenantVertical = {
        name: vertical.name,
        type: vertical.type,
        namespace: ns,
        agentCount: vertical.agentCount ?? 1,
      };

      const updatedVerticals = [...existingVerticals, newVertical];

      await db
        .update(tenants)
        .set({ verticals: updatedVerticals, updatedAt: new Date() })
        .where(eq(tenants.id, matched.tenantId!));

      jsonResponse(res, 201, newVertical);
      return;
    }

    // ----- Get usage -----
    case 'get-usage': {
      const usage = await quotaManager.getUsage(matched.tenantId!);
      jsonResponse(res, 200, usage);
      return;
    }

    // ----- Provisioning status -----
    case 'provisioning-status': {
      const status = await onboarding.getProvisioningStatus(matched.tenantId!);
      jsonResponse(res, 200, status);
      return;
    }

    // ----- Audit events -----
    case 'get-audit': {
      const rows = await db.select().from(auditEvents).where(eq(auditEvents.tenantId, matched.tenantId!));
      jsonResponse(res, 200, rows);
      return;
    }

    // ----- Telemetry -----
    case 'get-telemetry': {
      const rows = await db.select().from(telemetryRecords).where(eq(telemetryRecords.tenantId, matched.tenantId!));
      jsonResponse(res, 200, rows);
      return;
    }

    // ----- Failure patterns -----
    case 'get-failure-patterns': {
      const rows = await db.select().from(failurePatterns).where(eq(failurePatterns.tenantId, matched.tenantId!));
      jsonResponse(res, 200, rows);
      return;
    }

    // ----- Model routes -----
    case 'get-model-routes': {
      const rows = await db.select().from(modelRoutes).where(eq(modelRoutes.tenantId, matched.tenantId!));
      jsonResponse(res, 200, rows);
      return;
    }

    // ----- Skills -----
    case 'get-skills': {
      const rows = await db.select().from(skills);
      jsonResponse(res, 200, rows);
      return;
    }

    // ----- Management config -----
    case 'get-management': {
      const rows = await db.select().from(managementConfigs).where(eq(managementConfigs.tenantId, matched.tenantId!));
      jsonResponse(res, 200, rows[0] ?? null);
      return;
    }

    // ----- Enhancement runs -----
    case 'get-enhancements': {
      const rows = await db.select().from(enhancementRuns).where(eq(enhancementRuns.tenantId, matched.tenantId!));
      jsonResponse(res, 200, rows);
      return;
    }

    // ----- Insurance policies -----
    case 'get-insurance': {
      const rows = await db.select().from(insurancePolicies).where(eq(insurancePolicies.tenantId, matched.tenantId!));
      jsonResponse(res, 200, rows);
      return;
    }

    default:
      jsonResponse(res, 404, { error: 'Not found' });
  }
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, url: req.url, method: req.method }, 'Request handler error');
    jsonResponse(res, 500, { error: message });
  });
});

const port = config.HEALTH_PORT;

server.listen(port, () => {
  logger.info({ port }, 'Tenant manager API server started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received — shutting down');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('SIGINT received — shutting down');
  server.close(() => process.exit(0));
});

export { server };
