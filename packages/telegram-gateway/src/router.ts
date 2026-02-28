import { Redis } from 'ioredis';
import { RedisChannels, type TelegramInboundMessage } from '@agentcoders/shared';

const VERTICAL_PREFIXES: Record<string, string> = {
  'Frontend:': 'jarvis-frontend',
  'Backend:': 'jarvis-backend',
  'DevOps:': 'jarvis-devops',
  'QA:': 'jarvis-qa',
};

const ALL_VERTICALS = Object.values(VERTICAL_PREFIXES);

function buildInboundMessage(
  text: string,
  tenantId: string,
  chatId: string,
  targetVertical?: string,
): TelegramInboundMessage {
  return {
    type: 'telegram-inbound',
    tenantId,
    chatId,
    text,
    targetVertical,
    timestamp: new Date().toISOString(),
  };
}

export async function routeMessage(
  text: string,
  tenantId: string,
  chatId: string,
  redis: Redis,
): Promise<void> {
  // Check for "All:" broadcast prefix
  if (text.startsWith('All:')) {
    const body = text.slice('All:'.length).trimStart();
    const msg = buildInboundMessage(body, tenantId, chatId, 'all');
    const payload = JSON.stringify(msg);
    await Promise.all(
      ALL_VERTICALS.map((vertical) =>
        redis.publish(RedisChannels.telegramInbound(tenantId, vertical), payload),
      ),
    );
    return;
  }

  // Check for vertical-specific prefix
  for (const [prefix, vertical] of Object.entries(VERTICAL_PREFIXES)) {
    if (text.startsWith(prefix)) {
      const body = text.slice(prefix.length).trimStart();
      const msg = buildInboundMessage(body, tenantId, chatId, vertical);
      await redis.publish(
        RedisChannels.telegramInbound(tenantId, vertical),
        JSON.stringify(msg),
      );
      return;
    }
  }

  // No prefix — route to default Jarvis channel
  const msg = buildInboundMessage(text, tenantId, chatId);
  await redis.publish(
    RedisChannels.telegramInbound(tenantId, 'jarvis'),
    JSON.stringify(msg),
  );
}
