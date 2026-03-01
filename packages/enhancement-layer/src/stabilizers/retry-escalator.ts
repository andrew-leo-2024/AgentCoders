import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('retry-escalator');

interface EscalationState {
  retryCount: number;
  lastError?: string;
  escalated: boolean;
  currentModel?: string;
  recommendedModel?: string;
}

const MODEL_ESCALATION_CHAIN: Array<{
  modelId: string;
  tier: number;
  costMultiplier: number;
  capabilities: string[];
}> = [
  { modelId: 'claude-haiku-3.5', tier: 1, costMultiplier: 1, capabilities: ['simple-tasks', 'fast'] },
  { modelId: 'claude-sonnet-4-20250514', tier: 2, costMultiplier: 12, capabilities: ['code', 'reasoning'] },
  { modelId: 'claude-opus-4-20250514', tier: 3, costMultiplier: 60, capabilities: ['complex-reasoning', 'architecture'] },
];

export class RetryEscalator implements EnhancementStage {
  readonly name = 'retry-escalator';
  readonly type = 'stabilizer' as const;

  private readonly maxRetries: number;
  private readonly escalationModel: string;

  constructor(maxRetries: number = 3, escalationModel: string = 'claude-opus-4-20250514') {
    this.maxRetries = maxRetries;
    this.escalationModel = escalationModel;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, maxRetries: this.maxRetries },
      'Retry escalator executing',
    );

    // Read escalation state from context
    const state = this.getEscalationState(context);

    // Check if there was a failure indicator in the context
    const hasFailed = context.metadata['lastStagesFailed'] === true ||
      context.metadata['retryRequested'] === true;

    if (!hasFailed) {
      return {
        content: input,
        modified: false,
        details: {
          message: 'No failure detected — no escalation needed',
          retryCount: state.retryCount,
          maxRetries: this.maxRetries,
        },
      };
    }

    // Increment retry count
    state.retryCount++;
    const lastError = (context.metadata['lastError'] as string) ?? 'Unknown error';
    state.lastError = lastError;

    logger.warn(
      { retryCount: state.retryCount, maxRetries: this.maxRetries, lastError },
      'Failure detected — evaluating escalation',
    );

    if (state.retryCount >= this.maxRetries) {
      // Escalate to stronger model
      const currentModel = (context.metadata['currentModel'] as string) ?? MODEL_ESCALATION_CHAIN[0]!.modelId;
      const escalatedModel = this.findEscalationTarget(currentModel);

      state.escalated = true;
      state.currentModel = currentModel;
      state.recommendedModel = escalatedModel?.modelId ?? this.escalationModel;

      // Store state back in context
      this.saveEscalationState(context, state);

      logger.warn(
        {
          currentModel,
          recommendedModel: state.recommendedModel,
          retryCount: state.retryCount,
        },
        'Max retries reached — escalating model',
      );

      return {
        content: input,
        modified: false,
        details: {
          escalated: true,
          retryCount: state.retryCount,
          maxRetries: this.maxRetries,
          currentModel,
          recommendedModel: state.recommendedModel,
          costMultiplier: escalatedModel?.costMultiplier ?? 60,
          lastError,
          recommendation: `Escalate from ${currentModel} to ${state.recommendedModel} after ${state.retryCount} failed attempts`,
        },
      };
    }

    // Still have retries left
    this.saveEscalationState(context, state);

    return {
      content: input,
      modified: false,
      details: {
        escalated: false,
        retryCount: state.retryCount,
        maxRetries: this.maxRetries,
        retriesRemaining: this.maxRetries - state.retryCount,
        lastError,
        recommendation: `Retry ${state.retryCount}/${this.maxRetries} — ${this.maxRetries - state.retryCount} retries remaining before escalation`,
      },
    };
  }

  private getEscalationState(context: StageContext): EscalationState {
    const existing = context.metadata['escalationState'] as EscalationState | undefined;
    return existing ?? {
      retryCount: 0,
      escalated: false,
    };
  }

  private saveEscalationState(context: StageContext, state: EscalationState): void {
    context.metadata['escalationState'] = state;
  }

  private findEscalationTarget(
    currentModel: string,
  ): (typeof MODEL_ESCALATION_CHAIN)[number] | undefined {
    const currentIndex = MODEL_ESCALATION_CHAIN.findIndex((m) => m.modelId === currentModel);

    if (currentIndex === -1) {
      // Unknown model, escalate to the configured target
      return MODEL_ESCALATION_CHAIN.find((m) => m.modelId === this.escalationModel);
    }

    // Go to the next tier
    const nextTier = currentIndex + 1;
    if (nextTier < MODEL_ESCALATION_CHAIN.length) {
      return MODEL_ESCALATION_CHAIN[nextTier];
    }

    // Already at the highest tier
    return MODEL_ESCALATION_CHAIN[MODEL_ESCALATION_CHAIN.length - 1];
  }
}
