import { eq, and, gte, desc } from 'drizzle-orm';
import { Redis } from 'ioredis';
import {
  createLogger,
  getDb,
  auditEvents,
  RedisChannels,
  type Database,
  type Logger,
  type AuditEvent,
  type AuditEventCategory,
} from '@agentcoders/shared';
import { getGovernanceConfig } from './config.js';

export { AuditTrail };
export { TelemetryCollector } from './telemetry-collector.js';
export { FailurePatternEngine } from './failure-pattern-engine.js';
export { AIInsurance } from './ai-insurance.js';
export { AuthorityDecay } from './authority-decay.js';
export { DecisionProvenanceTracker } from './decision-provenance.js';
export { GovernanceBus } from './governance-bus.js';

class AuditTrail {
  private readonly db: Database;
  private readonly redis: Redis;
  private readonly logger: Logger;
  private readonly buffer: Omit<AuditEvent, 'id'>[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushIntervalMs: number;

  constructor(redisUrl: string, db?: Database, redis?: Redis) {
    const config = getGovernanceConfig();
    this.db = db ?? getDb();
    this.redis = redis ?? new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.logger = createLogger('audit-trail');
    this.flushIntervalMs = config.AUDIT_FLUSH_INTERVAL_MS;
  }

  start(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.logger.info({ flushIntervalMs: this.flushIntervalMs }, 'Audit trail started');
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
    this.redis.disconnect();
    this.logger.info('Audit trail stopped');
  }

  async record(event: Omit<AuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: Omit<AuditEvent, 'id'> = {
      ...event,
      timestamp: new Date(),
    };
    this.buffer.push(fullEvent);

    // Publish to Redis audit channel immediately
    try {
      await this.redis.publish(
        RedisChannels.audit(event.tenantId),
        JSON.stringify(fullEvent),
      );
    } catch (err) {
      this.logger.error({ err, event: fullEvent }, 'Failed to publish audit event to Redis');
    }
  }

  async query(
    tenantId: string,
    filters: {
      category?: AuditEventCategory;
      agentId?: string;
      since?: Date;
      limit?: number;
    } = {},
  ): Promise<AuditEvent[]> {
    const conditions = [eq(auditEvents.tenantId, tenantId)];

    if (filters.category) {
      conditions.push(eq(auditEvents.category, filters.category));
    }
    if (filters.agentId) {
      conditions.push(eq(auditEvents.agentId, filters.agentId));
    }
    if (filters.since) {
      conditions.push(gte(auditEvents.timestamp, filters.since));
    }

    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(and(...conditions))
      .orderBy(desc(auditEvents.timestamp))
      .limit(filters.limit ?? 100);

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      agentId: row.agentId,
      eventType: row.eventType,
      category: row.category,
      details: (row.details ?? {}) as Record<string, unknown>,
      parentEventId: row.parentEventId ?? undefined,
      timestamp: row.timestamp,
    }));
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.db.insert(auditEvents).values(
        batch.map((event) => ({
          tenantId: event.tenantId,
          agentId: event.agentId,
          eventType: event.eventType,
          category: event.category,
          details: event.details,
          parentEventId: event.parentEventId,
          timestamp: event.timestamp,
        })),
      );
      this.logger.debug({ count: batch.length }, 'Flushed audit events to DB');
    } catch (err) {
      this.logger.error({ err, count: batch.length }, 'Failed to flush audit events to DB');
      // Re-add failed events to buffer for retry
      this.buffer.unshift(...batch);
    }
  }
}
