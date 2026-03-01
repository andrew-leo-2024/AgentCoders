import { createHash } from 'node:crypto';
import { eq, and, desc } from 'drizzle-orm';
import { Redis } from 'ioredis';
import {
  createLogger,
  getDb,
  failurePatterns,
  RedisChannels,
  type Database,
  type Logger,
  type FailurePattern,
  type FailureCategory,
} from '@agentcoders/shared';

const HIGH_FREQUENCY_THRESHOLD = 5;

export class FailurePatternEngine {
  private readonly db: Database;
  private readonly redis: Redis;
  private readonly logger: Logger;

  constructor(redisUrl: string, db?: Database, redis?: Redis) {
    this.db = db ?? getDb();
    this.redis = redis ?? new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.logger = createLogger('failure-pattern-engine');
  }

  stop(): void {
    this.redis.disconnect();
    this.logger.info('Failure pattern engine stopped');
  }

  async recordFailure(
    tenantId: string,
    error: Error,
    category: FailureCategory,
  ): Promise<FailurePattern> {
    const signature = `${error.name}: ${error.message}`;
    const patternHash = createHash('sha256').update(signature).digest('hex').slice(0, 64);

    // Check for existing pattern
    const [existing] = await this.db
      .select()
      .from(failurePatterns)
      .where(
        and(
          eq(failurePatterns.tenantId, tenantId),
          eq(failurePatterns.patternHash, patternHash),
        ),
      )
      .limit(1);

    if (existing) {
      // Upsert: increment count and update lastSeenAt
      const newCount = existing.occurrenceCount + 1;
      await this.db
        .update(failurePatterns)
        .set({
          occurrenceCount: newCount,
          lastSeenAt: new Date(),
          category,
        })
        .where(eq(failurePatterns.id, existing.id));

      const updated: FailurePattern = {
        ...existing,
        occurrenceCount: newCount,
        lastSeenAt: new Date(),
        category,
        resolution: existing.resolution ?? undefined,
      };

      // High frequency alert
      if (newCount >= HIGH_FREQUENCY_THRESHOLD) {
        await this.publishAlert(tenantId, updated);
      }

      this.logger.info(
        { tenantId, patternHash, count: newCount },
        'Updated existing failure pattern',
      );
      return updated;
    }

    // Insert new pattern
    const [inserted] = await this.db
      .insert(failurePatterns)
      .values({
        tenantId,
        patternHash,
        signature,
        category,
        occurrenceCount: 1,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
        status: 'active',
      })
      .returning();

    const newPattern: FailurePattern = {
      id: inserted!.id,
      tenantId: inserted!.tenantId,
      patternHash: inserted!.patternHash,
      signature: inserted!.signature,
      category: inserted!.category,
      occurrenceCount: inserted!.occurrenceCount,
      firstSeenAt: inserted!.firstSeenAt,
      lastSeenAt: inserted!.lastSeenAt,
      resolution: inserted!.resolution ?? undefined,
      status: inserted!.status,
    };

    // Alert on new pattern
    await this.publishAlert(tenantId, newPattern);

    this.logger.info({ tenantId, patternHash, signature }, 'Recorded new failure pattern');
    return newPattern;
  }

  async getPatterns(
    tenantId: string,
    status?: string,
  ): Promise<FailurePattern[]> {
    const conditions = [eq(failurePatterns.tenantId, tenantId)];

    if (status === 'active' || status === 'resolved' || status === 'suppressed') {
      conditions.push(eq(failurePatterns.status, status));
    }

    const rows = await this.db
      .select()
      .from(failurePatterns)
      .where(and(...conditions))
      .orderBy(desc(failurePatterns.lastSeenAt));

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      patternHash: row.patternHash,
      signature: row.signature,
      category: row.category,
      occurrenceCount: row.occurrenceCount,
      firstSeenAt: row.firstSeenAt,
      lastSeenAt: row.lastSeenAt,
      resolution: row.resolution ?? undefined,
      status: row.status,
    }));
  }

  async resolvePattern(patternId: string, resolution: string): Promise<void> {
    await this.db
      .update(failurePatterns)
      .set({
        status: 'resolved',
        resolution,
      })
      .where(eq(failurePatterns.id, patternId));

    this.logger.info({ patternId }, 'Resolved failure pattern');
  }

  async predictFailure(
    tenantId: string,
    context: string,
  ): Promise<FailurePattern | null> {
    // Retrieve active patterns for this tenant
    const activePatterns = await this.getPatterns(tenantId, 'active');

    // Simple substring matching: check if any active pattern's signature appears in the context
    for (const pattern of activePatterns) {
      const signatureWords = pattern.signature.toLowerCase().split(/\s+/);
      const contextLower = context.toLowerCase();
      const matchCount = signatureWords.filter((word) => contextLower.includes(word)).length;
      const matchRatio = signatureWords.length > 0 ? matchCount / signatureWords.length : 0;

      if (matchRatio >= 0.5) {
        this.logger.info(
          { tenantId, patternId: pattern.id, matchRatio },
          'Predicted failure based on known pattern',
        );
        return pattern;
      }
    }

    return null;
  }

  private async publishAlert(
    tenantId: string,
    pattern: FailurePattern,
  ): Promise<void> {
    try {
      await this.redis.publish(
        RedisChannels.failureAlert(tenantId),
        JSON.stringify(pattern),
      );
    } catch (err) {
      this.logger.error({ err, tenantId, patternId: pattern.id }, 'Failed to publish failure alert');
    }
  }
}
