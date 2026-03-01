import { Redis } from 'ioredis';
import {
  createLogger,
  RedisChannels,
  type Logger,
  type AuditEvent,
  type TelemetryRecord,
  type FailurePattern,
} from '@agentcoders/shared';

type GovernanceChannel = 'audit' | 'telemetry' | 'failureAlert';

const CHANNEL_RESOLVERS: Record<GovernanceChannel, (tenantId: string) => string> = {
  audit: RedisChannels.audit,
  telemetry: RedisChannels.telemetry,
  failureAlert: RedisChannels.failureAlert,
};

export class GovernanceBus {
  private readonly pub: Redis;
  private readonly sub: Redis;
  private readonly logger: Logger;
  private readonly handlers: Map<string, Array<(data: unknown) => void>> = new Map();

  constructor(redisUrl: string) {
    this.pub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.sub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.logger = createLogger('governance-bus');

    this.sub.on('message', (channel: string, message: string) => {
      const channelHandlers = this.handlers.get(channel);
      if (!channelHandlers) return;

      try {
        const parsed: unknown = JSON.parse(message);
        for (const handler of channelHandlers) {
          handler(parsed);
        }
      } catch (err) {
        this.logger.error({ err, channel }, 'Failed to parse governance bus message');
      }
    });
  }

  stop(): void {
    void this.sub.unsubscribe();
    this.sub.disconnect();
    this.pub.disconnect();
    this.handlers.clear();
    this.logger.info('Governance bus stopped');
  }

  async publishAudit(tenantId: string, event: AuditEvent): Promise<void> {
    const channel = RedisChannels.audit(tenantId);
    await this.pub.publish(channel, JSON.stringify(event));
    this.logger.debug({ tenantId, eventType: event.eventType }, 'Published audit event');
  }

  async publishTelemetry(tenantId: string, record: TelemetryRecord): Promise<void> {
    const channel = RedisChannels.telemetry(tenantId);
    await this.pub.publish(channel, JSON.stringify(record));
    this.logger.debug({ tenantId, metricName: record.metricName }, 'Published telemetry record');
  }

  async publishFailureAlert(tenantId: string, pattern: FailurePattern): Promise<void> {
    const channel = RedisChannels.failureAlert(tenantId);
    await this.pub.publish(channel, JSON.stringify(pattern));
    this.logger.debug({ tenantId, patternId: pattern.id }, 'Published failure alert');
  }

  async subscribe(
    tenantId: string,
    channel: GovernanceChannel,
    handler: (data: unknown) => void,
  ): Promise<void> {
    const resolver = CHANNEL_RESOLVERS[channel];
    const fullChannel = resolver(tenantId);

    const existing = this.handlers.get(fullChannel) ?? [];
    existing.push(handler);
    this.handlers.set(fullChannel, existing);

    await this.sub.subscribe(fullChannel);
    this.logger.info({ tenantId, channel: fullChannel }, 'Subscribed to governance channel');
  }
}
