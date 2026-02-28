import { Redis } from 'ioredis';
import {
  createLogger,
  getDb,
  loadConfig,
  RedisChannels,
  type Logger,
  type RedisMessage,
  type EscalationMessage,
  type HeartbeatMessage,
  type CrossVerticalRequestMessage,
  type TelegramInboundMessage,
} from '@agentcoders/shared';
import { jarvisConfigSchema, type JarvisEnvConfig } from './config.js';
import { AgentSpawner } from './agent-spawner.js';
import { TaskDecomposer } from './task-decomposer.js';
import { SquadManager } from './squad-manager.js';
import { EscalationHandler } from './escalation-handler.js';
import { ConflictResolver } from './conflict-resolver.js';
import { DailySummary } from './daily-summary.js';

export class Jarvis {
  private pub!: Redis;
  private sub!: Redis;
  private config!: JarvisEnvConfig;
  private logger!: Logger;
  private squadManager!: SquadManager;
  private escalationHandler!: EscalationHandler;
  private conflictResolver!: ConflictResolver;
  private dailySummary!: DailySummary;
  private spawner!: AgentSpawner;
  private decomposer!: TaskDecomposer;
  private dailySummaryTimer: ReturnType<typeof setInterval> | null = null;
  private shuttingDown = false;
  private handlers = new Map<string, Array<(msg: RedisMessage) => void>>();

  async start(): Promise<void> {
    // Load config
    this.config = loadConfig(jarvisConfigSchema);
    this.logger = createLogger(`jarvis:${this.config.TENANT_ID}`);

    this.logger.info(
      { tenantId: this.config.TENANT_ID, namespace: this.config.JARVIS_NAMESPACE },
      'Jarvis CEO runtime starting',
    );

    // Initialize Redis connections
    this.pub = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: 3 });
    this.sub = new Redis(this.config.REDIS_URL, { maxRetriesPerRequest: 3 });

    // Wire up Redis message routing
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

    // Initialize database
    const db = getDb(this.config.DATABASE_URL);

    // Build the ADO client (minimal — for task decomposer)
    const { AdoClient } = await import('./ado-shim.js');
    const adoClient = new AdoClient(
      this.config.ADO_ORG_URL,
      this.config.ADO_PROJECT,
      this.config.ADO_PAT,
      this.logger,
    );

    // Initialize components
    this.squadManager = new SquadManager(
      this.config.TENANT_ID,
      this.config.POLL_INTERVAL_MS,
      this.pub,
      this.logger,
    );

    this.escalationHandler = new EscalationHandler(
      this.config.TENANT_ID,
      this.squadManager,
      this.pub,
      this.config.TELEGRAM_CHAT_ID,
      this.logger,
    );

    this.conflictResolver = new ConflictResolver(
      this.config.TENANT_ID,
      this.squadManager,
      this.pub,
      this.logger,
    );

    this.spawner = new AgentSpawner(
      this.config.JARVIS_NAMESPACE,
      this.logger,
    );

    this.decomposer = new TaskDecomposer(
      adoClient,
      this.config.ADO_PROJECT,
      this.logger,
    );

    this.dailySummary = new DailySummary(
      this.config.TENANT_ID,
      this.config.TELEGRAM_CHAT_ID,
      db,
      this.pub,
      this.squadManager,
      this.logger,
    );

    // Subscribe to channels
    await this.subscribeToChannels();

    // Start squad manager heartbeat monitoring
    this.squadManager.start();

    // Schedule daily summary (every 24h, aligned to midnight-ish)
    this.scheduleDailySummary();

    // Setup graceful shutdown
    this.setupShutdown();

    this.logger.info('Jarvis CEO runtime started successfully');
  }

  private async subscribeToChannels(): Promise<void> {
    const tenantId = this.config.TENANT_ID;

    // 1. Heartbeat channel — track all agent heartbeats
    const heartbeatChannel = RedisChannels.agentHeartbeat(tenantId);
    await this.subscribe(heartbeatChannel, (msg) => {
      if (msg.type === 'heartbeat') {
        this.squadManager.handleHeartbeat(msg as HeartbeatMessage);
      }
    });

    // 2. Escalation channel — handle agent escalations
    const escalationChannel = RedisChannels.vertical(tenantId, 'escalations');
    await this.subscribe(escalationChannel, (msg) => {
      if (msg.type === 'escalation') {
        void this.escalationHandler.handle(msg as EscalationMessage).catch((err) => {
          this.logger.error({ err }, 'Escalation handler error');
        });
      }
    });

    // 3. Jarvis vertical channel — direct messages to Jarvis
    const jarvisChannel = RedisChannels.vertical(tenantId, this.config.JARVIS_NAMESPACE);
    await this.subscribe(jarvisChannel, (msg) => {
      this.logger.info({ type: msg.type }, 'Received message on Jarvis channel');
    });

    // 4. Cross-vertical request channel — coordinate work across verticals
    const crossVerticalChannel = RedisChannels.crossVerticalNew(tenantId);
    await this.subscribe(crossVerticalChannel, (msg) => {
      if (msg.type === 'cross-vertical-request') {
        void this.handleCrossVerticalRequest(msg as CrossVerticalRequestMessage);
      }
    });

    // 5. Cross-vertical completed channel
    const crossVerticalCompletedChannel = RedisChannels.crossVerticalCompleted(tenantId);
    await this.subscribe(crossVerticalCompletedChannel, (msg) => {
      this.logger.info(
        { type: msg.type },
        'Cross-vertical task completed',
      );
    });

    // 6. Telegram inbound — human commands directed at Jarvis
    const telegramChannel = RedisChannels.telegramInbound(tenantId, 'jarvis');
    await this.subscribe(telegramChannel, (msg) => {
      if (msg.type === 'telegram-inbound') {
        void this.handleTelegramCommand(msg as TelegramInboundMessage);
      }
    });

    this.logger.info(
      {
        channels: [
          heartbeatChannel,
          escalationChannel,
          jarvisChannel,
          crossVerticalChannel,
          crossVerticalCompletedChannel,
          telegramChannel,
        ],
      },
      'Subscribed to all channels',
    );
  }

  private async subscribe(channel: string, handler: (msg: RedisMessage) => void): Promise<void> {
    const handlers = this.handlers.get(channel) ?? [];
    handlers.push(handler);
    this.handlers.set(channel, handlers);

    if (handlers.length === 1) {
      await this.sub.subscribe(channel);
      this.logger.debug({ channel }, 'Subscribed to Redis channel');
    }
  }

  private async handleCrossVerticalRequest(msg: CrossVerticalRequestMessage): Promise<void> {
    this.logger.info(
      { fromVertical: msg.fromVertical, requestType: msg.requestType, workItemId: msg.workItemId },
      'Handling cross-vertical request',
    );

    // Try to assign to an idle agent in any vertical
    const result = await this.squadManager.assignWorkItem(
      msg.workItemId,
      'M',
      undefined,
      `Cross-vertical request from ${msg.fromVertical}: ${msg.details}`,
    );

    if (!result.assigned) {
      this.logger.warn(
        { workItemId: msg.workItemId },
        'Could not assign cross-vertical request — no idle agents',
      );
    }
  }

  private async handleTelegramCommand(msg: TelegramInboundMessage): Promise<void> {
    const text = msg.text.trim().toLowerCase();

    this.logger.info({ text }, 'Received Telegram command');

    if (text === '/status' || text === 'status') {
      const stats = this.squadManager.getStats();
      await this.sendTelegram(
        msg.chatId,
        [
          `<b>Squad Status</b>`,
          `Agents: ${stats.totalAgents} (${stats.idleAgents} idle, ${stats.workingAgents} working)`,
          `Stuck: ${stats.stuckAgents} | Offline: ${stats.offlineAgents}`,
        ].join('\n'),
      );
    } else if (text === '/summary' || text === 'summary') {
      await this.dailySummary.generateAndSend();
    } else {
      await this.sendTelegram(
        msg.chatId,
        'Commands: /status, /summary',
      );
    }
  }

  private scheduleDailySummary(): void {
    // Run daily summary at the configured interval (default: every 24h)
    const intervalMs = this.config.DAILY_SUMMARY_INTERVAL_MS;

    this.dailySummaryTimer = setInterval(() => {
      this.logger.info('Running scheduled daily summary');
      void this.dailySummary.generateAndSend().catch((err) => {
        this.logger.error({ err }, 'Failed to generate daily summary');
      });
    }, intervalMs);

    this.logger.info(
      { intervalMs, intervalHours: intervalMs / 3_600_000 },
      'Daily summary scheduled',
    );
  }

  private async sendTelegram(chatId: string, text: string): Promise<void> {
    const channel = RedisChannels.telegramOutbound(this.config.TENANT_ID);
    await this.pub.publish(
      channel,
      JSON.stringify({
        type: 'telegram-outbound',
        tenantId: this.config.TENANT_ID,
        chatId,
        text,
        parseMode: 'HTML',
        timestamp: new Date().toISOString(),
      }),
    );
  }

  private setupShutdown(): void {
    const shutdown = (signal: string) => void this.gracefulShutdown(signal);
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;

    this.logger.info({ signal }, 'Jarvis graceful shutdown initiated');

    // Stop scheduled tasks
    if (this.dailySummaryTimer) {
      clearInterval(this.dailySummaryTimer);
      this.dailySummaryTimer = null;
    }

    // Stop squad manager
    this.squadManager.stop();

    // Close Redis
    await this.sub.unsubscribe();
    this.sub.disconnect();
    this.pub.disconnect();
    this.handlers.clear();

    this.logger.info('Jarvis shutdown complete');
    process.exit(0);
  }
}
