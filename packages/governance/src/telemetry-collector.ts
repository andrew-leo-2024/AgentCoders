import { eq, and, gte, desc } from 'drizzle-orm';
import {
  createLogger,
  getDb,
  telemetryRecords,
  type Database,
  type Logger,
  type TelemetryRecord,
} from '@agentcoders/shared';
import { getGovernanceConfig } from './config.js';

export class TelemetryCollector {
  private readonly db: Database;
  private readonly logger: Logger;
  private readonly buffer: Omit<TelemetryRecord, 'id'>[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private readonly flushIntervalMs: number;

  constructor(db?: Database) {
    const config = getGovernanceConfig();
    this.db = db ?? getDb();
    this.logger = createLogger('telemetry-collector');
    this.flushIntervalMs = config.TELEMETRY_FLUSH_INTERVAL_MS;
  }

  start(): void {
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.logger.info({ flushIntervalMs: this.flushIntervalMs }, 'Telemetry collector started');
  }

  stop(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    void this.flush();
    this.logger.info('Telemetry collector stopped');
  }

  record(
    tenantId: string,
    agentId: string,
    metricName: string,
    value: number,
    dimensions?: Record<string, string>,
  ): void {
    this.buffer.push({
      tenantId,
      agentId,
      metricName,
      metricValue: value,
      dimensions: dimensions ?? {},
      recordedAt: new Date(),
    });
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const batch = this.buffer.splice(0, this.buffer.length);
    try {
      await this.db.insert(telemetryRecords).values(
        batch.map((rec) => ({
          tenantId: rec.tenantId,
          agentId: rec.agentId,
          metricName: rec.metricName,
          metricValue: rec.metricValue,
          dimensions: rec.dimensions,
          recordedAt: rec.recordedAt,
        })),
      );
      this.logger.debug({ count: batch.length }, 'Flushed telemetry records to DB');
    } catch (err) {
      this.logger.error({ err, count: batch.length }, 'Failed to flush telemetry records to DB');
      // Re-add failed records to buffer for retry
      this.buffer.unshift(...batch);
    }
  }

  async query(
    tenantId: string,
    metricName: string,
    since: Date,
  ): Promise<TelemetryRecord[]> {
    const rows = await this.db
      .select()
      .from(telemetryRecords)
      .where(
        and(
          eq(telemetryRecords.tenantId, tenantId),
          eq(telemetryRecords.metricName, metricName),
          gte(telemetryRecords.recordedAt, since),
        ),
      )
      .orderBy(desc(telemetryRecords.recordedAt));

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      agentId: row.agentId,
      metricName: row.metricName,
      metricValue: row.metricValue,
      dimensions: (row.dimensions ?? {}) as Record<string, string>,
      recordedAt: row.recordedAt,
    }));
  }
}
