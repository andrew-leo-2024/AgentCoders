import type { Logger, Database } from '@agentcoders/shared';
import { claudeSessions, usageRecords, agents } from '@agentcoders/shared';
import { eq, and, sql } from 'drizzle-orm';

// Approximate pricing per 1M tokens (USD)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3.0, output: 15.0 },
  'claude-haiku-4-5-20251001': { input: 0.80, output: 4.0 },
};

export class CostTracker {
  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {}

  estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-6']!;
    return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
  }

  async recordSession(params: {
    tenantId: string;
    agentId: string;
    workItemId?: number;
    model: string;
    mode: string;
    inputTokens: number;
    outputTokens: number;
    turns: number;
    durationMs: number;
    exitReason: string;
  }): Promise<string> {
    const cost = this.estimateCost(params.model, params.inputTokens, params.outputTokens);

    const [session] = await this.db.insert(claudeSessions).values({
      tenantId: params.tenantId,
      agentId: params.agentId,
      workItemId: params.workItemId,
      model: params.model,
      mode: params.mode,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostUsd: cost,
      turns: params.turns,
      durationMs: params.durationMs,
      exitReason: params.exitReason,
      completedAt: new Date(),
    }).returning({ id: claudeSessions.id });

    // Also record in usage_records
    await this.db.insert(usageRecords).values({
      tenantId: params.tenantId,
      agentId: params.agentId,
      sessionId: session!.id,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      estimatedCostUsd: cost,
    });

    // Update agent daily totals
    await this.db.update(agents)
      .set({
        tokensUsedToday: sql`${agents.tokensUsedToday} + ${params.inputTokens + params.outputTokens}`,
        costUsedTodayUsd: sql`${agents.costUsedTodayUsd} + ${cost}`,
      })
      .where(eq(agents.agentId, params.agentId));

    this.logger.info({
      sessionId: session!.id,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cost,
    }, 'Recorded Claude session cost');

    return session!.id;
  }

  async checkBudget(tenantId: string, agentId: string, dailyLimit: number, monthlyLimit: number): Promise<{
    withinBudget: boolean;
    dailySpent: number;
    monthlySpent: number;
  }> {
    const agent = await this.db.query.agents.findFirst({
      where: and(eq(agents.agentId, agentId), eq(agents.tenantId, tenantId)),
    });

    const dailySpent = agent?.costUsedTodayUsd ?? 0;

    // Monthly spend from usage_records
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [monthlyResult] = await this.db
      .select({ total: sql<number>`COALESCE(SUM(${usageRecords.estimatedCostUsd}), 0)` })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.agentId, agentId),
          eq(usageRecords.tenantId, tenantId),
          sql`${usageRecords.recordedAt} >= ${monthStart}`,
        ),
      );

    const monthlySpent = monthlyResult?.total ?? 0;
    const withinBudget = dailySpent < dailyLimit && monthlySpent < monthlyLimit;

    return { withinBudget, dailySpent, monthlySpent };
  }
}
