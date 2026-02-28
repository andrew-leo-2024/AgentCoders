import { Redis } from 'ioredis';
import { RedisChannels, type RedisMessage, type Logger } from '@agentcoders/shared';

export class RedisBus {
  private pub: Redis;
  private sub: Redis;
  private handlers = new Map<string, Array<(msg: RedisMessage) => void>>();

  constructor(
    private readonly redisUrl: string,
    private readonly tenantId: string,
    private readonly logger: Logger,
  ) {
    this.pub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.sub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });

    this.sub.on('message', (channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as RedisMessage;
        const channelHandlers = this.handlers.get(channel);
        if (channelHandlers) {
          for (const handler of channelHandlers) {
            handler(parsed);
          }
        }
      } catch (err) {
        this.logger.error({ channel, err }, 'Failed to parse Redis message');
      }
    });
  }

  async publish(channel: string, message: RedisMessage): Promise<void> {
    await this.pub.publish(channel, JSON.stringify(message));
  }

  async subscribe(channel: string, handler: (msg: RedisMessage) => void): Promise<void> {
    const handlers = this.handlers.get(channel) ?? [];
    handlers.push(handler);
    this.handlers.set(channel, handlers);

    if (handlers.length === 1) {
      await this.sub.subscribe(channel);
      this.logger.debug({ channel }, 'Subscribed to Redis channel');
    }
  }

  async publishHeartbeat(agentId: string, status: string, currentWorkItemId?: number): Promise<void> {
    await this.publish(RedisChannels.agentHeartbeat(this.tenantId), {
      type: 'heartbeat',
      agentId,
      tenantId: this.tenantId,
      status,
      currentWorkItemId,
      timestamp: new Date().toISOString(),
    } as unknown as RedisMessage);
  }

  async publishProgress(
    agentId: string,
    workItemId: number,
    phase: string,
    details: string,
    tokensUsed?: number,
  ): Promise<void> {
    await this.publish(RedisChannels.agentProgress(this.tenantId, agentId), {
      type: 'progress-update',
      agentId,
      tenantId: this.tenantId,
      workItemId,
      phase,
      details,
      tokensUsed,
      timestamp: new Date().toISOString(),
    } as unknown as RedisMessage);
  }

  async publishEscalation(
    agentId: string,
    workItemId: number,
    subType: string,
    details: string,
  ): Promise<void> {
    const channel = RedisChannels.vertical(this.tenantId, 'escalations');
    await this.publish(channel, {
      type: 'escalation',
      subType,
      agentId,
      tenantId: this.tenantId,
      workItemId,
      details,
      timestamp: new Date().toISOString(),
    } as unknown as RedisMessage);
  }

  async publishTelegramOutbound(chatId: string, text: string): Promise<void> {
    await this.publish(RedisChannels.telegramOutbound(this.tenantId), {
      type: 'telegram-outbound',
      tenantId: this.tenantId,
      chatId,
      text,
      timestamp: new Date().toISOString(),
    } as unknown as RedisMessage);
  }

  async close(): Promise<void> {
    await this.sub.unsubscribe();
    this.sub.disconnect();
    this.pub.disconnect();
    this.handlers.clear();
  }
}
