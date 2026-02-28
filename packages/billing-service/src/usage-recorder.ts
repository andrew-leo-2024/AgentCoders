import { Redis } from 'ioredis';
import type { Logger, Database } from '@agentcoders/shared';
import { usageRecords } from '@agentcoders/shared';

/**
 * AWU (Active Work Unit) — a 15-minute block of active agent time.
 *
 * IMPORTANT: AWU tracking is for INTERNAL cost accounting only.
 * AWU data is NEVER exposed to customers. Customers see only DWIs.
 */
const AWU_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

interface ActiveSession {
  agentId: string;
  tenantId: string;
  startedAt: number;
  lastActivityAt: number;
  awuCount: number;
}

export class UsageRecorder {
  private sub: Redis;
  private activeSessions = new Map<string, ActiveSession>();
  private awuTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly redisUrl: string,
    private readonly db: Database,
    private readonly logger: Logger,
  ) {
    this.sub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  }

  /**
   * Starts subscribing to agent progress channels for all tenants.
   * Pattern: `{tenantId}:agent:*:progress`
   */
  async start(tenantIds: string[]): Promise<void> {
    // Subscribe to agent progress channels using pattern matching
    for (const tenantId of tenantIds) {
      const pattern = `${tenantId}:agent:*:progress`;
      await this.sub.psubscribe(pattern);
      this.logger.info({ tenantId, pattern }, 'Subscribed to agent progress pattern');
    }

    this.sub.on('pmessage', (_pattern: string, channel: string, message: string) => {
      this.handleProgressMessage(channel, message);
    });

    // Start the AWU tick timer — checks every minute for sessions that have
    // crossed a 15-minute boundary
    this.awuTimer = setInterval(() => {
      this.tickAwu();
    }, 60_000);

    this.logger.info('UsageRecorder started');
  }

  /**
   * Stops the recorder and flushes remaining sessions.
   */
  async stop(): Promise<void> {
    if (this.awuTimer) {
      clearInterval(this.awuTimer);
      this.awuTimer = null;
    }

    // Flush all active sessions
    for (const [key, session] of this.activeSessions) {
      await this.flushSession(key, session);
    }
    this.activeSessions.clear();

    await this.sub.punsubscribe();
    this.sub.disconnect();
    this.logger.info('UsageRecorder stopped');
  }

  private handleProgressMessage(channel: string, message: string): void {
    try {
      const parsed = JSON.parse(message) as {
        type: string;
        agentId: string;
        tenantId: string;
        phase?: string;
        tokensUsed?: number;
      };

      if (parsed.type !== 'progress-update') return;

      const sessionKey = `${parsed.tenantId}:${parsed.agentId}`;
      const now = Date.now();

      const existing = this.activeSessions.get(sessionKey);
      if (existing) {
        existing.lastActivityAt = now;
      } else {
        this.activeSessions.set(sessionKey, {
          agentId: parsed.agentId,
          tenantId: parsed.tenantId,
          startedAt: now,
          lastActivityAt: now,
          awuCount: 0,
        });
        this.logger.debug({ agentId: parsed.agentId, tenantId: parsed.tenantId }, 'New active session tracked');
      }

      // If phase is 'done', flush the session
      if (parsed.phase === 'done') {
        const session = this.activeSessions.get(sessionKey);
        if (session) {
          // Count the final partial AWU
          session.awuCount += 1;
          void this.flushSession(sessionKey, session);
          this.activeSessions.delete(sessionKey);
        }
      }
    } catch (err) {
      this.logger.error({ channel, err }, 'Failed to handle progress message');
    }
  }

  /**
   * Ticks the AWU counter. Called every minute.
   * For each active session, checks if 15 minutes have elapsed since the last AWU was counted.
   */
  private tickAwu(): void {
    const now = Date.now();
    const staleThreshold = 30 * 60_000; // 30 minutes without activity = stale

    for (const [key, session] of this.activeSessions) {
      const elapsed = now - session.startedAt;
      const expectedAwus = Math.floor(elapsed / AWU_INTERVAL_MS);

      if (expectedAwus > session.awuCount) {
        session.awuCount = expectedAwus;
        this.logger.debug({
          agentId: session.agentId,
          awuCount: session.awuCount,
        }, 'AWU tick');
      }

      // Flush stale sessions
      if (now - session.lastActivityAt > staleThreshold) {
        session.awuCount += 1; // Count final partial AWU
        void this.flushSession(key, session);
        this.activeSessions.delete(key);
        this.logger.info({ agentId: session.agentId }, 'Flushed stale session');
      }
    }
  }

  /**
   * Flushes a completed session to the database.
   * Records the AWU count as a usage record for internal cost accounting.
   *
   * IMPORTANT: This data is for internal use only. NEVER show AWUs to customers.
   */
  private async flushSession(key: string, session: ActiveSession): Promise<void> {
    if (session.awuCount === 0) return;

    try {
      // Record AWU usage. We store it as a usage_record with model='awu-internal'
      // to distinguish it from token-based records.
      await this.db.insert(usageRecords).values({
        tenantId: session.tenantId,
        agentId: session.agentId,
        model: 'awu-internal',
        inputTokens: 0,
        outputTokens: 0,
        // Estimated cost per AWU is an internal metric — roughly $0.10 per 15-min block
        estimatedCostUsd: session.awuCount * 0.10,
      });

      this.logger.info({
        agentId: session.agentId,
        tenantId: session.tenantId,
        awuCount: session.awuCount,
        durationMs: Date.now() - session.startedAt,
      }, 'Flushed AWU session to database');
    } catch (err) {
      this.logger.error({ key, err }, 'Failed to flush AWU session');
    }
  }
}
