import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('context-compressor');

// Rough approximation: 1 token ~= 4 characters for English text
const CHARS_PER_TOKEN = 4;

export class ContextCompressor implements EnhancementStage {
  readonly name = 'context-compressor';
  readonly type = 'codec' as const;

  private readonly maxTokens: number;

  constructor(maxTokens: number = 100000) {
    this.maxTokens = maxTokens;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    const estimatedTokens = Math.ceil(input.length / CHARS_PER_TOKEN);

    logger.info(
      {
        tenantId: context.tenantId,
        estimatedTokens,
        maxTokens: this.maxTokens,
      },
      'Context compressor executing',
    );

    if (estimatedTokens <= this.maxTokens) {
      return {
        content: input,
        modified: false,
        details: {
          estimatedTokens,
          maxTokens: this.maxTokens,
          compressed: false,
          message: 'Content within token limit',
        },
      };
    }

    // Content exceeds limit — apply compression strategies
    const originalLength = input.length;
    let compressed = input;

    // Strategy 1: Remove redundant whitespace
    compressed = this.removeRedundantWhitespace(compressed);

    // Strategy 2: Compress code blocks (remove excessive comments)
    compressed = this.compressCodeBlocks(compressed);

    // Strategy 3: Deduplicate repeated lines
    compressed = this.deduplicateLines(compressed);

    // Strategy 4: Truncate from the middle if still too long
    const compressedTokens = Math.ceil(compressed.length / CHARS_PER_TOKEN);
    if (compressedTokens > this.maxTokens) {
      compressed = this.truncateMiddle(compressed, this.maxTokens * CHARS_PER_TOKEN);
    }

    const finalTokens = Math.ceil(compressed.length / CHARS_PER_TOKEN);
    const compressionRatio = compressed.length / originalLength;

    logger.info(
      {
        originalTokens: estimatedTokens,
        finalTokens,
        compressionRatio: compressionRatio.toFixed(2),
      },
      'Context compressed',
    );

    return {
      content: compressed,
      modified: true,
      details: {
        originalTokens: estimatedTokens,
        finalTokens,
        maxTokens: this.maxTokens,
        compressed: true,
        compressionRatio,
        strategiesApplied: [
          'redundant-whitespace',
          'code-comment-reduction',
          'line-deduplication',
          compressedTokens > this.maxTokens ? 'middle-truncation' : null,
        ].filter(Boolean),
      },
    };
  }

  private removeRedundantWhitespace(input: string): string {
    // Collapse multiple blank lines into single blank line
    let result = input.replace(/\n{3,}/g, '\n\n');

    // Remove trailing whitespace from lines
    result = result.replace(/[ \t]+$/gm, '');

    // Collapse multiple spaces (but not in code blocks)
    const parts = this.splitByCodeBlocks(result);
    return parts
      .map((part) => {
        if (part.isCode) return part.content;
        return part.content.replace(/  +/g, ' ');
      })
      .map((p) => (typeof p === 'string' ? p : p))
      .join('');
  }

  private compressCodeBlocks(input: string): string {
    const parts = this.splitByCodeBlocks(input);

    return parts
      .map((part) => {
        if (!part.isCode) return part.content;

        let code = part.content;

        // Remove single-line comment-only lines (keep inline comments)
        code = code.replace(/^\s*\/\/.*\n/gm, '');

        // Remove multi-line comments
        code = code.replace(/\/\*[\s\S]*?\*\//g, '');

        // Remove empty lines within code blocks
        code = code.replace(/\n{3,}/g, '\n\n');

        return code;
      })
      .join('');
  }

  private deduplicateLines(input: string): string {
    const lines = input.split('\n');
    const result: string[] = [];
    let consecutiveDups = 0;
    let prevLine = '';

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed === prevLine && trimmed.length > 0) {
        consecutiveDups++;
        if (consecutiveDups <= 1) {
          result.push(line);
        }
        // Skip additional consecutive duplicates
      } else {
        consecutiveDups = 0;
        result.push(line);
      }

      prevLine = trimmed;
    }

    return result.join('\n');
  }

  private truncateMiddle(input: string, maxChars: number): string {
    if (input.length <= maxChars) return input;

    // Keep more of the beginning and end (they tend to have more important context)
    const headRatio = 0.6;
    const tailRatio = 0.4;
    const headChars = Math.floor(maxChars * headRatio);
    const tailChars = Math.floor(maxChars * tailRatio);
    const removedChars = input.length - headChars - tailChars;

    const head = input.substring(0, headChars);
    const tail = input.substring(input.length - tailChars);

    const truncationNotice = `\n\n<!-- [CONTEXT COMPRESSOR] ${removedChars} characters (~${Math.ceil(removedChars / CHARS_PER_TOKEN)} tokens) truncated from middle -->\n\n`;

    return head + truncationNotice + tail;
  }

  private splitByCodeBlocks(input: string): Array<{ content: string; isCode: boolean }> {
    const parts: Array<{ content: string; isCode: boolean }> = [];
    const regex = /(```[\s\S]*?```)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      // Text before code block
      if (match.index > lastIndex) {
        parts.push({ content: input.substring(lastIndex, match.index), isCode: false });
      }
      // Code block
      parts.push({ content: match[1]!, isCode: true });
      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last code block
    if (lastIndex < input.length) {
      parts.push({ content: input.substring(lastIndex), isCode: false });
    }

    return parts;
  }
}
