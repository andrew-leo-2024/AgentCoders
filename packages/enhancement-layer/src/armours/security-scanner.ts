import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('security-scanner');

type SecurityCheckType = 'xss' | 'sqli' | 'command-injection' | 'secrets';

interface SecurityFinding {
  type: SecurityCheckType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  message: string;
  line: number;
  pattern: string;
  snippet: string;
}

// XSS detection patterns
const XSS_PATTERNS: Array<{ pattern: RegExp; severity: SecurityFinding['severity']; message: string }> = [
  { pattern: /<script\b[^>]*>[\s\S]*?<\/script>/gi, severity: 'critical', message: 'Inline <script> tag detected' },
  { pattern: /\bon\w+\s*=\s*["'][^"']*["']/gi, severity: 'high', message: 'Inline event handler (onclick, onerror, etc.) detected' },
  { pattern: /javascript\s*:/gi, severity: 'high', message: 'javascript: protocol URI detected' },
  { pattern: /\.innerHTML\s*=(?!=)/g, severity: 'high', message: 'Direct innerHTML assignment — use textContent or sanitize' },
  { pattern: /\.outerHTML\s*=(?!=)/g, severity: 'high', message: 'Direct outerHTML assignment — use safe DOM APIs' },
  { pattern: /document\.write\s*\(/g, severity: 'high', message: 'document.write() detected — use DOM manipulation' },
  { pattern: /\bdangerouslySetInnerHTML\b/g, severity: 'medium', message: 'React dangerouslySetInnerHTML usage — ensure content is sanitized' },
  { pattern: /\$\(\s*['"][^'"]*['"]\s*\)\s*\.html\s*\(/g, severity: 'high', message: 'jQuery .html() with potential user input' },
  { pattern: /v-html\s*=/g, severity: 'medium', message: 'Vue v-html directive — ensure content is sanitized' },
  { pattern: /\[innerHTML\]\s*=/g, severity: 'medium', message: 'Angular [innerHTML] binding — ensure content is sanitized' },
];

// SQL injection detection patterns
const SQLI_PATTERNS: Array<{ pattern: RegExp; severity: SecurityFinding['severity']; message: string }> = [
  { pattern: /(?:['"`])\s*\+\s*\w+.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|UNION)/gi, severity: 'critical', message: 'SQL query built with string concatenation' },
  { pattern: /\$\{[^}]+\}.*(?:SELECT|INSERT|UPDATE|DELETE|DROP|WHERE|FROM)/gi, severity: 'critical', message: 'SQL query built with template literal interpolation' },
  { pattern: /(?:query|execute|exec)\s*\(\s*['"`].*\$\{/g, severity: 'critical', message: 'SQL query with interpolated values — use parameterized queries' },
  { pattern: /(?:query|execute|exec)\s*\(\s*(?:['"`][^'"]*['"`]\s*\+|\w+\s*\+\s*['"`])/g, severity: 'high', message: 'SQL query built with concatenation — use parameterized queries' },
  { pattern: /\.(?:raw|unsafeRaw)\s*\(/g, severity: 'high', message: 'Raw SQL query — ensure inputs are sanitized' },
  { pattern: /(?:EXEC|EXECUTE)\s+(?:sp_|xp_)/gi, severity: 'critical', message: 'Direct stored procedure execution detected' },
  { pattern: /(?:OR|AND)\s+['"]?\d*['"]?\s*=\s*['"]?\d*['"]?/gi, severity: 'medium', message: 'Possible tautology-based SQL injection pattern' },
];

// Command injection detection patterns
const CMD_INJECTION_PATTERNS: Array<{ pattern: RegExp; severity: SecurityFinding['severity']; message: string }> = [
  { pattern: /\beval\s*\(/g, severity: 'critical', message: 'eval() usage — avoid executing dynamic code' },
  { pattern: /\bexec\s*\(\s*(?:['"`]|.*\+)/g, severity: 'critical', message: 'exec() with potential dynamic input' },
  { pattern: /new\s+Function\s*\(/g, severity: 'critical', message: 'new Function() constructor — equivalent to eval()' },
  { pattern: /child_process.*\bexec\b/g, severity: 'high', message: 'child_process.exec() — use execFile() with array args instead' },
  { pattern: /\bspawn\s*\([^)]*\$\{/g, severity: 'high', message: 'spawn() with interpolated command — sanitize inputs' },
  { pattern: /\bsetTimeout\s*\(\s*['"`]/g, severity: 'medium', message: 'setTimeout with string argument — use function reference' },
  { pattern: /\bsetInterval\s*\(\s*['"`]/g, severity: 'medium', message: 'setInterval with string argument — use function reference' },
  { pattern: /\bos\.system\s*\(/g, severity: 'critical', message: 'os.system() usage — use subprocess with shell=False' },
  { pattern: /\bsubprocess\.(?:call|Popen)\s*\([^)]*shell\s*=\s*True/g, severity: 'high', message: 'subprocess with shell=True — use shell=False with list args' },
  { pattern: /\bprocess\.env\b.*\bexec|spawn|fork\b/g, severity: 'medium', message: 'Environment variable used in process execution context' },
];

// Hardcoded secrets detection patterns
const SECRET_PATTERNS: Array<{ pattern: RegExp; severity: SecurityFinding['severity']; message: string }> = [
  { pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*['"`](?!(?:\$\{|process\.env|{{|<))[a-zA-Z0-9_\-./+]{16,}['"`]/gi, severity: 'critical', message: 'Hardcoded API key detected' },
  { pattern: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*['"`](?!(?:\$\{|process\.env|{{|<|\.{3}|xxx|placeholder|changeme|your[_-]?))[a-zA-Z0-9_\-./+!@#$%^&*]{8,}['"`]/gi, severity: 'critical', message: 'Hardcoded secret/password detected' },
  { pattern: /(?:AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g, severity: 'critical', message: 'AWS access key ID detected' },
  { pattern: /(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36,}/g, severity: 'critical', message: 'GitHub personal access token detected' },
  { pattern: /sk-[A-Za-z0-9]{20,}/g, severity: 'critical', message: 'OpenAI API key pattern detected' },
  { pattern: /xox[baprs]-[A-Za-z0-9-]{10,}/g, severity: 'critical', message: 'Slack token detected' },
  { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, severity: 'critical', message: 'Private key detected' },
  { pattern: /(?:jdbc|mysql|postgresql|mongodb(?:\+srv)?|redis):\/\/[^:]+:[^@\s]+@/g, severity: 'critical', message: 'Database connection string with credentials detected' },
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, severity: 'high', message: 'Hardcoded Bearer token detected' },
  { pattern: /(?:SG\.)[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}/g, severity: 'critical', message: 'SendGrid API key detected' },
  { pattern: /(?:sk_live|pk_live|sk_test|pk_test)_[A-Za-z0-9]{20,}/g, severity: 'critical', message: 'Stripe API key detected' },
  { pattern: /(?:eyJ)[A-Za-z0-9_-]{10,}\.(?:eyJ)[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'medium', message: 'JWT token detected — avoid hardcoding tokens' },
];

export class SecurityScanner implements EnhancementStage {
  readonly name = 'security-scanner';
  readonly type = 'armour' as const;

  private readonly checks: readonly SecurityCheckType[];

  constructor(checks: SecurityCheckType[] = ['xss', 'sqli', 'command-injection', 'secrets']) {
    this.checks = checks;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, checks: this.checks },
      'Security scanner executing',
    );

    const findings: SecurityFinding[] = [];
    const lines = input.split('\n');

    for (const checkType of this.checks) {
      const patterns = this.getPatternsForCheck(checkType);

      for (const { pattern, severity, message } of patterns) {
        // Reset regex state
        pattern.lastIndex = 0;

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
          const line = lines[lineNum]!;

          // Skip comments
          if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('*')) {
            continue;
          }

          pattern.lastIndex = 0;
          let match: RegExpExecArray | null;

          while ((match = pattern.exec(line)) !== null) {
            const snippet = line.trim().substring(0, 120);

            findings.push({
              type: checkType,
              severity,
              message,
              line: lineNum + 1,
              pattern: pattern.source.substring(0, 60),
              snippet,
            });

            // Prevent infinite loops for zero-length matches
            if (match[0].length === 0) break;
          }
        }
      }
    }

    // Sort by severity
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    findings.sort((a, b) => (severityOrder[a.severity] ?? 4) - (severityOrder[b.severity] ?? 4));

    const criticalCount = findings.filter((f) => f.severity === 'critical').length;
    const highCount = findings.filter((f) => f.severity === 'high').length;

    logger.info(
      {
        totalFindings: findings.length,
        critical: criticalCount,
        high: highCount,
      },
      'Security scan complete',
    );

    return {
      content: input,
      modified: false,
      details: {
        findings,
        summary: {
          total: findings.length,
          critical: criticalCount,
          high: highCount,
          medium: findings.filter((f) => f.severity === 'medium').length,
          low: findings.filter((f) => f.severity === 'low').length,
        },
        checksPerformed: [...this.checks],
        passed: findings.length === 0,
        requiresReview: criticalCount > 0 || highCount > 0,
      },
    };
  }

  private getPatternsForCheck(
    check: SecurityCheckType,
  ): Array<{ pattern: RegExp; severity: SecurityFinding['severity']; message: string }> {
    switch (check) {
      case 'xss':
        return XSS_PATTERNS.map((p) => ({ ...p, pattern: new RegExp(p.pattern.source, p.pattern.flags) }));
      case 'sqli':
        return SQLI_PATTERNS.map((p) => ({ ...p, pattern: new RegExp(p.pattern.source, p.pattern.flags) }));
      case 'command-injection':
        return CMD_INJECTION_PATTERNS.map((p) => ({ ...p, pattern: new RegExp(p.pattern.source, p.pattern.flags) }));
      case 'secrets':
        return SECRET_PATTERNS.map((p) => ({ ...p, pattern: new RegExp(p.pattern.source, p.pattern.flags) }));
      default:
        return [];
    }
  }
}
