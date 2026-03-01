import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('deterministic-validator');

interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  line?: number;
  rule: string;
}

export class DeterministicValidator implements EnhancementStage {
  readonly name = 'deterministic-validator';
  readonly type = 'stabilizer' as const;

  private readonly parseAst: boolean;
  private readonly checkImports: boolean;

  constructor(parseAst: boolean = false, checkImports: boolean = true) {
    this.parseAst = parseAst;
    this.checkImports = checkImports;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, parseAst: this.parseAst, checkImports: this.checkImports },
      'Deterministic validation executing',
    );

    const codeBlocks = this.extractCodeBlocks(input);

    if (codeBlocks.length === 0) {
      return {
        content: input,
        modified: false,
        details: {
          message: 'No code blocks found to validate',
          issues: [],
        },
      };
    }

    const allIssues: ValidationIssue[] = [];

    for (const block of codeBlocks) {
      const issues = this.validateCode(block.code, block.language);
      allIssues.push(...issues);
    }

    const errors = allIssues.filter((i) => i.severity === 'error');
    const warnings = allIssues.filter((i) => i.severity === 'warning');

    // Add validation annotations if issues found
    let outputContent = input;
    let modified = false;

    if (errors.length > 0) {
      const errorAnnotations = errors
        .map((e) => `- [ERROR] ${e.rule}: ${e.message}${e.line ? ` (line ~${e.line})` : ''}`)
        .join('\n');

      outputContent = `${input}\n\n<validation-errors>\n${errorAnnotations}\n</validation-errors>`;
      modified = true;
    }

    logger.info(
      { errors: errors.length, warnings: warnings.length, codeBlocks: codeBlocks.length },
      'Validation complete',
    );

    return {
      content: outputContent,
      modified,
      details: {
        codeBlocksValidated: codeBlocks.length,
        errors: errors.length,
        warnings: warnings.length,
        issues: allIssues,
        valid: errors.length === 0,
      },
    };
  }

  private extractCodeBlocks(input: string): Array<{ code: string; language: string }> {
    const blocks: Array<{ code: string; language: string }> = [];
    const regex = /```(\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      const lang = match[1] ?? '';
      const code = match[2] ?? '';
      if (code.trim().length > 0) {
        blocks.push({
          code: code,
          language: lang || this.detectLanguage(code),
        });
      }
    }

    return blocks;
  }

  private detectLanguage(code: string): string {
    if (/import\s.*from\s|export\s|interface\s|type\s.*=/.test(code)) return 'typescript';
    if (/function\s|const\s|let\s|var\s|=>\s*\{/.test(code)) return 'javascript';
    if (/^def\s|^class\s|import\s\w+$/m.test(code)) return 'python';
    if (/^package\s|func\s|:=/.test(code)) return 'go';
    return 'unknown';
  }

  private validateCode(code: string, language: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const lines = code.split('\n');

    // Universal checks
    issues.push(...this.checkBracketBalance(code));
    issues.push(...this.checkStringLiterals(code, lines));

    // Language-specific checks
    if (language === 'typescript' || language === 'javascript') {
      issues.push(...this.validateJsTs(code, lines, language === 'typescript'));
    } else if (language === 'python') {
      issues.push(...this.validatePython(code, lines));
    }

    return issues;
  }

  private checkBracketBalance(code: string): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    const pairs: Array<[string, string, string]> = [
      ['{', '}', 'braces'],
      ['(', ')', 'parentheses'],
      ['[', ']', 'brackets'],
    ];

    for (const [open, close, name] of pairs) {
      // Simplified: count outside of strings/comments
      const stripped = this.stripStringsAndComments(code);
      const opens = (stripped.match(new RegExp(`\\${open}`, 'g')) ?? []).length;
      const closes = (stripped.match(new RegExp(`\\${close}`, 'g')) ?? []).length;

      if (opens !== closes) {
        issues.push({
          severity: 'error',
          message: `Unbalanced ${name}: ${opens} opening '${open}' vs ${closes} closing '${close}'`,
          rule: 'bracket-balance',
        });
      }
    }

    return issues;
  }

  private stripStringsAndComments(code: string): string {
    // Remove single-line comments
    let result = code.replace(/\/\/.*$/gm, '');
    // Remove multi-line comments
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');
    // Remove strings (simplified)
    result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');
    result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
    result = result.replace(/`(?:[^`\\]|\\.)*`/g, '``');
    return result;
  }

  private checkStringLiterals(code: string, lines: string[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Skip comment lines
      if (line.trim().startsWith('//') || line.trim().startsWith('#') || line.trim().startsWith('*')) {
        continue;
      }

      // Check for unmatched quotes on a single line (simplified heuristic)
      const singleQuotes = (line.match(/(?<!\\)'/g) ?? []).length;
      const doubleQuotes = (line.match(/(?<!\\)"/g) ?? []).length;

      // Template literals span lines, so skip backtick checks
      if (singleQuotes % 2 !== 0 && !line.includes('`')) {
        // Could be a legitimate multi-line string, log as warning
        issues.push({
          severity: 'warning',
          message: 'Potentially unmatched single quote',
          line: i + 1,
          rule: 'string-literal',
        });
      }
      if (doubleQuotes % 2 !== 0 && !line.includes('`')) {
        issues.push({
          severity: 'warning',
          message: 'Potentially unmatched double quote',
          line: i + 1,
          rule: 'string-literal',
        });
      }
    }

    return issues;
  }

  private validateJsTs(code: string, lines: string[], isTypeScript: boolean): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    // Check imports
    if (this.checkImports) {
      const importLines = lines
        .map((line, i) => ({ line: line.trim(), num: i + 1 }))
        .filter((l) => l.line.startsWith('import '));

      for (const imp of importLines) {
        // ESM: local imports should use .js extension
        const localImportMatch = imp.line.match(/from\s+['"](\.[^'"]+)['"]/);
        if (localImportMatch) {
          const importPath = localImportMatch[1]!;
          if (!importPath.endsWith('.js') && !importPath.endsWith('.json')) {
            issues.push({
              severity: 'warning',
              message: `Local import "${importPath}" missing .js extension (required for ESM)`,
              line: imp.num,
              rule: 'esm-import-extension',
            });
          }
        }

        // Check for CommonJS in ESM context
        if (/require\s*\(/.test(imp.line)) {
          issues.push({
            severity: 'error',
            message: 'require() used in ESM module — use import instead',
            line: imp.num,
            rule: 'no-require',
          });
        }
      }
    }

    // TypeScript-specific
    if (isTypeScript) {
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;

        if (/\bas\s+any\b/.test(line) && !line.trim().startsWith('//')) {
          issues.push({
            severity: 'warning',
            message: "'as any' cast — use proper type narrowing",
            line: i + 1,
            rule: 'no-any-cast',
          });
        }

        if (/@ts-ignore/.test(line)) {
          issues.push({
            severity: 'warning',
            message: '@ts-ignore found — use @ts-expect-error with description',
            line: i + 1,
            rule: 'no-ts-ignore',
          });
        }

        if (/:\s*any\b/.test(line) && !line.trim().startsWith('//')) {
          issues.push({
            severity: 'warning',
            message: 'Explicit any type annotation',
            line: i + 1,
            rule: 'no-explicit-any',
          });
        }
      }
    }

    // Check for var usage
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!.trim();
      if (/^var\s/.test(line) && !line.startsWith('//')) {
        issues.push({
          severity: 'warning',
          message: "'var' declaration — use 'const' or 'let'",
          line: i + 1,
          rule: 'no-var',
        });
      }
    }

    // Check for debugger statements
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*debugger\s*;?\s*$/.test(lines[i]!)) {
        issues.push({
          severity: 'error',
          message: 'debugger statement found',
          line: i + 1,
          rule: 'no-debugger',
        });
      }
    }

    return issues;
  }

  private validatePython(code: string, lines: string[]): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;

      // Check for bare except
      if (/^\s*except\s*:/.test(line)) {
        issues.push({
          severity: 'warning',
          message: 'Bare except clause — specify exception type',
          line: i + 1,
          rule: 'no-bare-except',
        });
      }

      // Check for mutable default arguments
      if (/def\s+\w+\([^)]*=\s*(\[\]|\{\}|set\(\))/.test(line)) {
        issues.push({
          severity: 'error',
          message: 'Mutable default argument — use None and initialize in function body',
          line: i + 1,
          rule: 'no-mutable-default',
        });
      }

      // Check for print statements in production code
      if (/^\s*print\s*\(/.test(line) && !line.trim().startsWith('#')) {
        issues.push({
          severity: 'warning',
          message: 'print() statement — use logging module instead',
          line: i + 1,
          rule: 'no-print',
        });
      }
    }

    return issues;
  }
}
