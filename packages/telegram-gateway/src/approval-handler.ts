import type { Context, Telegraf } from 'telegraf';
import { RedisChannels, type TelegramDecisionMessage } from '@agentcoders/shared';
import type { RedisBridge } from './redis-bridge.js';

export function registerApprovalHandler(
  bot: Telegraf<Context>,
  bridge: RedisBridge,
  tenantId: string,
): void {
  bot.on('callback_query', async (ctx) => {
    const callbackQuery = ctx.callbackQuery;
    if (!('data' in callbackQuery) || !callbackQuery.data) {
      return;
    }

    const data = callbackQuery.data;
    // Expected format: action:<approve|reject|defer>:<itemId>
    const match = data.match(/^action:(approve|reject|defer):(.+)$/);
    if (!match) {
      await ctx.answerCbQuery('Unknown action format.');
      return;
    }

    const action = match[1] as 'approve' | 'reject' | 'defer';
    const itemId = match[2];

    const decision: TelegramDecisionMessage = {
      type: 'telegram-decision',
      tenantId,
      action,
      itemId,
      chatId: String(callbackQuery.message?.chat?.id ?? ''),
      timestamp: new Date().toISOString(),
    };

    await bridge.publish(
      RedisChannels.telegramDecision(tenantId),
      decision,
    );

    const labels: Record<string, string> = {
      approve: 'Approved',
      reject: 'Rejected',
      defer: 'Deferred',
    };

    await ctx.answerCbQuery(`${labels[action]}: ${itemId}`);
    await ctx.editMessageReplyMarkup(undefined);
    await ctx.reply(`Decision: ${labels[action]} for item ${itemId}`);
  });
}
