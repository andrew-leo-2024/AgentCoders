import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('cost-limiter');

interface CostTrackingState {
  cumulativeCostUsd: number;
  tokenCounts: {
    inputTokens: number;
    outputTokens: number;
  };
  requestCount: number;
  stageHistory: Array<{
    stage: string;
    costUsd: number;
    timestamp: number;
  }>;
}

// Approximate per-token costs for common models
const MODEL_COSTS: Record<string, { inputPerMToken: number; outputPerMToken: number }> = {
  'claude-haiku-3.5': { inputPerMToken: 0.25, outputPerMToken: 1.25 },
  'claude-sonnet-4-20250514': { inputPerMToken: 3.0, outputPerMToken: 15.0 },
  'claude-opus-4-20250514': { inputPerMToken: 15.0, outputPerMToken: 75.0 },
  'gpt-4o': { inputPerMToken: 5.0, outputPerMToken: 15.0 },
  'gpt-4o-mini': { inputPerMToken: 0.15, outputPerMToken: 0.60 },
  'default': { inputPerMToken: 3.0, outputPerMToken: 15.0 },
};

// Approximate tokens per character
const CHARS_PER_TOKEN = 4;

export class CostLimiter implements EnhancementStage {
  readonly name = 'cost-limiter';
  readonly type = 'armour' as const;

  private readonly maxCostUsd: number;

  constructor(maxCostUsd: number = 10.0) {
    this.maxCostUsd = maxCostUsd;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, maxCostUsd: this.maxCostUsd },
      'Cost limiter executing',
    );

    // Get or initialize cost tracking state
    const state = this.getCostState(context);

    // Estimate cost of the current content
    const estimatedTokens = Math.ceil(input.length / CHARS_PER_TOKEN);
    const currentModel = (context.metadata['currentModel'] as string) ?? 'default';
    const modelCosts = MODEL_COSTS[currentModel] ?? MODEL_COSTS['default']!;

    // Estimate cost for this request (assume equal input/output for conservative estimate)
    const inputCost = (estimatedTokens / 1_000_000) * modelCosts.inputPerMToken;
    const outputCostEstimate = (estimatedTokens / 1_000_000) * modelCosts.outputPerMToken;
    const estimatedRequestCost = inputCost + outputCostEstimate;

    // Update cumulative cost
    state.cumulativeCostUsd += estimatedRequestCost;
    state.tokenCounts.inputTokens += estimatedTokens;
    state.tokenCounts.outputTokens += estimatedTokens; // estimate
    state.requestCount++;
    state.stageHistory.push({
      stage: 'cost-limiter',
      costUsd: estimatedRequestCost,
      timestamp: Date.now(),
    });

    // Check budget
    const budgetUsedPercent = (state.cumulativeCostUsd / this.maxCostUsd) * 100;
    const budgetRemaining = this.maxCostUsd - state.cumulativeCostUsd;
    const budgetExceeded = state.cumulativeCostUsd > this.maxCostUsd;

    // Warning thresholds
    const isWarning = budgetUsedPercent >= 80 && !budgetExceeded;
    const isCritical = budgetUsedPercent >= 95 && !budgetExceeded;

    if (budgetExceeded) {
      logger.error(
        {
          cumulativeCostUsd: state.cumulativeCostUsd,
          maxCostUsd: this.maxCostUsd,
          requestCount: state.requestCount,
        },
        'Budget exceeded — killing request',
      );

      // Save state back to context
      this.saveCostState(context, state);

      return {
        content: input,
        modified: false,
        details: {
          budgetExceeded: true,
          killed: true,
          cumulativeCostUsd: roundCost(state.cumulativeCostUsd),
          maxCostUsd: this.maxCostUsd,
          budgetUsedPercent: Math.round(budgetUsedPercent),
          estimatedRequestCost: roundCost(estimatedRequestCost),
          requestCount: state.requestCount,
          totalInputTokens: state.tokenCounts.inputTokens,
          totalOutputTokens: state.tokenCounts.outputTokens,
          model: currentModel,
          message: `Budget exceeded: $${roundCost(state.cumulativeCostUsd)} / $${this.maxCostUsd}. Request killed.`,
        },
      };
    }

    if (isCritical) {
      logger.warn(
        { budgetUsedPercent: Math.round(budgetUsedPercent), budgetRemaining: roundCost(budgetRemaining) },
        'Budget critically low',
      );
    } else if (isWarning) {
      logger.warn(
        { budgetUsedPercent: Math.round(budgetUsedPercent), budgetRemaining: roundCost(budgetRemaining) },
        'Budget usage warning',
      );
    }

    // Save state back to context
    this.saveCostState(context, state);

    return {
      content: input,
      modified: false,
      details: {
        budgetExceeded: false,
        killed: false,
        cumulativeCostUsd: roundCost(state.cumulativeCostUsd),
        maxCostUsd: this.maxCostUsd,
        budgetUsedPercent: Math.round(budgetUsedPercent),
        budgetRemainingUsd: roundCost(budgetRemaining),
        estimatedRequestCost: roundCost(estimatedRequestCost),
        requestCount: state.requestCount,
        totalInputTokens: state.tokenCounts.inputTokens,
        totalOutputTokens: state.tokenCounts.outputTokens,
        model: currentModel,
        warningLevel: budgetExceeded ? 'exceeded' : isCritical ? 'critical' : isWarning ? 'warning' : 'ok',
      },
    };
  }

  private getCostState(context: StageContext): CostTrackingState {
    const existing = context.metadata['costTrackingState'] as CostTrackingState | undefined;
    return existing ?? {
      cumulativeCostUsd: 0,
      tokenCounts: { inputTokens: 0, outputTokens: 0 },
      requestCount: 0,
      stageHistory: [],
    };
  }

  private saveCostState(context: StageContext, state: CostTrackingState): void {
    context.metadata['costTrackingState'] = state;
  }
}

function roundCost(cost: number): number {
  return Math.round(cost * 10000) / 10000;
}
