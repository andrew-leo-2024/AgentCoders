import type {
  EnhancementPipelineConfig,
  AmplifierConfig,
  StabilizerConfig,
  CodecConfig,
  ArmourConfig,
} from '@agentcoders/shared';
import { EnhancementPipeline } from './pipeline.js';
import { RagInjector } from './amplifiers/rag-injector.js';
import { ChainOfVerification } from './amplifiers/chain-of-verification.js';
import { EnsembleRouter } from './amplifiers/ensemble-router.js';
import { DomainExpertPrompts } from './amplifiers/domain-expert-prompts.js';
import { OutputRefinementLoop } from './amplifiers/output-refinement-loop.js';
import { SchemaEnforcer } from './stabilizers/schema-enforcer.js';
import { DeterministicValidator } from './stabilizers/deterministic-validator.js';
import { ConfidenceScorer } from './stabilizers/confidence-scorer.js';
import { TemperatureController } from './stabilizers/temperature-controller.js';
import { RetryEscalator } from './stabilizers/retry-escalator.js';
import { PromptCompiler } from './codecs/prompt-compiler.js';
import { ContextCompressor } from './codecs/context-compressor.js';
import { OutputNormalizer } from './codecs/output-normalizer.js';
import { CodeFormatter } from './codecs/code-formatter.js';
import { SemanticDeduplicator } from './codecs/semantic-deduplicator.js';
import { SecurityScanner } from './armours/security-scanner.js';
import { PiiDetector } from './armours/pii-detector.js';
import { LicenseChecker } from './armours/license-checker.js';
import { CostLimiter } from './armours/cost-limiter.js';
import { HumanEscalationGate } from './armours/human-escalation-gate.js';

export class PipelineBuilder {
  private amplifierConfig: Partial<AmplifierConfig> = {};
  private stabilizerConfig: Partial<StabilizerConfig> = {};
  private codecConfig: Partial<CodecConfig> = {};
  private armourConfig: Partial<ArmourConfig> = {};

  private constructor() {}

  static create(): PipelineBuilder {
    return new PipelineBuilder();
  }

  withAmplifiers(config: Partial<AmplifierConfig>): PipelineBuilder {
    this.amplifierConfig = { ...this.amplifierConfig, ...config };
    return this;
  }

  withStabilizers(config: Partial<StabilizerConfig>): PipelineBuilder {
    this.stabilizerConfig = { ...this.stabilizerConfig, ...config };
    return this;
  }

  withCodecs(config: Partial<CodecConfig>): PipelineBuilder {
    this.codecConfig = { ...this.codecConfig, ...config };
    return this;
  }

  withArmours(config: Partial<ArmourConfig>): PipelineBuilder {
    this.armourConfig = { ...this.armourConfig, ...config };
    return this;
  }

  build(): EnhancementPipeline {
    const config: EnhancementPipelineConfig = {
      amplifiers: this.amplifierConfig,
      stabilizers: this.stabilizerConfig,
      codecs: this.codecConfig,
      armours: this.armourConfig,
    };

    const pipeline = new EnhancementPipeline(config);

    // Add amplifiers in order
    this.addAmplifiers(pipeline);

    // Add stabilizers
    this.addStabilizers(pipeline);

    // Add codecs
    this.addCodecs(pipeline);

    // Add armours
    this.addArmours(pipeline);

    return pipeline;
  }

  private addAmplifiers(pipeline: EnhancementPipeline): void {
    const cfg = this.amplifierConfig;

    if (cfg.ragInjector?.enabled) {
      pipeline.addStage(
        new RagInjector(cfg.ragInjector.maxChunks, cfg.ragInjector.similarityThreshold),
      );
    }
    if (cfg.chainOfVerification?.enabled) {
      pipeline.addStage(new ChainOfVerification(cfg.chainOfVerification.maxIterations));
    }
    if (cfg.ensembleRouter?.enabled) {
      pipeline.addStage(
        new EnsembleRouter(cfg.ensembleRouter.modelCount, cfg.ensembleRouter.votingStrategy),
      );
    }
    if (cfg.domainExpertPrompts?.enabled) {
      pipeline.addStage(new DomainExpertPrompts(cfg.domainExpertPrompts.vertical));
    }
    if (cfg.outputRefinementLoop?.enabled) {
      pipeline.addStage(
        new OutputRefinementLoop(cfg.outputRefinementLoop.maxLoops, cfg.outputRefinementLoop.tools),
      );
    }
  }

  private addStabilizers(pipeline: EnhancementPipeline): void {
    const cfg = this.stabilizerConfig;

    if (cfg.schemaEnforcer?.enabled) {
      pipeline.addStage(new SchemaEnforcer(cfg.schemaEnforcer.retryCount));
    }
    if (cfg.deterministicValidator?.enabled) {
      pipeline.addStage(
        new DeterministicValidator(
          cfg.deterministicValidator.parseAst,
          cfg.deterministicValidator.checkImports,
        ),
      );
    }
    if (cfg.confidenceScorer?.enabled) {
      pipeline.addStage(new ConfidenceScorer(cfg.confidenceScorer.threshold));
    }
    if (cfg.temperatureController?.enabled) {
      pipeline.addStage(new TemperatureController());
    }
    if (cfg.retryEscalator?.enabled) {
      pipeline.addStage(
        new RetryEscalator(cfg.retryEscalator.maxRetries, cfg.retryEscalator.escalationModel),
      );
    }
  }

  private addCodecs(pipeline: EnhancementPipeline): void {
    const cfg = this.codecConfig;

    if (cfg.promptCompiler?.enabled) {
      pipeline.addStage(new PromptCompiler());
    }
    if (cfg.contextCompressor?.enabled) {
      pipeline.addStage(new ContextCompressor(cfg.contextCompressor.maxTokens));
    }
    if (cfg.outputNormalizer?.enabled) {
      pipeline.addStage(new OutputNormalizer(cfg.outputNormalizer.format));
    }
    if (cfg.codeFormatter?.enabled) {
      pipeline.addStage(
        new CodeFormatter(cfg.codeFormatter.prettier, cfg.codeFormatter.eslint),
      );
    }
    if (cfg.semanticDeduplicator?.enabled) {
      pipeline.addStage(new SemanticDeduplicator());
    }
  }

  private addArmours(pipeline: EnhancementPipeline): void {
    const cfg = this.armourConfig;

    if (cfg.securityScanner?.enabled) {
      pipeline.addStage(new SecurityScanner(cfg.securityScanner.checks));
    }
    if (cfg.piiDetector?.enabled) {
      pipeline.addStage(new PiiDetector(cfg.piiDetector.redact));
    }
    if (cfg.licenseChecker?.enabled) {
      pipeline.addStage(new LicenseChecker(cfg.licenseChecker.allowedLicenses));
    }
    if (cfg.costLimiter?.enabled) {
      pipeline.addStage(new CostLimiter(cfg.costLimiter.maxCostUsd));
    }
    if (cfg.humanEscalationGate?.enabled) {
      pipeline.addStage(new HumanEscalationGate(cfg.humanEscalationGate.riskThreshold));
    }
  }
}
