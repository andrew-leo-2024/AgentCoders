import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('chain-of-verification');

interface Claim {
  text: string;
  line: number;
  category: 'factual' | 'code-correctness' | 'dependency' | 'api-usage';
  verificationStatus: 'pending' | 'plausible' | 'suspicious';
  confidence: number;
}

export class ChainOfVerification implements EnhancementStage {
  readonly name = 'chain-of-verification';
  readonly type = 'amplifier' as const;

  private readonly maxIterations: number;

  constructor(maxIterations: number = 3) {
    this.maxIterations = maxIterations;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, maxIterations: this.maxIterations },
      'Chain-of-verification executing',
    );

    const claims = this.extractClaims(input);

    if (claims.length === 0) {
      return {
        content: input,
        modified: false,
        details: {
          claimsFound: 0,
          message: 'No verifiable claims detected',
        },
      };
    }

    // Run verification iterations
    let verifiedClaims = claims;
    for (let iteration = 0; iteration < this.maxIterations; iteration++) {
      verifiedClaims = this.verifyClaims(verifiedClaims, input);

      const pendingCount = verifiedClaims.filter((c) => c.verificationStatus === 'pending').length;
      if (pendingCount === 0) break;
    }

    const suspiciousClaims = verifiedClaims.filter((c) => c.verificationStatus === 'suspicious');
    const plausibleClaims = verifiedClaims.filter((c) => c.verificationStatus === 'plausible');

    // Add verification annotations if suspicious claims found
    let outputContent = input;
    let modified = false;

    if (suspiciousClaims.length > 0) {
      const warnings = suspiciousClaims
        .map((c) => `  - Line ${c.line}: [${c.category}] "${c.text.substring(0, 80)}..." (confidence: ${c.confidence.toFixed(2)})`)
        .join('\n');

      outputContent = `${input}\n\n<!-- VERIFICATION WARNINGS -->\n<!-- The following claims need review:\n${warnings}\n-->`;
      modified = true;
    }

    logger.info(
      {
        totalClaims: claims.length,
        suspicious: suspiciousClaims.length,
        plausible: plausibleClaims.length,
      },
      'Verification complete',
    );

    return {
      content: outputContent,
      modified,
      details: {
        claimsFound: claims.length,
        suspiciousClaims: suspiciousClaims.length,
        plausibleClaims: plausibleClaims.length,
        claims: verifiedClaims.map((c) => ({
          text: c.text.substring(0, 100),
          category: c.category,
          status: c.verificationStatus,
          confidence: c.confidence,
        })),
      },
    };
  }

  private extractClaims(input: string): Claim[] {
    const claims: Claim[] = [];
    const lines = input.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('<!--')) {
        continue;
      }

      // Detect version/dependency claims: "requires X v1.2.3", "works with Node 18+"
      const versionPattern = /(?:requires?|needs?|uses?|works?\s+with)\s+[\w.-]+\s+v?[\d.]+/i;
      if (versionPattern.test(line)) {
        claims.push({
          text: line,
          line: i + 1,
          category: 'dependency',
          verificationStatus: 'pending',
          confidence: 0.5,
        });
      }

      // Detect API usage claims: "import ... from ...", function calls with specific signatures
      const importPattern = /import\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]/;
      if (importPattern.test(line)) {
        claims.push({
          text: line,
          line: i + 1,
          category: 'api-usage',
          verificationStatus: 'pending',
          confidence: 0.6,
        });
      }

      // Detect factual claims: URLs, specific numbers, "according to", "officially"
      const factualPattern = /(?:according\s+to|officially|documented\s+at|as\s+per|per\s+the\s+docs?)/i;
      if (factualPattern.test(line)) {
        claims.push({
          text: line,
          line: i + 1,
          category: 'factual',
          verificationStatus: 'pending',
          confidence: 0.4,
        });
      }

      // Detect code correctness claims: type assertions, unsafe casts, any types
      const unsafeCodePattern = /(?:as\s+any|@ts-ignore|@ts-expect-error|eslint-disable|!\.|\.constructor)/;
      if (unsafeCodePattern.test(line)) {
        claims.push({
          text: line,
          line: i + 1,
          category: 'code-correctness',
          verificationStatus: 'suspicious',
          confidence: 0.3,
        });
      }
    }

    return claims;
  }

  private verifyClaims(claims: Claim[], _context: string): Claim[] {
    return claims.map((claim) => {
      if (claim.verificationStatus !== 'pending') return claim;

      // Heuristic verification based on category
      switch (claim.category) {
        case 'dependency': {
          // Check for known problematic patterns
          const hasWildcardVersion = /\*|latest|next/.test(claim.text);
          return {
            ...claim,
            verificationStatus: hasWildcardVersion ? 'suspicious' as const : 'plausible' as const,
            confidence: hasWildcardVersion ? 0.3 : 0.7,
          };
        }

        case 'api-usage': {
          // Check for commonly misused APIs
          const suspiciousApis = /(?:__dirname|__filename|require\(|module\.exports)/;
          const isEsmViolation = suspiciousApis.test(claim.text);
          return {
            ...claim,
            verificationStatus: isEsmViolation ? 'suspicious' as const : 'plausible' as const,
            confidence: isEsmViolation ? 0.3 : 0.8,
          };
        }

        case 'factual': {
          // Low confidence for unverifiable factual claims
          return {
            ...claim,
            verificationStatus: 'plausible' as const,
            confidence: 0.5,
          };
        }

        case 'code-correctness': {
          return {
            ...claim,
            verificationStatus: 'suspicious' as const,
            confidence: 0.3,
          };
        }

        default:
          return { ...claim, verificationStatus: 'plausible' as const, confidence: 0.6 };
      }
    });
  }
}
