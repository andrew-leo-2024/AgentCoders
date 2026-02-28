import { Redis } from 'ioredis';
import type { Logger, Database, BudgetState } from '@agentcoders/shared';
import { usageRecords, dwiRecords, agents } from '@agentcoders/shared';
import { eq, and, gte, sql } from 'drizzle-orm';

/**
 * Enforces per-tenant and per-agent spending budgets.
 *
 * - Warning at 80% of budget  -> publishes budget-alert (warning-80pct)
 * - Hard stop at 100% of budget -> publishes budget-exceeded, agent goes idle
 *
 * Budget checks query usage_records (internal cost) and dwi_records (billable revenue)
 * to determine current spend levels.
 */
export class BudgetEnforcer {
  private pub: Redis;

  constructor(
    private readonly redisUrl: string,
    private readonly db: Database,
    private readonly logger: Logger,
  ) {
    this.pub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  }

  /**
   * Checks whether an agent is within budget before approving new work.
   * Returns the budget state including whether the agent should proceed.
   */
  async checkBudget(
    tenantId: string,
    agentId: string,
  ): Promise<BudgetState & { canProceed: boolean }> {
    // Get agent config to find budget limits
    const agent = await this.db.query.agents.findFirst({
      where: and(eq(agents.agentId, agentId), eq(agents.tenantId, tenantId)),
    });

    if (!agent?.config) {
      this.logger.warn({ tenantId, agentId }, 'Agent not found or missing config');
      return {
        tenantId,
        agentId,
        dailySpentUsd: 0,
        dailyLimitUsd: 0,
        monthlySpentUsd: 0,
        monthlyLimitUsd: 0,
        isOverBudget: true,
        canProceed: false,
      };
    }

    const dailyLimitUsd = agent.config.dailyBudgetUsd;
    const monthlyLimitUsd = agent.config.monthlyBudgetUsd;

    // Calculate daily spend from DWI records (what we've billed today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [dailyResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${dwiRecords.priceUsd}), 0)` })
      .from(dwiRecords)
      .where(
        and(
          eq(dwiRecords.agentId, agentId),
          eq(dwiRecords.tenantId, tenantId),
          gte(dwiRecords.startedAt, todayStart),
        ),
      );

    // Also include internal costs from usage_records
    const [dailyCostResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${usageRecords.estimatedCostUsd}), 0)` })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.agentId, agentId),
          eq(usageRecords.tenantId, tenantId),
          gte(usageRecords.recordedAt, todayStart),
        ),
      );

    const dailySpentUsd = (dailyResult?.total ?? 0) + (dailyCostResult?.total ?? 0);

    // Calculate monthly spend
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthlyDwiResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${dwiRecords.priceUsd}), 0)` })
      .from(dwiRecords)
      .where(
        and(
          eq(dwiRecords.agentId, agentId),
          eq(dwiRecords.tenantId, tenantId),
          gte(dwiRecords.startedAt, monthStart),
        ),
      );

    const [monthlyCostResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${usageRecords.estimatedCostUsd}), 0)` })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.agentId, agentId),
          eq(usageRecords.tenantId, tenantId),
          gte(usageRecords.recordedAt, monthStart),
        ),
      );

    const monthlySpentUsd = (monthlyDwiResult?.total ?? 0) + (monthlyCostResult?.total ?? 0);

    const dailyPct = dailyLimitUsd > 0 ? dailySpentUsd / dailyLimitUsd : 0;
    const monthlyPct = monthlyLimitUsd > 0 ? monthlySpentUsd / monthlyLimitUsd : 0;

    const isOverBudget = dailyPct >= 1.0 || monthlyPct >= 1.0;
    const isWarning = !isOverBudget && (dailyPct >= 0.8 || monthlyPct >= 0.8);

    const state: BudgetState & { canProceed: boolean } = {
      tenantId,
      agentId,
      dailySpentUsd,
      dailyLimitUsd,
      monthlySpentUsd,
      monthlyLimitUsd,
      isOverBudget,
      canProceed: !isOverBudget,
    };

    // Publish alerts
    if (isOverBudget) {
      await this.publishBudgetAlert(tenantId, agentId, 'exceeded', dailySpentUsd, dailyLimitUsd);
      this.logger.warn({
        tenantId, agentId, dailySpentUsd, dailyLimitUsd, monthlySpentUsd, monthlyLimitUsd,
      }, 'Budget exceeded — agent should go idle');
    } else if (isWarning) {
      await this.publishBudgetAlert(tenantId, agentId, 'warning-80pct', dailySpentUsd, dailyLimitUsd);
      this.logger.info({
        tenantId, agentId, dailyPct: Math.round(dailyPct * 100), monthlyPct: Math.round(monthlyPct * 100),
      }, 'Budget warning at 80%');
    }

    return state;
  }

  /**
   * Publishes a budget alert to the tenant's Redis channel.
   */
  private async publishBudgetAlert(
    tenantId: string,
    agentId: string,
    alertType: 'warning-80pct' | 'exceeded' | 'session-limit',
    dailySpentUsd: number,
    dailyLimitUsd: number,
  ): Promise<void> {
    const channel = `${tenantId}:billing:budget-alert`;
    const message = {
      type: 'budget-alert',
      agentId,
      tenantId,
      alertType,
      dailySpentUsd,
      dailyLimitUsd,
      timestamp: new Date().toISOString(),
    };

    await this.pub.publish(channel, JSON.stringify(message));
    this.logger.debug({ channel, alertType, agentId }, 'Published budget alert');
  }

  /**
   * Disconnects from Redis.
   */
  async stop(): Promise<void> {
    this.pub.disconnect();
  }
}
