import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
import { createServer, type Server } from 'node:http';
import { Redis } from 'ioredis';
import {
  loadConfig,
  telegramConfigSchema,
  createLogger,
} from '@agentcoders/shared';
import { RedisBridge } from './redis-bridge.js';
import { registerCommands } from './commands.js';
import { registerApprovalHandler } from './approval-handler.js';
import { routeMessage } from './router.js';

const logger = createLogger('telegram-gateway');

async function main(): Promise<void> {
  const config = loadConfig(telegramConfigSchema);
  const ownerChatId = config.TELEGRAM_OWNER_CHAT_ID;
  const tenantId = ownerChatId; // tenant isolation key

  const bot = new Telegraf<Context>(config.TELEGRAM_BOT_TOKEN);

  // Redis connection for publishing routed messages
  const redisPub = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });

  // Redis bridge handles pub/sub for outbound + heartbeats
  const bridge = new RedisBridge(config.REDIS_URL, tenantId, bot);

  // Security: reject all messages not from the owner chat
  bot.use(async (ctx, next) => {
    if (ctx.chat && String(ctx.chat.id) !== ownerChatId) {
      logger.warn({ chatId: ctx.chat.id }, 'Rejected message from unauthorized chat');
      return;
    }
    await next();
  });

  // Register slash commands
  registerCommands(bot, bridge, tenantId);

  // Register approval inline keyboard handler
  registerApprovalHandler(bot, bridge, tenantId);

  // Route all text messages to the appropriate vertical
  bot.on('text', async (ctx) => {
    const text = ctx.message.text;
    // Skip commands (already handled above)
    if (text.startsWith('/')) return;

    await routeMessage(text, tenantId, String(ctx.chat.id), redisPub);
    logger.info({ chatId: ctx.chat.id }, 'Routed inbound message');
  });

  // Start Redis bridge
  await bridge.start();

  // Health server
  let healthServer: Server | undefined;
  const healthPort = config.HEALTH_PORT;
  healthServer = createServer((req, res) => {
    if (req.url === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
      return;
    }
    if (req.url === '/readyz') {
      const ready = redisPub.status === 'ready';
      res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ready, redisStatus: redisPub.status }));
      return;
    }
    res.writeHead(404);
    res.end('Not Found');
  });
  healthServer.listen(healthPort, () => {
    logger.info({ port: healthPort }, 'Health server started');
  });

  // Launch bot
  bot.launch();
  logger.info('Telegram gateway bot launched');

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down...');
    bot.stop(signal);
    healthServer?.close();
    await bridge.stop();
    redisPub.disconnect();
    process.exit(0);
  };

  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Fatal: telegram gateway failed to start');
  process.exit(1);
});
