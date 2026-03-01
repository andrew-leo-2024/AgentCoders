import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('pii-detector');

interface PiiMatch {
  type: PiiType;
  value: string;
  redactedValue: string;
  line: number;
  column: number;
}

type PiiType = 'email' | 'phone' | 'ssn' | 'credit-card' | 'ip-address' | 'date-of-birth' | 'passport';

interface PiiPattern {
  type: PiiType;
  pattern: RegExp;
  validate?: (match: string) => boolean;
  redact: (match: string) => string;
}

const PII_PATTERNS: PiiPattern[] = [
  // Email addresses
  {
    type: 'email',
    pattern: /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
    validate: (match) => {
      // Reject obvious code patterns
      const codePatterns = ['example.com', 'test.com', 'localhost', 'noreply', 'no-reply'];
      return !codePatterns.some((p) => match.toLowerCase().includes(p));
    },
    redact: (match) => {
      const [local, domain] = match.split('@');
      if (!local || !domain) return '[EMAIL REDACTED]';
      return `${local[0]}${'*'.repeat(Math.max(local.length - 2, 1))}${local[local.length - 1]}@${domain}`;
    },
  },

  // US phone numbers (various formats)
  {
    type: 'phone',
    pattern: /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    validate: (match) => {
      // Must have at least 10 digits
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 11;
    },
    redact: (_match) => {
      const digits = _match.replace(/\D/g, '');
      return `***-***-${digits.slice(-4)}`;
    },
  },

  // International phone numbers
  {
    type: 'phone',
    pattern: /\+\d{1,3}[-.\s]?\d{1,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g,
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      return digits.length >= 10 && digits.length <= 15;
    },
    redact: (match) => {
      const digits = match.replace(/\D/g, '');
      return `+${digits.slice(0, 2)}*****${digits.slice(-3)}`;
    },
  },

  // US Social Security Numbers
  {
    type: 'ssn',
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length !== 9) return false;
      // SSNs cannot start with 000, 666, or 9xx
      const area = parseInt(digits.substring(0, 3), 10);
      if (area === 0 || area === 666 || area >= 900) return false;
      // Group number cannot be 00
      const group = parseInt(digits.substring(3, 5), 10);
      if (group === 0) return false;
      // Serial number cannot be 0000
      const serial = parseInt(digits.substring(5, 9), 10);
      if (serial === 0) return false;
      return true;
    },
    redact: (_match) => '***-**-****',
  },

  // Credit card numbers (Visa, Mastercard, Amex, Discover)
  {
    type: 'credit-card',
    pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{1,4}\b/g,
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.length < 13 || digits.length > 19) return false;
      // Luhn algorithm
      return luhnCheck(digits);
    },
    redact: (match) => {
      const digits = match.replace(/\D/g, '');
      return `****-****-****-${digits.slice(-4)}`;
    },
  },

  // IPv4 addresses (can contain PII in logs)
  {
    type: 'ip-address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    validate: (match) => {
      // Exclude common non-PII IPs
      const nonPii = ['127.0.0.1', '0.0.0.0', '255.255.255.255', '192.168.', '10.0.', '172.16.'];
      return !nonPii.some((p) => match.startsWith(p));
    },
    redact: (match) => {
      const parts = match.split('.');
      return `${parts[0]}.${parts[1]}.***.***`;
    },
  },

  // Date of birth patterns (MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  {
    type: 'date-of-birth',
    pattern: /\b(?:(?:date\s*(?:of\s*)?birth|dob|born|birthday)\s*[:=]?\s*)(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4})\b/gi,
    validate: () => true,
    redact: () => '[DOB REDACTED]',
  },

  // Passport numbers (simplified — common formats)
  {
    type: 'passport',
    pattern: /\b(?:passport\s*(?:no|number|#)?\s*[:=]?\s*)([A-Z]{1,2}\d{6,9})\b/gi,
    validate: () => true,
    redact: () => '[PASSPORT REDACTED]',
  },
];

function luhnCheck(num: string): boolean {
  let sum = 0;
  let alternate = false;

  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i]!, 10);

    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }

    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

export class PiiDetector implements EnhancementStage {
  readonly name = 'pii-detector';
  readonly type = 'armour' as const;

  private readonly redact: boolean;

  constructor(redact: boolean = false) {
    this.redact = redact;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, redact: this.redact },
      'PII detector executing',
    );

    const matches: PiiMatch[] = [];
    const lines = input.split('\n');

    for (const piiPattern of PII_PATTERNS) {
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum]!;

        // Skip comment lines
        if (line.trim().startsWith('//') || line.trim().startsWith('#')) continue;

        // Reset regex
        piiPattern.pattern.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = piiPattern.pattern.exec(line)) !== null) {
          const value = match[1] ?? match[0];

          // Run validator if present
          if (piiPattern.validate && !piiPattern.validate(value)) continue;

          const redactedValue = piiPattern.redact(value);

          matches.push({
            type: piiPattern.type,
            value,
            redactedValue,
            line: lineNum + 1,
            column: match.index + 1,
          });

          // Prevent infinite loops
          if (match[0].length === 0) break;
        }
      }
    }

    // Group by type for summary
    const summary: Record<string, number> = {};
    for (const m of matches) {
      summary[m.type] = (summary[m.type] ?? 0) + 1;
    }

    if (matches.length === 0) {
      return {
        content: input,
        modified: false,
        details: {
          piiFound: false,
          matchCount: 0,
          summary: {},
          message: 'No PII detected',
        },
      };
    }

    // Optionally redact PII
    let outputContent = input;
    if (this.redact) {
      outputContent = this.redactContent(input, matches);
    }

    logger.warn(
      { matchCount: matches.length, types: Object.keys(summary) },
      'PII detected in content',
    );

    return {
      content: outputContent,
      modified: this.redact && matches.length > 0,
      details: {
        piiFound: true,
        matchCount: matches.length,
        summary,
        redacted: this.redact,
        findings: matches.map((m) => ({
          type: m.type,
          line: m.line,
          column: m.column,
          redactedValue: m.redactedValue,
          // Never include the actual PII value in details
        })),
      },
    };
  }

  private redactContent(input: string, matches: PiiMatch[]): string {
    const lines = input.split('\n');

    // Process matches in reverse order (by line and column) to preserve positions
    const sortedMatches = [...matches].sort((a, b) => {
      if (a.line !== b.line) return b.line - a.line;
      return b.column - a.column;
    });

    for (const match of sortedMatches) {
      const lineIndex = match.line - 1;
      if (lineIndex >= 0 && lineIndex < lines.length) {
        lines[lineIndex] = lines[lineIndex]!.replace(match.value, match.redactedValue);
      }
    }

    return lines.join('\n');
  }
}
