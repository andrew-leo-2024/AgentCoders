import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('code-formatter');

export class CodeFormatter implements EnhancementStage {
  readonly name = 'code-formatter';
  readonly type = 'codec' as const;

  private readonly usePrettier: boolean;
  private readonly useEslint: boolean;

  constructor(usePrettier: boolean = true, useEslint: boolean = false) {
    this.usePrettier = usePrettier;
    this.useEslint = useEslint;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, prettier: this.usePrettier, eslint: this.useEslint },
      'Code formatter executing',
    );

    const codeBlockRegex = /(```(\w*)\n)([\s\S]*?)(```)/g;
    let formattedOutput = input;
    let blocksFormatted = 0;
    const formattingDetails: Array<{ language: string; changes: string[] }> = [];

    // Replace each code block with its formatted version
    formattedOutput = input.replace(codeBlockRegex, (_match, openFence: string, lang: string, code: string, closeFence: string) => {
      const language = lang || 'unknown';
      const changes: string[] = [];

      let formatted = code;

      if (this.usePrettier) {
        const prettierResult = this.applyPrettierFormatting(formatted, language);
        if (prettierResult.modified) {
          formatted = prettierResult.content;
          changes.push(...prettierResult.changes);
        }
      }

      if (this.useEslint) {
        const eslintResult = this.applyEslintFixes(formatted, language);
        if (eslintResult.modified) {
          formatted = eslintResult.content;
          changes.push(...eslintResult.changes);
        }
      }

      if (changes.length > 0) {
        blocksFormatted++;
        formattingDetails.push({ language, changes });
      }

      return `${openFence}${formatted}${closeFence}`;
    });

    const wasModified = blocksFormatted > 0;

    return {
      content: formattedOutput,
      modified: wasModified,
      details: {
        blocksFormatted,
        prettier: this.usePrettier,
        eslint: this.useEslint,
        formattingDetails,
      },
    };
  }

  private applyPrettierFormatting(
    code: string,
    language: string,
  ): { content: string; modified: boolean; changes: string[] } {
    const changes: string[] = [];
    let result = code;

    const jsLangs = ['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'];
    const jsonLangs = ['json', 'jsonc'];

    if ([...jsLangs, ...jsonLangs, 'css', 'scss', 'html', 'yaml', 'yml'].includes(language)) {
      // Normalize indentation to 2 spaces
      const indentResult = this.normalizeIndentation(result, 2);
      if (indentResult.modified) {
        result = indentResult.content;
        changes.push('normalized-indentation-to-2-spaces');
      }

      // Ensure consistent semicolons (for JS/TS)
      if (jsLangs.includes(language)) {
        const semiResult = this.ensureTrailingSemicolons(result);
        if (semiResult.modified) {
          result = semiResult.content;
          changes.push('added-trailing-semicolons');
        }

        // Ensure consistent single quotes
        const quoteResult = this.normalizeSingleQuotes(result);
        if (quoteResult.modified) {
          result = quoteResult.content;
          changes.push('normalized-to-single-quotes');
        }
      }

      // Remove trailing whitespace
      const trimResult = this.removeTrailingWhitespace(result);
      if (trimResult.modified) {
        result = trimResult.content;
        changes.push('removed-trailing-whitespace');
      }

      // Ensure final newline
      if (!result.endsWith('\n')) {
        result += '\n';
        changes.push('added-final-newline');
      }

      // Normalize multiple blank lines
      const blankResult = this.normalizeBlankLines(result);
      if (blankResult.modified) {
        result = blankResult.content;
        changes.push('normalized-blank-lines');
      }
    }

    return { content: result, modified: changes.length > 0, changes };
  }

  private applyEslintFixes(
    code: string,
    language: string,
  ): { content: string; modified: boolean; changes: string[] } {
    const changes: string[] = [];
    let result = code;

    const jsLangs = ['javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx'];
    if (!jsLangs.includes(language)) {
      return { content: result, modified: false, changes };
    }

    // Prefer const over let when no reassignment
    const constResult = this.preferConst(result);
    if (constResult.modified) {
      result = constResult.content;
      changes.push('prefer-const');
    }

    // Remove unused variables (simple detection)
    // This is intentionally conservative to avoid false positives

    return { content: result, modified: changes.length > 0, changes };
  }

  private normalizeIndentation(
    code: string,
    spaces: number,
  ): { content: string; modified: boolean } {
    const lines = code.split('\n');
    let modified = false;
    const tabSize = spaces;

    const normalized = lines.map((line) => {
      // Replace tabs with spaces
      if (line.includes('\t')) {
        modified = true;
        return line.replace(/\t/g, ' '.repeat(tabSize));
      }

      // Detect 4-space indentation and convert to 2-space
      if (spaces === 2) {
        const match = line.match(/^( +)/);
        if (match) {
          const currentSpaces = match[1]!.length;
          if (currentSpaces % 4 === 0 && currentSpaces >= 4) {
            const newIndent = ' '.repeat((currentSpaces / 4) * 2);
            modified = true;
            return newIndent + line.trimStart();
          }
        }
      }

      return line;
    });

    return { content: normalized.join('\n'), modified };
  }

  private ensureTrailingSemicolons(code: string): { content: string; modified: boolean } {
    const lines = code.split('\n');
    let modified = false;

    // Patterns that should end with semicolons
    const needsSemicolon = /^(?:\s*(?:const|let|var|return|throw|import|export\s+(?:const|let|var|type|interface|default)|type|interface)\s|.*(?:=\s*(?:[^{]|{[^}]*})\s*)$)/;
    const skipPatterns = [
      /^\s*\/\//, // comments
      /^\s*\*/, // block comment lines
      /^\s*$/, // empty lines
      /[{(,]\s*$/, // lines ending with opening braces/parens/commas
      /^\s*[}\])]/,  // lines starting with closing braces
      /^\s*(?:if|else|for|while|switch|try|catch|finally|class|function|async)\b/, // control flow
      /=>\s*\{?\s*$/, // arrow functions
      /;\s*$/, // already has semicolon
      /^\s*import\s.*\bfrom\b/, // imports (handled separately)
    ];

    const result = lines.map((line) => {
      if (skipPatterns.some((p) => p.test(line))) return line;

      const trimmed = line.trimEnd();
      if (trimmed.length === 0) return line;

      // Simple heuristic: if line looks like a statement and doesn't end with ; or { or , or (
      if (needsSemicolon.test(trimmed) && !/[;{(,]\s*$/.test(trimmed)) {
        modified = true;
        return trimmed + ';';
      }

      return line;
    });

    return { content: result.join('\n'), modified };
  }

  private normalizeSingleQuotes(code: string): { content: string; modified: boolean } {
    // Convert double-quoted strings to single-quoted (but not template literals or JSX)
    // Be careful with strings containing single quotes
    let modified = false;

    const result = code.replace(
      /"([^"\\]*(?:\\.[^"\\]*)*)"/g,
      (_match, content: string) => {
        // Don't convert if it contains single quotes (would need escaping)
        if (content.includes("'")) return _match;
        // Don't convert JSX attributes
        if (/=\s*$/.test(code.substring(0, code.indexOf(_match)))) return _match;
        modified = true;
        return `'${content}'`;
      },
    );

    return { content: result, modified };
  }

  private removeTrailingWhitespace(code: string): { content: string; modified: boolean } {
    const original = code;
    const result = code.replace(/[ \t]+$/gm, '');
    return { content: result, modified: result !== original };
  }

  private normalizeBlankLines(code: string): { content: string; modified: boolean } {
    const original = code;
    const result = code.replace(/\n{3,}/g, '\n\n');
    return { content: result, modified: result !== original };
  }

  private preferConst(code: string): { content: string; modified: boolean } {
    // Simple heuristic: find `let x = ...` where x is never reassigned
    const lines = code.split('\n');
    const letDeclarations: Array<{ line: number; varName: string }> = [];

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i]!.match(/^\s*let\s+(\w+)\s*=/);
      if (match) {
        letDeclarations.push({ line: i, varName: match[1]! });
      }
    }

    let modified = false;
    const result = [...lines];

    for (const decl of letDeclarations) {
      // Check if variable is reassigned anywhere else
      const reassignPattern = new RegExp(`\\b${decl.varName}\\s*(?:=(?!=)|\\+\\+|--|\\+=|-=|\\*=|\\/=)`, 'g');
      let reassigned = false;

      for (let i = 0; i < lines.length; i++) {
        if (i === decl.line) continue;
        if (reassignPattern.test(lines[i]!)) {
          reassigned = true;
          break;
        }
        reassignPattern.lastIndex = 0;
      }

      if (!reassigned) {
        result[decl.line] = result[decl.line]!.replace(/\blet\b/, 'const');
        modified = true;
      }
    }

    return { content: result.join('\n'), modified };
  }
}
