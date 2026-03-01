import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('ensemble-router');

interface ModelCandidate {
  modelId: string;
  strengths: string[];
  costPerToken: number;
}

const MODEL_REGISTRY: ModelCandidate[] = [
  { modelId: 'claude-sonnet-4-20250514', strengths: ['code', 'reasoning', 'speed'], costPerToken: 0.003 },
  { modelId: 'claude-opus-4-20250514', strengths: ['complex-reasoning', 'architecture', 'nuance'], costPerToken: 0.015 },
  { modelId: 'gpt-4o', strengths: ['general', 'instruction-following'], costPerToken: 0.005 },
  { modelId: 'claude-haiku-3.5', strengths: ['speed', 'simple-tasks', 'cost-effective'], costPerToken: 0.00025 },
];

export class EnsembleRouter implements EnhancementStage {
  readonly name = 'ensemble-router';
  readonly type = 'amplifier' as const;

  private readonly modelCount: number;
  private readonly votingStrategy: 'majority' | 'best-score';

  constructor(modelCount: number = 3, votingStrategy: 'majority' | 'best-score' = 'majority') {
    this.modelCount = modelCount;
    this.votingStrategy = votingStrategy;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, modelCount: this.modelCount, votingStrategy: this.votingStrategy },
      'Ensemble routing stage executing',
    );

    // Analyze input to determine task characteristics
    const taskProfile = this.analyzeTaskProfile(input);

    // Select best models for this task
    const selectedModels = this.selectModels(taskProfile);

    // In production, this would fan out to multiple models and aggregate results
    // For now, we annotate the input with routing metadata
    const routingAnnotation = [
      `<ensemble-routing>`,
      `  <strategy>${this.votingStrategy}</strategy>`,
      `  <task-profile>`,
      `    <complexity>${taskProfile.complexity}</complexity>`,
      `    <domain>${taskProfile.domain}</domain>`,
      `    <requires>${taskProfile.requirements.join(', ')}</requires>`,
      `  </task-profile>`,
      `  <selected-models>`,
      ...selectedModels.map(
        (m) => `    <model id="${m.modelId}" cost="${m.costPerToken}" strengths="${m.strengths.join(',')}" />`,
      ),
      `  </selected-models>`,
      `</ensemble-routing>`,
    ].join('\n');

    const enhancedContent = `${routingAnnotation}\n\n${input}`;

    logger.info(
      {
        taskComplexity: taskProfile.complexity,
        selectedModels: selectedModels.map((m) => m.modelId),
      },
      'Ensemble routing determined',
    );

    return {
      content: enhancedContent,
      modified: true,
      details: {
        taskProfile,
        selectedModels: selectedModels.map((m) => ({
          modelId: m.modelId,
          costPerToken: m.costPerToken,
        })),
        votingStrategy: this.votingStrategy,
        estimatedCost: selectedModels.reduce((sum, m) => sum + m.costPerToken, 0),
      },
    };
  }

  private analyzeTaskProfile(input: string): {
    complexity: 'low' | 'medium' | 'high';
    domain: string;
    requirements: string[];
  } {
    const length = input.length;
    const requirements: string[] = [];
    let domain = 'general';

    // Complexity heuristics
    const hasCodeBlocks = /```[\s\S]+?```/.test(input);
    const hasMultipleSteps = /(?:step\s*\d|first.*then.*finally|1\.\s|2\.\s|3\.\s)/i.test(input);
    const hasArchitectureTerms = /(?:architect|design\s+pattern|microservice|distributed|scalab)/i.test(input);
    const hasDebugging = /(?:bug|error|fix|debug|issue|stacktrace|exception)/i.test(input);

    if (hasCodeBlocks) requirements.push('code');
    if (hasMultipleSteps) requirements.push('multi-step');
    if (hasArchitectureTerms) requirements.push('architecture');
    if (hasDebugging) requirements.push('debugging');

    // Domain detection
    if (/(?:react|vue|angular|css|html|frontend|component)/i.test(input)) domain = 'frontend';
    else if (/(?:api|endpoint|database|sql|migration|backend|server)/i.test(input)) domain = 'backend';
    else if (/(?:docker|kubernetes|k8s|terraform|aws|azure|deploy|ci\/cd)/i.test(input)) domain = 'devops';
    else if (/(?:test|spec|coverage|mock|stub|fixture)/i.test(input)) domain = 'testing';
    else if (/(?:security|auth|oauth|jwt|encrypt|vulnerability)/i.test(input)) domain = 'security';

    // Complexity scoring
    let complexityScore = 0;
    if (length > 2000) complexityScore++;
    if (length > 5000) complexityScore++;
    if (hasMultipleSteps) complexityScore++;
    if (hasArchitectureTerms) complexityScore++;
    if (requirements.length > 2) complexityScore++;

    const complexity: 'low' | 'medium' | 'high' =
      complexityScore <= 1 ? 'low' : complexityScore <= 3 ? 'medium' : 'high';

    return { complexity, domain, requirements };
  }

  private selectModels(taskProfile: {
    complexity: 'low' | 'medium' | 'high';
    domain: string;
    requirements: string[];
  }): ModelCandidate[] {
    // Score each model for the task
    const scored = MODEL_REGISTRY.map((model) => {
      let score = 0;

      // Complexity matching
      if (taskProfile.complexity === 'high' && model.strengths.includes('complex-reasoning')) {
        score += 3;
      }
      if (taskProfile.complexity === 'low' && model.strengths.includes('speed')) {
        score += 2;
      }
      if (taskProfile.complexity === 'medium' && model.strengths.includes('code')) {
        score += 2;
      }

      // Requirement matching
      for (const req of taskProfile.requirements) {
        if (req === 'code' && model.strengths.includes('code')) score += 2;
        if (req === 'architecture' && model.strengths.includes('complex-reasoning')) score += 2;
        if (req === 'multi-step' && model.strengths.includes('reasoning')) score += 1;
      }

      // Cost efficiency for simple tasks
      if (taskProfile.complexity === 'low') {
        score += (1 / (model.costPerToken * 1000));
      }

      return { model, score };
    });

    // Sort by score descending and take top N
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, this.modelCount)
      .map((s) => s.model);
  }
}
