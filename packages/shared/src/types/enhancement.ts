// Enhancement Layer types — amplifiers, stabilizers, codecs, armours

export interface AmplifierConfig {
  ragInjector: { enabled: boolean; maxChunks: number; similarityThreshold: number };
  chainOfVerification: { enabled: boolean; maxIterations: number };
  ensembleRouter: { enabled: boolean; modelCount: number; votingStrategy: 'majority' | 'best-score' };
  domainExpertPrompts: { enabled: boolean; vertical: string };
  outputRefinementLoop: { enabled: boolean; maxLoops: number; tools: ('lint' | 'typecheck' | 'test')[] };
}

export interface StabilizerConfig {
  schemaEnforcer: { enabled: boolean; retryCount: number };
  deterministicValidator: { enabled: boolean; parseAst: boolean; checkImports: boolean };
  confidenceScorer: { enabled: boolean; threshold: number };
  temperatureController: { enabled: boolean };
  retryEscalator: { enabled: boolean; maxRetries: number; escalationModel: string };
}

export interface CodecConfig {
  promptCompiler: { enabled: boolean };
  contextCompressor: { enabled: boolean; maxTokens: number };
  outputNormalizer: { enabled: boolean; format: 'markdown' | 'json' | 'code' };
  codeFormatter: { enabled: boolean; prettier: boolean; eslint: boolean };
  semanticDeduplicator: { enabled: boolean };
}

export interface ArmourConfig {
  securityScanner: { enabled: boolean; checks: ('xss' | 'sqli' | 'command-injection' | 'secrets')[] };
  piiDetector: { enabled: boolean; redact: boolean };
  licenseChecker: { enabled: boolean; allowedLicenses: string[] };
  costLimiter: { enabled: boolean; maxCostUsd: number };
  humanEscalationGate: { enabled: boolean; riskThreshold: number };
}

export interface EnhancementPipelineConfig {
  amplifiers: Partial<AmplifierConfig>;
  stabilizers: Partial<StabilizerConfig>;
  codecs: Partial<CodecConfig>;
  armours: Partial<ArmourConfig>;
}

export type EnhancementStageType = 'amplifier' | 'stabilizer' | 'codec' | 'armour';

export interface EnhancementStageResult {
  stage: string;
  type: EnhancementStageType;
  durationMs: number;
  modified: boolean;
  details: Record<string, unknown>;
}

export interface EnhancementResult {
  originalInput: string;
  enhancedOutput: string;
  stages: EnhancementStageResult[];
  totalDurationMs: number;
  finalScore: number;
}
