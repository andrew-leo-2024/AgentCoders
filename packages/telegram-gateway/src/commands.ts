import type { Context, Telegraf } from 'telegraf';
import type { RedisBridge } from './redis-bridge.js';
import { RedisChannels, type RedisMessage } from '@agentcoders/shared';

const VALID_VERTICALS = ['frontend', 'backend', 'devops', 'qa'] as const;
type Vertical = (typeof VALID_VERTICALS)[number];

function isValidVertical(v: string): v is Vertical {
  return VALID_VERTICALS.includes(v as Vertical);
}

export function registerCommands(
  bot: Telegraf<Context>,
  bridge: RedisBridge,
  tenantId: string,
): void {
  bot.command('status', async (ctx) => {
    const statuses = bridge.getAgentStatuses();

    if (statuses.size === 0) {
      await ctx.reply('No agent heartbeats received yet.');
      return;
    }

    const lines: string[] = ['Agent Status Report:', ''];
    for (const [agentId, entry] of statuses) {
      const age = Math.round((Date.now() - new Date(entry.timestamp).getTime()) / 1000);
      const workItem = entry.currentWorkItemId ? ` | WI #${entry.currentWorkItemId}` : '';
      const stale = age > 120 ? ' [STALE]' : '';
      lines.push(`- ${agentId}: ${entry.status}${workItem} (${age}s ago)${stale}`);
    }

    await ctx.reply(lines.join('\n'));
  });

  bot.command('freerain', async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const vertical = parts[1]?.toLowerCase();

    if (!vertical || !isValidVertical(vertical)) {
      await ctx.reply(`Usage: /freerain <vertical>\nValid verticals: ${VALID_VERTICALS.join(', ')}`);
      return;
    }

    const configMsg: RedisMessage = {
      type: 'status-update',
      agentId: 'telegram-gateway',
      tenantId,
      status: 'idle',
      details: JSON.stringify({ configChange: 'mode', vertical, mode: 'autonomous' }),
      timestamp: new Date().toISOString(),
    };

    await bridge.publish(
      RedisChannels.telegramInbound(tenantId, `jarvis-${vertical}`),
      configMsg,
    );
    await ctx.reply(`Set ${vertical} vertical to autonomous (free rein) mode.`);
  });

  bot.command('leash', async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const vertical = parts[1]?.toLowerCase();

    if (!vertical || !isValidVertical(vertical)) {
      await ctx.reply(`Usage: /leash <vertical>\nValid verticals: ${VALID_VERTICALS.join(', ')}`);
      return;
    }

    const configMsg: RedisMessage = {
      type: 'status-update',
      agentId: 'telegram-gateway',
      tenantId,
      status: 'idle',
      details: JSON.stringify({ configChange: 'mode', vertical, mode: 'supervised' }),
      timestamp: new Date().toISOString(),
    };

    await bridge.publish(
      RedisChannels.telegramInbound(tenantId, `jarvis-${vertical}`),
      configMsg,
    );
    await ctx.reply(`Set ${vertical} vertical to supervised (leash) mode.`);
  });

  bot.command('boards', async (ctx) => {
    const requestMsg: RedisMessage = {
      type: 'status-update',
      agentId: 'telegram-gateway',
      tenantId,
      status: 'idle',
      details: JSON.stringify({ query: 'boards-summary', chatId: String(ctx.chat.id) }),
      timestamp: new Date().toISOString(),
    };

    await bridge.publish(
      RedisChannels.telegramInbound(tenantId, 'jarvis'),
      requestMsg,
    );
    await ctx.reply('Requesting boards summary from Jarvis...');
  });

  bot.command('quiet', async (ctx) => {
    const parts = ctx.message.text.split(/\s+/);
    const vertical = parts[1]?.toLowerCase();

    if (!vertical || !isValidVertical(vertical)) {
      await ctx.reply(`Usage: /quiet <vertical>\nValid verticals: ${VALID_VERTICALS.join(', ')}`);
      return;
    }

    const ONE_HOUR_MS = 60 * 60 * 1000;
    bridge.muteVertical(vertical, ONE_HOUR_MS);
    await ctx.reply(`Muted notifications from ${vertical} for 1 hour.`);
  });
}
