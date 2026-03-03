import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http';
import { Registry, collectDefaultMetrics, Counter, Gauge } from 'prom-client';
import { Redis } from 'ioredis';
import {
  createLogger,
  loadConfig,
  billingConfigSchema,
  getDb,
  dwiRecords,
  tenants,
  type Database,
  type Logger,
  type BillingEnvConfig,
  type ComplexityTier,
} from '@agentcoders/shared';
import { COMPLEXITY_PRICING } from '@agentcoders/shared';
import { eq, and } from 'drizzle-orm';
import { estimateComplexity } from './complexity-estimator.js';
import { StripeService } from './stripe-integration.js';
import { UsageRecorder } from './usage-recorder.js';
import { InvoiceGenerator } from './invoice-generator.js';
import { BudgetEnforcer } from './budget-enforcer.js';
import { QualityGateMonitor } from './quality-gates.js';

const logger = createLogger('dwi-tracker');

/**
 * DWI completion criteria — all 6 must be true for a DWI to be billable:
 *
 * 1. Work item exists in ADO
 * 2. PR linked to work item
 * 3. CI pipeline passes
 * 4. PR approved by reviewer
 * 5. PR merged to main
 * 6. Work item closed
 */
interface DwiCriteria {
  workItemExists: boolean;
  prLinked: boolean;
  ciPassed: boolean;
  prApproved: boolean;
  prMerged: boolean;
  workItemClosed: boolean;
}

function allCriteriaMet(criteria: DwiCriteria): boolean {
  return (
    criteria.workItemExists &&
    criteria.prLinked &&
    criteria.ciPassed &&
    criteria.prApproved &&
    criteria.prMerged &&
    criteria.workItemClosed
  );
}

// Service instances
let sub: Redis;
let pub: Redis;
let db: Database;
let config: BillingEnvConfig;
let stripeService: StripeService;
let usageRecorder: UsageRecorder;
let invoiceGenerator: InvoiceGenerator;
let budgetEnforcer: BudgetEnforcer;
let qualityGateMonitor: QualityGateMonitor;
let healthServer: Server | null = null;

// Prometheus metrics
const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const billingMetrics = {
  dwisProcessed: new Counter({
    name: 'billing_dwis_processed_total',
    help: 'Total DWI records processed',
    labelNames: ['status'] as const,
    registers: [metricsRegistry],
  }),
  dwisBillable: new Counter({
    name: 'billing_dwis_billable_total',
    help: 'Total DWIs marked billable',
    registers: [metricsRegistry],
  }),
  revenueUsd: new Counter({
    name: 'billing_revenue_usd_total',
    help: 'Total revenue in USD from billable DWIs',
    registers: [metricsRegistry],
  }),
  gateEvents: new Counter({
    name: 'billing_gate_events_total',
    help: 'DWI gate events received',
    labelNames: ['gate'] as const,
    registers: [metricsRegistry],
  }),
  redisConnected: new Gauge({
    name: 'billing_redis_connected',
    help: 'Whether Redis subscriber is connected',
    registers: [metricsRegistry],
  }),
};

/**
 * Main entry point for the billing service.
 * Subscribes to Redis events and tracks DWI lifecycle across all tenants.
 */
export async function start(): Promise<void> {
  config = loadConfig(billingConfigSchema);
  db = getDb();

  logger.info('Starting billing service (DWI tracker)...');

  // Initialize Redis connections
  sub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });
  pub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });

  // Initialize Stripe service
  stripeService = new StripeService(config.STRIPE_SECRET_KEY, config.STRIPE_WEBHOOK_SECRET, logger);

  // Initialize sub-services
  usageRecorder = new UsageRecorder(config.REDIS_URL, db, logger);
  invoiceGenerator = new InvoiceGenerator(db, stripeService, logger);
  budgetEnforcer = new BudgetEnforcer(config.REDIS_URL, db, logger);
  qualityGateMonitor = new QualityGateMonitor(config.REDIS_URL, db, logger);

  // Fetch all active tenants
  const activeTenants = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.status, 'active'));

  const tenantIds = activeTenants.map((t) => t.id);
  logger.info({ tenantCount: tenantIds.length }, 'Found active tenants');

  // Subscribe to DWI lifecycle events for all tenants
  for (const tenantId of tenantIds) {
    await sub.subscribe(`${tenantId}:dwi:work-item-created`);
    await sub.subscribe(`${tenantId}:pr:linked`);
    await sub.subscribe(`${tenantId}:ci:completed`);
    await sub.subscribe(`${tenantId}:pr:approved`);
    await sub.subscribe(`${tenantId}:pr:merged`);
    await sub.subscribe(`${tenantId}:dwi:work-item-closed`);
  }

  // Handle incoming Redis messages
  sub.on('message', (channel: string, message: string) => {
    void handleDwiEvent(channel, message);
  });

  // Start sub-services
  await usageRecorder.start(tenantIds);
  await qualityGateMonitor.start(tenantIds);

  // Start health server
  await startHealthServer(config.HEALTH_PORT);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down billing service...');
    await usageRecorder.stop();
    await qualityGateMonitor.stop();
    await budgetEnforcer.stop();
    await sub.unsubscribe();
    sub.disconnect();
    pub.disconnect();
    if (healthServer) {
      healthServer.close();
    }
    logger.info('Billing service shut down');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  logger.info({ port: config.HEALTH_PORT }, 'Billing service started');
}

/**
 * Routes incoming DWI lifecycle events to the appropriate handler.
 */
async function handleDwiEvent(channel: string, message: string): Promise<void> {
  try {
    const data = JSON.parse(message) as Record<string, unknown>;
    const tenantId = data['tenantId'] as string;
    const workItemId = data['workItemId'] as number;

    if (!tenantId || !workItemId) {
      logger.warn({ channel, data }, 'Invalid DWI event — missing tenantId or workItemId');
      return;
    }

    if (channel.endsWith(':dwi:work-item-created')) {
      await handleWorkItemCreated(data);
    } else if (channel.endsWith(':pr:linked')) {
      await updateDwiCriteria(tenantId, workItemId, { prLinked: true }, data);
    } else if (channel.endsWith(':ci:completed')) {
      const result = data['result'] as string;
      if (result === 'succeeded') {
        await updateDwiCriteria(tenantId, workItemId, { ciPassed: true }, data);
      }
    } else if (channel.endsWith(':pr:approved')) {
      await updateDwiCriteria(tenantId, workItemId, { prApproved: true }, data);
    } else if (channel.endsWith(':pr:merged')) {
      await updateDwiCriteria(tenantId, workItemId, { prMerged: true }, data);
    } else if (channel.endsWith(':dwi:work-item-closed')) {
      await updateDwiCriteria(tenantId, workItemId, { workItemClosed: true }, data);
    }
  } catch (err) {
    logger.error({ channel, err }, 'Failed to handle DWI event');
  }
}

/**
 * Handles a new work item being created.
 * Estimates complexity, creates a DWI record, and checks budget.
 */
async function handleWorkItemCreated(data: Record<string, unknown>): Promise<void> {
  const tenantId = data['tenantId'] as string;
  const agentId = data['agentId'] as string;
  const workItemId = data['workItemId'] as number;
  const title = (data['title'] as string) ?? '';
  const description = (data['description'] as string) ?? '';

  // Estimate complexity
  const complexity = await estimateComplexity(title, description);
  logger.info({
    tenantId, workItemId, tier: complexity.tier, priceUsd: complexity.priceUsd, confidence: complexity.confidence,
  }, 'Estimated DWI complexity');

  // Check budget before creating DWI
  const budgetState = await budgetEnforcer.checkBudget(tenantId, agentId);
  if (!budgetState.canProceed) {
    logger.warn({ tenantId, agentId, workItemId }, 'Budget exceeded — DWI not created');
    // Publish budget exceeded event
    await pub.publish(`${tenantId}:billing:budget-exceeded`, JSON.stringify({
      type: 'budget-exceeded',
      tenantId,
      agentId,
      workItemId,
      timestamp: new Date().toISOString(),
    }));
    return;
  }

  // Create DWI record
  await db.insert(dwiRecords).values({
    tenantId,
    agentId,
    workItemId,
    complexityTier: complexity.tier,
    priceUsd: complexity.priceUsd,
    status: 'in_progress',
    workItemExists: true,
    prLinked: false,
    ciPassed: false,
    prApproved: false,
    prMerged: false,
    workItemClosed: false,
    isBillable: false,
  });

  logger.info({ tenantId, workItemId, tier: complexity.tier, priceUsd: complexity.priceUsd }, 'Created DWI record');
}

/**
 * Updates specific criteria on a DWI record.
 * When all 6 criteria are met, marks the DWI as completed + billable and reports to Stripe.
 */
async function updateDwiCriteria(
  tenantId: string,
  workItemId: number,
  criteriaUpdate: Partial<DwiCriteria>,
  data: Record<string, unknown>,
): Promise<void> {
  // Fetch current DWI record
  const [existing] = await db
    .select()
    .from(dwiRecords)
    .where(
      and(
        eq(dwiRecords.tenantId, tenantId),
        eq(dwiRecords.workItemId, workItemId),
      ),
    )
    .limit(1);

  if (!existing) {
    logger.warn({ tenantId, workItemId }, 'DWI record not found for criteria update');
    return;
  }

  // If already completed, skip
  if (existing.status === 'completed' || existing.status === 'reverted') {
    return;
  }

  // Build the update: merge existing criteria with the new update
  const prId = (data['prId'] as number | undefined) ?? existing.prId;

  const updateFields: Record<string, unknown> = { ...criteriaUpdate };
  if (prId && !existing.prId) {
    updateFields['prId'] = prId;
  }

  // Apply status transitions
  if (criteriaUpdate.prApproved) {
    updateFields['status'] = 'approved';
  }
  if (criteriaUpdate.prMerged) {
    updateFields['status'] = 'merged';
  }

  await db
    .update(dwiRecords)
    .set(updateFields)
    .where(eq(dwiRecords.id, existing.id));

  // Re-fetch to check all criteria
  const [updated] = await db
    .select()
    .from(dwiRecords)
    .where(eq(dwiRecords.id, existing.id))
    .limit(1);

  if (!updated) return;

  const criteria: DwiCriteria = {
    workItemExists: updated.workItemExists,
    prLinked: updated.prLinked,
    ciPassed: updated.ciPassed,
    prApproved: updated.prApproved,
    prMerged: updated.prMerged,
    workItemClosed: updated.workItemClosed,
  };

  if (allCriteriaMet(criteria)) {
    const completedAt = new Date();
    const durationMs = completedAt.getTime() - updated.startedAt.getTime();

    await db
      .update(dwiRecords)
      .set({
        status: 'completed',
        isBillable: true,
        completedAt,
        durationMs,
      })
      .where(eq(dwiRecords.id, updated.id));

    logger.info({
      tenantId,
      workItemId,
      dwiId: updated.id,
      tier: updated.complexityTier,
      priceUsd: updated.priceUsd,
      durationMs,
    }, 'DWI completed — all 6 criteria met, marking billable');

    // Report metered usage to Stripe
    await reportToStripe(tenantId, updated.priceUsd);

    // Publish DWI completed event
    await pub.publish(`${tenantId}:dwi:completed`, JSON.stringify({
      type: 'dwi-completed',
      tenantId,
      agentId: updated.agentId,
      workItemId,
      dwiId: updated.id,
      complexityTier: updated.complexityTier,
      priceUsd: updated.priceUsd,
      durationMs,
      timestamp: completedAt.toISOString(),
    }));
  }
}

/**
 * Reports a completed DWI to Stripe via the metered billing API.
 */
async function reportToStripe(tenantId: string, priceUsd: number): Promise<void> {
  try {
    const tenant = await db
      .select({ billingConfig: tenants.billingConfig })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const subscriptionId = tenant[0]?.billingConfig?.stripeSubscriptionId;
    if (!subscriptionId) {
      logger.warn({ tenantId }, 'No Stripe subscription found — skipping usage report');
      return;
    }

    await stripeService.reportDwiUsage(subscriptionId, 1, priceUsd);
    logger.info({ tenantId, priceUsd }, 'Reported DWI usage to Stripe');
  } catch (err) {
    logger.error({ tenantId, priceUsd, err }, 'Failed to report DWI usage to Stripe');
  }
}

/**
 * Starts the HTTP health check server.
 */
async function startHealthServer(port: number): Promise<void> {
  healthServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }

    if (req.url === '/readyz') {
      const ready = sub.status === 'ready';
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready, redisStatus: sub.status }));
      return;
    }

    if (req.url === '/metrics') {
      metricsRegistry.metrics().then((metrics) => {
        res.writeHead(200, { 'Content-Type': metricsRegistry.contentType });
        res.end(metrics);
      }).catch(() => {
        res.writeHead(500);
        res.end('Error collecting metrics');
      });
      return;
    }

    res.writeHead(404);
    res.end('Not Found');
  });

  return new Promise((resolve) => {
    healthServer!.listen(port, () => {
      logger.info({ port }, 'Health server started');
      resolve();
    });
  });
}

// Export sub-services for use by other modules
export { stripeService, invoiceGenerator, budgetEnforcer, qualityGateMonitor, usageRecorder };

// Auto-start when run as main module
start().catch((err) => {
  logger.error({ err }, 'Fatal: billing service failed to start');
  process.exit(1);
});
