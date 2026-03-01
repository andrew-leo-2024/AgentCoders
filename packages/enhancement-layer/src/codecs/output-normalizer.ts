import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('output-normalizer');

type OutputFormat = 'markdown' | 'json' | 'code';

export class OutputNormalizer implements EnhancementStage {
  readonly name = 'output-normalizer';
  readonly type = 'codec' as const;

  private readonly format: OutputFormat;

  constructor(format: OutputFormat = 'markdown') {
    this.format = format;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, format: this.format },
      'Output normalizer executing',
    );

    let normalized: string;
    const transformations: string[] = [];

    // Strip model-specific formatting artifacts
    let cleaned = input;

    // Remove ChatGPT-style artifacts
    const gptArtifacts = this.removeGptArtifacts(cleaned);
    if (gptArtifacts.modified) {
      cleaned = gptArtifacts.content;
      transformations.push('removed-gpt-artifacts');
    }

    // Remove Claude-style artifacts
    const claudeArtifacts = this.removeClaudeArtifacts(cleaned);
    if (claudeArtifacts.modified) {
      cleaned = claudeArtifacts.content;
      transformations.push('removed-claude-artifacts');
    }

    // Remove generic LLM artifacts
    const genericArtifacts = this.removeGenericArtifacts(cleaned);
    if (genericArtifacts.modified) {
      cleaned = genericArtifacts.content;
      transformations.push('removed-generic-artifacts');
    }

    // Format-specific normalization
    switch (this.format) {
      case 'markdown':
        normalized = this.normalizeToMarkdown(cleaned);
        transformations.push('normalize-markdown');
        break;
      case 'json':
        normalized = this.normalizeToJson(cleaned);
        transformations.push('normalize-json');
        break;
      case 'code':
        normalized = this.normalizeToCode(cleaned);
        transformations.push('normalize-code');
        break;
      default:
        normalized = cleaned;
        break;
    }

    const wasModified = normalized !== input;

    return {
      content: normalized,
      modified: wasModified,
      details: {
        format: this.format,
        transformations,
        originalLength: input.length,
        normalizedLength: normalized.length,
      },
    };
  }

  private removeGptArtifacts(input: string): { content: string; modified: boolean } {
    let result = input;
    let modified = false;

    // Remove "Sure, " / "Of course, " / "Certainly!" prefixes
    const prefixPattern = /^(?:Sure[,!]?\s*|Of course[,!]?\s*|Certainly[,!]?\s*|Absolutely[,!]?\s*|Great question[,!]?\s*|Here(?:'s| is) (?:the |a |an )?(?:code|solution|implementation|answer|response)[:.!]?\s*\n?)/i;
    if (prefixPattern.test(result)) {
      result = result.replace(prefixPattern, '');
      modified = true;
    }

    // Remove trailing "Let me know if..." / "Feel free to..."
    const suffixPattern = /\n*(?:Let me know if (?:you )?(?:have|need)[\s\S]*?$|Feel free to[\s\S]*?$|Hope (?:this|that) helps[\s\S]*?$|I hope (?:this|that) helps[\s\S]*?$|Is there anything else[\s\S]*?$)/i;
    if (suffixPattern.test(result)) {
      result = result.replace(suffixPattern, '');
      modified = true;
    }

    return { content: result.trim(), modified };
  }

  private removeClaudeArtifacts(input: string): { content: string; modified: boolean } {
    let result = input;
    let modified = false;

    // Remove "I'll " / "I'd be happy to " prefixes
    const prefixPattern = /^(?:I'll\s+|I'd be happy to\s+|I can help (?:you )?with that[.!]?\s*\n?|Let me\s+)/i;
    if (prefixPattern.test(result)) {
      result = result.replace(prefixPattern, '');
      modified = true;
    }

    // Remove thinking/reasoning blocks that may have leaked
    const thinkingPattern = /<thinking>[\s\S]*?<\/thinking>\s*/g;
    if (thinkingPattern.test(result)) {
      result = result.replace(thinkingPattern, '');
      modified = true;
    }

    return { content: result.trim(), modified };
  }

  private removeGenericArtifacts(input: string): { content: string; modified: boolean } {
    let result = input;
    let modified = false;

    // Remove role markers that leaked into output
    const rolePattern = /^(?:Assistant:|AI:|Bot:|Model:)\s*/gm;
    if (rolePattern.test(result)) {
      result = result.replace(rolePattern, '');
      modified = true;
    }

    // Remove repeated disclaimers
    const disclaimerPattern = /\n*(?:Please note that|Disclaimer:|Note:|Important note:|⚠️\s*Note:)\s*(?:this (?:is|code|implementation) (?:is )?(?:a )?(?:simplified|basic|example|demonstration|proof of concept)[\s\S]*?)(?=\n\n|\n```|$)/gi;
    if (disclaimerPattern.test(result)) {
      result = result.replace(disclaimerPattern, '');
      modified = true;
    }

    // Normalize line endings
    if (result.includes('\r\n')) {
      result = result.replace(/\r\n/g, '\n');
      modified = true;
    }

    return { content: result.trim(), modified };
  }

  private normalizeToMarkdown(input: string): string {
    let result = input;

    // Ensure consistent heading format (# style, not underline style)
    result = result.replace(/^(.+)\n={3,}$/gm, '# $1');
    result = result.replace(/^(.+)\n-{3,}$/gm, '## $1');

    // Ensure blank line before headings
    result = result.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');

    // Ensure blank line before code blocks
    result = result.replace(/([^\n])\n```/g, '$1\n\n```');

    // Ensure blank line after code blocks
    result = result.replace(/```\n([^\n])/g, '```\n\n$1');

    // Normalize list markers to dashes
    result = result.replace(/^\s*\*\s/gm, '- ');

    return result;
  }

  private normalizeToJson(input: string): string {
    // Extract JSON from code blocks or raw content
    const jsonMatch = input.match(/```(?:json)?\n([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : input.trim();

    try {
      const parsed = JSON.parse(jsonStr);
      return JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, return as-is
      return input;
    }
  }

  private normalizeToCode(input: string): string {
    // Extract code from markdown code blocks
    const codeBlocks: string[] = [];
    const regex = /```(?:\w*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(input)) !== null) {
      const block = match[1]?.trim();
      if (block) {
        codeBlocks.push(block);
      }
    }

    if (codeBlocks.length === 0) {
      return input;
    }

    // If single code block, return just the code
    if (codeBlocks.length === 1) {
      return codeBlocks[0]!;
    }

    // Multiple code blocks: join with clear separators
    return codeBlocks.join('\n\n// ---\n\n');
  }
}
