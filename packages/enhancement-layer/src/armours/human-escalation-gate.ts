import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('human-escalation-gate');

interface RiskFactor {
  factor: string;
  score: number;
  weight: number;
  reason: string;
}

export class HumanEscalationGate implements EnhancementStage {
  readonly name = 'human-escalation-gate';
  readonly type = 'armour' as const;

  private readonly riskThreshold: number;

  constructor(riskThreshold: number = 0.7) {
    this.riskThreshold = riskThreshold;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, riskThreshold: this.riskThreshold },
      'Human escalation gate executing',
    );

    // Collect risk factors from context metadata (left by upstream stages)
    const riskFactors = this.assessRisk(input, context);

    // Compute weighted risk score
    const totalWeight = riskFactors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = totalWeight > 0
      ? riskFactors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight
      : 0;

    const riskScore = Math.round(weightedScore * 100) / 100;
    const requiresHumanReview = riskScore >= this.riskThreshold;

    if (requiresHumanReview) {
      logger.warn(
        {
          riskScore,
          threshold: this.riskThreshold,
          topFactors: riskFactors
            .sort((a, b) => b.score * b.weight - a.score * a.weight)
            .slice(0, 3)
            .map((f) => f.factor),
        },
        'Content flagged for human review',
      );

      // Mark in context for downstream consumers (e.g., Telegram gateway)
      context.metadata['requiresHumanReview'] = true;
      context.metadata['riskScore'] = riskScore;
      context.metadata['escalationReason'] = riskFactors
        .filter((f) => f.score >= 0.5)
        .map((f) => f.reason)
        .join('; ');

      return {
        content: input,
        modified: false,
        details: {
          requiresHumanReview: true,
          riskScore,
          riskThreshold: this.riskThreshold,
          riskFactors: riskFactors.map((f) => ({
            factor: f.factor,
            score: f.score,
            reason: f.reason,
          })),
          message: `Risk score ${riskScore} exceeds threshold ${this.riskThreshold} — human review required`,
          action: 'hold',
        },
      };
    }

    logger.info({ riskScore, threshold: this.riskThreshold }, 'Content passes escalation gate');

    return {
      content: input,
      modified: false,
      details: {
        requiresHumanReview: false,
        riskScore,
        riskThreshold: this.riskThreshold,
        riskFactors: riskFactors.map((f) => ({
          factor: f.factor,
          score: f.score,
          reason: f.reason,
        })),
        action: 'pass',
      },
    };
  }

  private assessRisk(input: string, context: StageContext): RiskFactor[] {
    const factors: RiskFactor[] = [];

    // Factor 1: Security findings from SecurityScanner
    factors.push(this.assessSecurityRisk(context));

    // Factor 2: PII detection results
    factors.push(this.assessPiiRisk(context));

    // Factor 3: License compliance
    factors.push(this.assessLicenseRisk(context));

    // Factor 4: Cost usage
    factors.push(this.assessCostRisk(context));

    // Factor 5: Confidence score from ConfidenceScorer
    factors.push(this.assessConfidenceRisk(context));

    // Factor 6: Content-based risk signals
    factors.push(this.assessContentRisk(input));

    // Factor 7: Infrastructure/deployment risk
    factors.push(this.assessInfraRisk(input));

    // Factor 8: Explicit risk markers from context
    factors.push(this.assessExplicitRisk(context));

    return factors;
  }

  private assessSecurityRisk(context: StageContext): RiskFactor {
    // Look for security scanner results in prior stage data
    const findings = context.metadata['securityFindings'] as Array<{ severity: string }> | undefined;

    if (!findings || findings.length === 0) {
      return { factor: 'security', score: 0, weight: 3.0, reason: 'No security issues detected' };
    }

    const criticals = findings.filter((f) => f.severity === 'critical').length;
    const highs = findings.filter((f) => f.severity === 'high').length;

    const score = Math.min(1.0, criticals * 0.4 + highs * 0.2 + findings.length * 0.05);
    return {
      factor: 'security',
      score,
      weight: 3.0,
      reason: `${criticals} critical, ${highs} high severity security findings`,
    };
  }

  private assessPiiRisk(context: StageContext): RiskFactor {
    const piiCount = context.metadata['piiMatchCount'] as number | undefined;

    if (!piiCount || piiCount === 0) {
      return { factor: 'pii', score: 0, weight: 2.5, reason: 'No PII detected' };
    }

    const score = Math.min(1.0, piiCount * 0.2);
    return {
      factor: 'pii',
      score,
      weight: 2.5,
      reason: `${piiCount} PII instance(s) detected in output`,
    };
  }

  private assessLicenseRisk(context: StageContext): RiskFactor {
    const violations = context.metadata['licenseViolations'] as string[] | undefined;

    if (!violations || violations.length === 0) {
      return { factor: 'license', score: 0, weight: 2.0, reason: 'No license violations' };
    }

    const score = Math.min(1.0, violations.length * 0.3);
    return {
      factor: 'license',
      score,
      weight: 2.0,
      reason: `${violations.length} license violation(s): ${violations[0]}`,
    };
  }

  private assessCostRisk(context: StageContext): RiskFactor {
    const costState = context.metadata['costTrackingState'] as {
      cumulativeCostUsd: number;
    } | undefined;

    const maxCost = context.metadata['maxCostUsd'] as number | undefined;

    if (!costState || !maxCost) {
      return { factor: 'cost', score: 0, weight: 1.5, reason: 'No cost data available' };
    }

    const usagePercent = costState.cumulativeCostUsd / maxCost;
    const score = usagePercent >= 1.0 ? 1.0 : usagePercent >= 0.9 ? 0.8 : usagePercent >= 0.75 ? 0.4 : 0;

    return {
      factor: 'cost',
      score,
      weight: 1.5,
      reason: `Cost usage at ${Math.round(usagePercent * 100)}% of budget`,
    };
  }

  private assessConfidenceRisk(context: StageContext): RiskFactor {
    const confidence = context.metadata['confidence'] as number | undefined;

    if (confidence === undefined) {
      return { factor: 'confidence', score: 0.3, weight: 1.0, reason: 'No confidence score available' };
    }

    // Low confidence = high risk
    const score = confidence < 0.3 ? 0.9 : confidence < 0.5 ? 0.6 : confidence < 0.7 ? 0.3 : 0;

    return {
      factor: 'confidence',
      score,
      weight: 1.0,
      reason: `Model confidence: ${confidence.toFixed(2)}`,
    };
  }

  private assessContentRisk(input: string): RiskFactor {
    let score = 0;
    const reasons: string[] = [];

    // Destructive operations
    const destructivePatterns = [
      /\bDROP\s+(?:TABLE|DATABASE|SCHEMA)\b/gi,
      /\bDELETE\s+FROM\b/gi,
      /\brm\s+-rf\b/g,
      /\bformat\s+[A-Z]:/gi,
      /\bTRUNCATE\s+TABLE\b/gi,
      /\bALTER\s+TABLE\b.*\bDROP\b/gi,
    ];

    for (const pattern of destructivePatterns) {
      if (pattern.test(input)) {
        score += 0.3;
        reasons.push('Destructive operation detected');
        break;
      }
    }

    // Privilege escalation
    const privEscPatterns = [
      /\bsudo\b/g,
      /\bchmod\s+777\b/g,
      /\bchown\s+root/g,
      /\bGRANT\s+ALL\b/gi,
      /\b(?:admin|root)\s*[:=]/gi,
    ];

    for (const pattern of privEscPatterns) {
      if (pattern.test(input)) {
        score += 0.2;
        reasons.push('Privilege escalation indicator');
        break;
      }
    }

    // Network exposure
    const networkPatterns = [
      /\b0\.0\.0\.0\b/g,
      /EXPOSE\s+(?:22|3389|1433|3306|5432)\b/g,
      /\b(?:listen|bind)\s*\(\s*(?:['"])?0\.0\.0\.0/g,
    ];

    for (const pattern of networkPatterns) {
      if (pattern.test(input)) {
        score += 0.15;
        reasons.push('Network exposure concern');
        break;
      }
    }

    return {
      factor: 'content-risk',
      score: Math.min(1.0, score),
      weight: 2.0,
      reason: reasons.length > 0 ? reasons.join('; ') : 'No risky content patterns detected',
    };
  }

  private assessInfraRisk(input: string): RiskFactor {
    let score = 0;
    const reasons: string[] = [];

    // Production environment indicators
    if (/\bproduction\b/i.test(input) && /\b(?:deploy|migration|update|change)\b/i.test(input)) {
      score += 0.3;
      reasons.push('Production deployment detected');
    }

    // Infrastructure-as-code changes
    if (/\b(?:terraform|pulumi|cloudformation)\b/i.test(input)) {
      score += 0.2;
      reasons.push('Infrastructure-as-code changes');
    }

    // Kubernetes changes to critical resources
    if (/\bkind:\s*(?:ClusterRole|PersistentVolume|NetworkPolicy|Secret)\b/i.test(input)) {
      score += 0.2;
      reasons.push('Critical K8s resource modification');
    }

    // Database schema changes
    if (/\b(?:CREATE|ALTER|DROP)\s+(?:TABLE|INDEX|SCHEMA|DATABASE)\b/gi.test(input)) {
      score += 0.15;
      reasons.push('Database schema change');
    }

    return {
      factor: 'infra-risk',
      score: Math.min(1.0, score),
      weight: 1.5,
      reason: reasons.length > 0 ? reasons.join('; ') : 'No infrastructure risk detected',
    };
  }

  private assessExplicitRisk(context: StageContext): RiskFactor {
    const explicitRisk = context.metadata['riskLevel'] as string | undefined;
    const isHighRisk = context.metadata['highRisk'] === true;

    if (isHighRisk) {
      return {
        factor: 'explicit-risk',
        score: 1.0,
        weight: 5.0,
        reason: 'Explicitly marked as high risk by upstream stage',
      };
    }

    if (explicitRisk) {
      const riskMap: Record<string, number> = {
        'critical': 1.0,
        'high': 0.8,
        'medium': 0.5,
        'low': 0.2,
        'none': 0,
      };
      const score = riskMap[explicitRisk.toLowerCase()] ?? 0.5;
      return {
        factor: 'explicit-risk',
        score,
        weight: 5.0,
        reason: `Explicit risk level: ${explicitRisk}`,
      };
    }

    return { factor: 'explicit-risk', score: 0, weight: 0, reason: 'No explicit risk markers' };
  }
}
