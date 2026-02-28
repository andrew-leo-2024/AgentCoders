import type { Logger, Database } from '@agentcoders/shared';
import {
  workItemLog,
  prLog,
  claudeSessions,
  escalations,
  dwiRecords,
  RedisChannels,
} from '@agentcoders/shared';
import { eq, and, gte, sql } from 'drizzle-orm';
import { Redis } from 'ioredis';
import type { SquadManager } from './squad-manager.js';

export interface DailySummaryData {
  date: string;
  workItemsCompleted: number;
  workItemsInProgress: number;
  workItemsFailed: number;
  prsCreated: number;
  prsMerged: number;
  escalationsTotal: number;
  escalationsResolved: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalSessions: number;
  dwisBillable: number;
  dwisRevenueUsd: number;
  agentStats: {
    totalAgents: number;
    idleAgents: number;
    workingAgents: number;
    stuckAgents: number;
    offlineAgents: number;
  };
}

export class DailySummary {
  constructor(
    private readonly tenantId: string,
    private readonly telegramChatId: string,
    private readonly db: Database,
    private readonly pub: Redis,
    private readonly squadManager: SquadManager,
    private readonly logger: Logger,
  ) {}

  async generate(): Promise<DailySummaryData> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [
      wiStats,
      prStats,
      escalationStats,
      costStats,
      dwiStats,
    ] = await Promise.all([
      this.getWorkItemStats(todayStart),
      this.getPrStats(todayStart),
      this.getEscalationStats(todayStart),
      this.getCostStats(todayStart),
      this.getDwiStats(todayStart),
    ]);

    const agentStats = this.squadManager.getStats();

    const summary: DailySummaryData = {
      date: todayStart.toISOString().split('T')[0]!,
      workItemsCompleted: wiStats.completed,
      workItemsInProgress: wiStats.inProgress,
      workItemsFailed: wiStats.failed,
      prsCreated: prStats.created,
      prsMerged: prStats.merged,
      escalationsTotal: escalationStats.total,
      escalationsResolved: escalationStats.resolved,
      totalCostUsd: costStats.totalCost,
      totalInputTokens: costStats.inputTokens,
      totalOutputTokens: costStats.outputTokens,
      totalSessions: costStats.sessions,
      dwisBillable: dwiStats.billable,
      dwisRevenueUsd: dwiStats.revenue,
      agentStats,
    };

    this.logger.info({ summary }, 'Daily summary generated');
    return summary;
  }

  async generateAndSend(): Promise<void> {
    const summary = await this.generate();
    const message = this.formatTelegramMessage(summary);
    await this.sendToTelegram(message);
  }

  private formatTelegramMessage(summary: DailySummaryData): string {
    const lines = [
      `<b>Daily Summary — ${summary.date}</b>`,
      ``,
      `<b>Work Items</b>`,
      `  Completed: ${summary.workItemsCompleted}`,
      `  In Progress: ${summary.workItemsInProgress}`,
      `  Failed: ${summary.workItemsFailed}`,
      ``,
      `<b>Pull Requests</b>`,
      `  Created: ${summary.prsCreated}`,
      `  Merged: ${summary.prsMerged}`,
      ``,
      `<b>Escalations</b>`,
      `  Total: ${summary.escalationsTotal}`,
      `  Resolved: ${summary.escalationsResolved}`,
      ``,
      `<b>Cost</b>`,
      `  API Cost: $${summary.totalCostUsd.toFixed(2)}`,
      `  Sessions: ${summary.totalSessions}`,
      `  Tokens: ${this.formatTokenCount(summary.totalInputTokens + summary.totalOutputTokens)}`,
      ``,
      `<b>Revenue (DWI)</b>`,
      `  Billable DWIs: ${summary.dwisBillable}`,
      `  Revenue: $${summary.dwisRevenueUsd.toFixed(2)}`,
      `  Margin: ${summary.dwisRevenueUsd > 0 ? ((1 - summary.totalCostUsd / summary.dwisRevenueUsd) * 100).toFixed(1) : '0.0'}%`,
      ``,
      `<b>Agents</b>`,
      `  Total: ${summary.agentStats.totalAgents}`,
      `  Idle: ${summary.agentStats.idleAgents} | Working: ${summary.agentStats.workingAgents}`,
      `  Stuck: ${summary.agentStats.stuckAgents} | Offline: ${summary.agentStats.offlineAgents}`,
    ];

    return lines.join('\n');
  }

  private async sendToTelegram(text: string): Promise<void> {
    const channel = RedisChannels.telegramOutbound(this.tenantId);
    await this.pub.publish(
      channel,
      JSON.stringify({
        type: 'telegram-outbound',
        tenantId: this.tenantId,
        chatId: this.telegramChatId,
        text,
        parseMode: 'HTML',
        timestamp: new Date().toISOString(),
      }),
    );

    this.logger.info('Daily summary sent to Telegram');
  }

  private async getWorkItemStats(since: Date): Promise<{
    completed: number;
    inProgress: number;
    failed: number;
  }> {
    const [completedResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workItemLog)
      .where(
        and(
          eq(workItemLog.tenantId, this.tenantId),
          gte(workItemLog.claimedAt, since),
          eq(workItemLog.state, 'Resolved'),
        ),
      );

    const [inProgressResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workItemLog)
      .where(
        and(
          eq(workItemLog.tenantId, this.tenantId),
          gte(workItemLog.claimedAt, since),
          eq(workItemLog.state, 'Active'),
        ),
      );

    const [failedResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(workItemLog)
      .where(
        and(
          eq(workItemLog.tenantId, this.tenantId),
          gte(workItemLog.claimedAt, since),
          eq(workItemLog.state, 'blocked'),
        ),
      );

    return {
      completed: completedResult?.count ?? 0,
      inProgress: inProgressResult?.count ?? 0,
      failed: failedResult?.count ?? 0,
    };
  }

  private async getPrStats(since: Date): Promise<{ created: number; merged: number }> {
    const [createdResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(prLog)
      .where(
        and(
          eq(prLog.tenantId, this.tenantId),
          gte(prLog.createdAt, since),
        ),
      );

    const [mergedResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(prLog)
      .where(
        and(
          eq(prLog.tenantId, this.tenantId),
          gte(prLog.createdAt, since),
          eq(prLog.status, 'completed'),
        ),
      );

    return {
      created: createdResult?.count ?? 0,
      merged: mergedResult?.count ?? 0,
    };
  }

  private async getEscalationStats(since: Date): Promise<{ total: number; resolved: number }> {
    const [totalResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(escalations)
      .where(
        and(
          eq(escalations.tenantId, this.tenantId),
          gte(escalations.createdAt, since),
        ),
      );

    const [resolvedResult] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(escalations)
      .where(
        and(
          eq(escalations.tenantId, this.tenantId),
          gte(escalations.createdAt, since),
          sql`${escalations.resolvedAt} IS NOT NULL`,
        ),
      );

    return {
      total: totalResult?.count ?? 0,
      resolved: resolvedResult?.count ?? 0,
    };
  }

  private async getCostStats(since: Date): Promise<{
    totalCost: number;
    inputTokens: number;
    outputTokens: number;
    sessions: number;
  }> {
    const [result] = await this.db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${claudeSessions.estimatedCostUsd}), 0)`,
        inputTokens: sql<number>`COALESCE(SUM(${claudeSessions.inputTokens}), 0)`,
        outputTokens: sql<number>`COALESCE(SUM(${claudeSessions.outputTokens}), 0)`,
        sessions: sql<number>`count(*)`,
      })
      .from(claudeSessions)
      .where(
        and(
          eq(claudeSessions.tenantId, this.tenantId),
          gte(claudeSessions.startedAt, since),
        ),
      );

    return {
      totalCost: result?.totalCost ?? 0,
      inputTokens: result?.inputTokens ?? 0,
      outputTokens: result?.outputTokens ?? 0,
      sessions: result?.sessions ?? 0,
    };
  }

  private async getDwiStats(since: Date): Promise<{ billable: number; revenue: number }> {
    const [result] = await this.db
      .select({
        billable: sql<number>`COALESCE(SUM(CASE WHEN ${dwiRecords.isBillable} THEN 1 ELSE 0 END), 0)`,
        revenue: sql<number>`COALESCE(SUM(CASE WHEN ${dwiRecords.isBillable} THEN ${dwiRecords.priceUsd} ELSE 0 END), 0)`,
      })
      .from(dwiRecords)
      .where(
        and(
          eq(dwiRecords.tenantId, this.tenantId),
          gte(dwiRecords.startedAt, since),
        ),
      );

    return {
      billable: result?.billable ?? 0,
      revenue: result?.revenue ?? 0,
    };
  }

  private formatTokenCount(tokens: number): string {
    if (tokens >= 1_000_000) {
      return `${(tokens / 1_000_000).toFixed(1)}M`;
    }
    if (tokens >= 1_000) {
      return `${(tokens / 1_000).toFixed(1)}K`;
    }
    return String(tokens);
  }
}
