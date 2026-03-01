import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('confidence-scorer');

interface ScoringSignal {
  name: string;
  weight: number;
  score: number;
  reason: string;
}

export class ConfidenceScorer implements EnhancementStage {
  readonly name = 'confidence-scorer';
  readonly type = 'stabilizer' as const;

  private readonly threshold: number;

  constructor(threshold: number = 0.6) {
    this.threshold = threshold;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, threshold: this.threshold },
      'Confidence scoring executing',
    );

    const signals = this.computeSignals(input);
    const weightedScore = this.computeWeightedScore(signals);
    const passesThreshold = weightedScore >= this.threshold;

    if (!passesThreshold) {
      logger.warn(
        { score: weightedScore, threshold: this.threshold },
        'Content below confidence threshold',
      );

      return {
        content: input,
        modified: false,
        details: {
          confidence: weightedScore,
          threshold: this.threshold,
          passesThreshold: false,
          signals: signals.map((s) => ({ name: s.name, score: s.score, reason: s.reason })),
          recommendation: 'retry',
          message: `Confidence ${weightedScore.toFixed(2)} below threshold ${this.threshold}`,
        },
      };
    }

    logger.info({ score: weightedScore }, 'Content passes confidence threshold');

    return {
      content: input,
      modified: false,
      details: {
        confidence: weightedScore,
        threshold: this.threshold,
        passesThreshold: true,
        signals: signals.map((s) => ({ name: s.name, score: s.score, reason: s.reason })),
      },
    };
  }

  private computeSignals(input: string): ScoringSignal[] {
    const signals: ScoringSignal[] = [];

    // Signal 1: Content length — very short responses are often incomplete
    signals.push(this.scoreLengthSignal(input));

    // Signal 2: Code structure quality
    signals.push(this.scoreCodeStructure(input));

    // Signal 3: Completeness indicators
    signals.push(this.scoreCompleteness(input));

    // Signal 4: Hedging language (lower confidence when output hedges)
    signals.push(this.scoreHedgingLanguage(input));

    // Signal 5: Error handling presence
    signals.push(this.scoreErrorHandling(input));

    // Signal 6: Documentation quality
    signals.push(this.scoreDocumentation(input));

    return signals;
  }

  private scoreLengthSignal(input: string): ScoringSignal {
    const length = input.length;
    let score: number;
    let reason: string;

    if (length < 50) {
      score = 0.2;
      reason = 'Very short response — likely incomplete';
    } else if (length < 200) {
      score = 0.5;
      reason = 'Short response — may lack detail';
    } else if (length < 5000) {
      score = 0.9;
      reason = 'Reasonable length';
    } else if (length < 20000) {
      score = 0.8;
      reason = 'Long response — check for verbosity';
    } else {
      score = 0.6;
      reason = 'Very long response — may contain unnecessary content';
    }

    return { name: 'length', weight: 0.1, score, reason };
  }

  private scoreCodeStructure(input: string): ScoringSignal {
    const codeBlockCount = (input.match(/```[\s\S]*?```/g) ?? []).length;
    const hasTypedCode = /```(?:typescript|ts|javascript|js|python|go|rust)/.test(input);
    const hasImports = /import\s.*from\s/.test(input);
    const hasExports = /export\s/.test(input);
    const hasFunctions = /(?:function\s|=>\s*\{|async\s+function)/.test(input);

    let score = 0.5; // baseline

    if (codeBlockCount === 0) {
      // No code blocks — might be pure text answer which is fine
      return { name: 'code-structure', weight: 0.15, score: 0.7, reason: 'No code blocks — text response' };
    }

    if (hasTypedCode) score += 0.15;
    if (hasImports) score += 0.1;
    if (hasExports) score += 0.1;
    if (hasFunctions) score += 0.1;

    // Penalty for code without structure
    if (codeBlockCount > 0 && !hasFunctions && !hasImports) {
      score -= 0.2;
    }

    const reason = [
      `${codeBlockCount} code block(s)`,
      hasTypedCode ? 'typed' : 'untyped',
      hasImports ? 'has imports' : 'no imports',
      hasFunctions ? 'has functions' : 'no functions',
    ].join(', ');

    return { name: 'code-structure', weight: 0.15, score: Math.max(0, Math.min(1, score)), reason };
  }

  private scoreCompleteness(input: string): ScoringSignal {
    let score = 0.7; // baseline
    const reasons: string[] = [];

    // Positive: contains clear structure markers
    if (/(?:step\s*\d|first|second|third|finally)/i.test(input)) {
      score += 0.1;
      reasons.push('has structured steps');
    }

    // Positive: contains examples
    if (/(?:example|e\.g\.|for instance|such as)/i.test(input)) {
      score += 0.05;
      reasons.push('includes examples');
    }

    // Negative: contains TODO/FIXME
    const todoCount = (input.match(/(?:TODO|FIXME|HACK|XXX)/g) ?? []).length;
    if (todoCount > 0) {
      score -= 0.1 * Math.min(todoCount, 3);
      reasons.push(`${todoCount} TODO/FIXME markers`);
    }

    // Negative: truncated content
    if (/\.{3}\s*$|…\s*$/.test(input.trim())) {
      score -= 0.3;
      reasons.push('appears truncated');
    }

    // Negative: placeholder content
    const placeholders = (input.match(/\b(?:placeholder|lorem ipsum|your[_ ]?code[_ ]?here|implement[_ ]?this)\b/gi) ?? []).length;
    if (placeholders > 0) {
      score -= 0.15 * Math.min(placeholders, 3);
      reasons.push(`${placeholders} placeholder(s) detected`);
    }

    return {
      name: 'completeness',
      weight: 0.25,
      score: Math.max(0, Math.min(1, score)),
      reason: reasons.length > 0 ? reasons.join('; ') : 'no completeness issues',
    };
  }

  private scoreHedgingLanguage(input: string): ScoringSignal {
    const hedges = [
      /\bI(?:'m| am) not (?:sure|certain)\b/gi,
      /\bI think\b/gi,
      /\bprobably\b/gi,
      /\bI believe\b/gi,
      /\bmight\s+(?:work|be)\b/gi,
      /\bnot entirely sure\b/gi,
      /\bI don'?t know\b/gi,
      /\bpossibly\b/gi,
      /\byou may need to\b/gi,
      /\bI'?d recommend checking\b/gi,
    ];

    let hedgeCount = 0;
    for (const pattern of hedges) {
      const matches = input.match(pattern);
      if (matches) hedgeCount += matches.length;
    }

    let score: number;
    let reason: string;

    if (hedgeCount === 0) {
      score = 0.9;
      reason = 'No hedging language detected';
    } else if (hedgeCount <= 2) {
      score = 0.7;
      reason = `Minor hedging (${hedgeCount} instance(s))`;
    } else {
      score = 0.4;
      reason = `Significant hedging (${hedgeCount} instances) — low model confidence`;
    }

    return { name: 'hedging', weight: 0.2, score, reason };
  }

  private scoreErrorHandling(input: string): ScoringSignal {
    const hasCode = /```[\s\S]*?```/.test(input);
    if (!hasCode) {
      return { name: 'error-handling', weight: 0.15, score: 0.7, reason: 'No code to evaluate' };
    }

    let score = 0.5;
    const reasons: string[] = [];

    // Check for try-catch blocks
    if (/try\s*\{/.test(input)) {
      score += 0.2;
      reasons.push('has try-catch');
    }

    // Check for error type checking
    if (/instanceof\s+Error|\.message\b|\.stack\b/.test(input)) {
      score += 0.1;
      reasons.push('checks error types');
    }

    // Check for error propagation
    if (/throw\s+new\s+\w*Error/.test(input)) {
      score += 0.1;
      reasons.push('throws typed errors');
    }

    // Penalty for swallowed errors
    if (/catch\s*\([^)]*\)\s*\{\s*\}/.test(input)) {
      score -= 0.3;
      reasons.push('swallowed errors detected');
    }

    return {
      name: 'error-handling',
      weight: 0.15,
      score: Math.max(0, Math.min(1, score)),
      reason: reasons.length > 0 ? reasons.join('; ') : 'basic error handling',
    };
  }

  private scoreDocumentation(input: string): ScoringSignal {
    const hasCode = /```[\s\S]*?```/.test(input);
    if (!hasCode) {
      return { name: 'documentation', weight: 0.15, score: 0.7, reason: 'No code to evaluate' };
    }

    let score = 0.5;
    const reasons: string[] = [];

    // JSDoc comments
    if (/\/\*\*[\s\S]*?\*\//.test(input)) {
      score += 0.2;
      reasons.push('has JSDoc');
    }

    // Inline comments
    const commentLines = (input.match(/^\s*\/\//gm) ?? []).length;
    if (commentLines > 0) {
      score += Math.min(0.15, commentLines * 0.03);
      reasons.push(`${commentLines} comment line(s)`);
    }

    // Type annotations (TypeScript)
    const typeAnnotations = (input.match(/:\s*(?:string|number|boolean|void|Promise|Array|Record|Map)\b/g) ?? []).length;
    if (typeAnnotations > 0) {
      score += Math.min(0.15, typeAnnotations * 0.03);
      reasons.push(`${typeAnnotations} type annotation(s)`);
    }

    return {
      name: 'documentation',
      weight: 0.15,
      score: Math.max(0, Math.min(1, score)),
      reason: reasons.length > 0 ? reasons.join('; ') : 'minimal documentation',
    };
  }

  private computeWeightedScore(signals: ScoringSignal[]): number {
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const weightedSum = signals.reduce((sum, s) => sum + s.score * s.weight, 0);
    const score = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
    return Math.round(score * 100) / 100;
  }
}
