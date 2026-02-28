import { Redis } from 'ioredis';
import {
  RedisChannels,
  createLogger,
  type HeartbeatMessage,
  type TelegramOutboundMessage,
  type RedisMessage,
  type Logger,
} from '@agentcoders/shared';
import type { Context, Telegraf } from 'telegraf';

export interface AgentStatusEntry {
  agentId: string;
  status: string;
  currentWorkItemId?: number;
  timestamp: string;
}

export class RedisBridge {
  private pub: Redis;
  private sub: Redis;
  private logger: Logger;
  private agentStatuses = new Map<string, AgentStatusEntry>();
  private mutedVerticals = new Map<string, number>(); // vertical -> unmute timestamp

  constructor(
    private readonly redisUrl: string,
    private readonly tenantId: string,
    private readonly bot: Telegraf<Context>,
  ) {
    this.pub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.sub = new Redis(redisUrl, { maxRetriesPerRequest: null });
    this.logger = createLogger('redis-bridge');
  }

  async start(): Promise<void> {
    const outboundChannel = RedisChannels.telegramOutbound(this.tenantId);
    const heartbeatChannel = RedisChannels.agentHeartbeat(this.tenantId);

    this.sub.on('message', (channel: string, message: string) => {
      try {
        const parsed = JSON.parse(message) as RedisMessage;
        if (channel === heartbeatChannel && parsed.type === 'heartbeat') {
          this.handleHeartbeat(parsed as HeartbeatMessage);
        } else if (channel === outboundChannel && parsed.type === 'telegram-outbound') {
          this.handleOutbound(parsed as TelegramOutboundMessage).catch((err) => {
            this.logger.error({ err }, 'Failed to send outbound Telegram message');
          });
        }
      } catch (err) {
        this.logger.error({ channel, err }, 'Failed to parse Redis message');
      }
    });

    await this.sub.subscribe(outboundChannel, heartbeatChannel);
    this.logger.info({ outboundChannel, heartbeatChannel }, 'Redis bridge subscribed');
  }

  async stop(): Promise<void> {
    await this.sub.unsubscribe();
    this.sub.disconnect();
    this.pub.disconnect();
    this.agentStatuses.clear();
    this.logger.info('Redis bridge stopped');
  }

  async publish(channel: string, message: RedisMessage): Promise<void> {
    await this.pub.publish(channel, JSON.stringify(message));
  }

  getAgentStatuses(): Map<string, AgentStatusEntry> {
    return new Map(this.agentStatuses);
  }

  muteVertical(vertical: string, durationMs: number): void {
    this.mutedVerticals.set(vertical, Date.now() + durationMs);
  }

  isVerticalMuted(vertical: string): boolean {
    const unmuteAt = this.mutedVerticals.get(vertical);
    if (!unmuteAt) return false;
    if (Date.now() >= unmuteAt) {
      this.mutedVerticals.delete(vertical);
      return false;
    }
    return true;
  }

  private handleHeartbeat(msg: HeartbeatMessage): void {
    this.agentStatuses.set(msg.agentId, {
      agentId: msg.agentId,
      status: msg.status,
      currentWorkItemId: msg.currentWorkItemId,
      timestamp: msg.timestamp,
    });
    this.logger.debug({ agentId: msg.agentId, status: msg.status }, 'Heartbeat received');
  }

  private async handleOutbound(msg: TelegramOutboundMessage): Promise<void> {
    // Check if the source vertical is muted (extract vertical from the message if available)
    const chatId = msg.chatId;

    const extra: Record<string, unknown> = {};
    if (msg.parseMode) {
      extra['parse_mode'] = msg.parseMode;
    }
    if (msg.inlineKeyboard) {
      extra['reply_markup'] = {
        inline_keyboard: msg.inlineKeyboard,
      };
    }

    await this.bot.telegram.sendMessage(chatId, msg.text, extra);
    this.logger.info({ chatId }, 'Outbound message sent to Telegram');
  }
}
