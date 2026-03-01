import { createLogger } from '@agentcoders/shared';
import type {
  EnhancementResult,
  EnhancementStageResult,
  EnhancementPipelineConfig,
} from '@agentcoders/shared';
import type { EnhancementStage, StageContext } from './stage-interface.js';

const logger = createLogger('enhancement-pipeline');

export class EnhancementPipeline {
  private readonly stages: EnhancementStage[] = [];
  private readonly config: EnhancementPipelineConfig;

  constructor(config: EnhancementPipelineConfig) {
    this.config = config;
  }

  addStage(stage: EnhancementStage): void {
    this.stages.push(stage);
  }

  addStages(stages: EnhancementStage[]): void {
    for (const stage of stages) {
      this.stages.push(stage);
    }
  }

  getStages(): ReadonlyArray<EnhancementStage> {
    return this.stages;
  }

  getConfig(): EnhancementPipelineConfig {
    return this.config;
  }

  async execute(input: string, context: StageContext): Promise<EnhancementResult> {
    const pipelineStart = Date.now();
    const stageResults: EnhancementStageResult[] = [];
    let currentContent = input;

    logger.info(
      { stageCount: this.stages.length, tenantId: context.tenantId, agentId: context.agentId },
      'Starting enhancement pipeline',
    );

    for (const stage of this.stages) {
      const stageStart = Date.now();

      try {
        logger.debug({ stage: stage.name, type: stage.type }, 'Executing stage');

        const output = await stage.execute(currentContent, context);
        const durationMs = Date.now() - stageStart;

        stageResults.push({
          stage: stage.name,
          type: stage.type,
          durationMs,
          modified: output.modified,
          details: output.details,
        });

        if (output.modified) {
          currentContent = output.content;
        }

        logger.debug(
          { stage: stage.name, durationMs, modified: output.modified },
          'Stage completed',
        );
      } catch (error) {
        const durationMs = Date.now() - stageStart;
        const errorMessage = error instanceof Error ? error.message : String(error);

        logger.error({ stage: stage.name, error: errorMessage }, 'Stage failed');

        stageResults.push({
          stage: stage.name,
          type: stage.type,
          durationMs,
          modified: false,
          details: { error: errorMessage, failed: true },
        });
      }
    }

    const totalDurationMs = Date.now() - pipelineStart;
    const finalScore = this.computeScore(stageResults);

    logger.info(
      { totalDurationMs, stageCount: stageResults.length, finalScore },
      'Enhancement pipeline completed',
    );

    return {
      originalInput: input,
      enhancedOutput: currentContent,
      stages: stageResults,
      totalDurationMs,
      finalScore,
    };
  }

  private computeScore(results: EnhancementStageResult[]): number {
    if (results.length === 0) return 1.0;

    const failedStages = results.filter((r) => r.details['failed'] === true).length;
    const modifiedStages = results.filter((r) => r.modified).length;
    const totalStages = results.length;

    // Base score: penalize failures, reward modifications
    const failurePenalty = failedStages / totalStages;
    const modificationBonus = modifiedStages > 0 ? 0.1 : 0;

    // Security/armour stages contribute to score
    const armourResults = results.filter((r) => r.type === 'armour');
    let securityPenalty = 0;
    for (const armour of armourResults) {
      const findings = armour.details['findings'];
      if (Array.isArray(findings) && findings.length > 0) {
        securityPenalty += 0.05 * findings.length;
      }
      if (armour.details['requiresHumanReview'] === true) {
        securityPenalty += 0.2;
      }
    }

    // Confidence from stabilizer stages
    const confidenceResults = results.filter(
      (r) => r.type === 'stabilizer' && typeof r.details['confidence'] === 'number',
    );
    let confidenceAdjustment = 0;
    if (confidenceResults.length > 0) {
      const avgConfidence =
        confidenceResults.reduce((sum, r) => sum + (r.details['confidence'] as number), 0) /
        confidenceResults.length;
      confidenceAdjustment = (avgConfidence - 0.5) * 0.2; // Scale to [-0.1, 0.1]
    }

    const score = Math.max(
      0,
      Math.min(1, 1.0 - failurePenalty + modificationBonus - securityPenalty + confidenceAdjustment),
    );

    return Math.round(score * 100) / 100;
  }
}

export { EnhancementPipeline as Pipeline };

export type { EnhancementStage, StageContext, StageOutput } from './stage-interface.js';
export { PipelineBuilder } from './pipeline-builder.js';

// Amplifiers
export { RagInjector } from './amplifiers/rag-injector.js';
export { ChainOfVerification } from './amplifiers/chain-of-verification.js';
export { EnsembleRouter } from './amplifiers/ensemble-router.js';
export { DomainExpertPrompts } from './amplifiers/domain-expert-prompts.js';
export { OutputRefinementLoop } from './amplifiers/output-refinement-loop.js';

// Stabilizers
export { SchemaEnforcer } from './stabilizers/schema-enforcer.js';
export { DeterministicValidator } from './stabilizers/deterministic-validator.js';
export { ConfidenceScorer } from './stabilizers/confidence-scorer.js';
export { TemperatureController } from './stabilizers/temperature-controller.js';
export { RetryEscalator } from './stabilizers/retry-escalator.js';

// Codecs
export { PromptCompiler } from './codecs/prompt-compiler.js';
export { ContextCompressor } from './codecs/context-compressor.js';
export { OutputNormalizer } from './codecs/output-normalizer.js';
export { CodeFormatter } from './codecs/code-formatter.js';
export { SemanticDeduplicator } from './codecs/semantic-deduplicator.js';

// Armours
export { SecurityScanner } from './armours/security-scanner.js';
export { PiiDetector } from './armours/pii-detector.js';
export { LicenseChecker } from './armours/license-checker.js';
export { CostLimiter } from './armours/cost-limiter.js';
export { HumanEscalationGate } from './armours/human-escalation-gate.js';
