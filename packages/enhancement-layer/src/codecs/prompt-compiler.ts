import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('prompt-compiler');

type TargetModel = 'claude' | 'gpt' | 'gemini' | 'llama' | 'generic';

export class PromptCompiler implements EnhancementStage {
  readonly name = 'prompt-compiler';
  readonly type = 'codec' as const;

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    const targetModel = this.resolveTargetModel(context);

    logger.info(
      { tenantId: context.tenantId, targetModel },
      'Prompt compiler executing',
    );

    let compiled: string;
    let formatApplied: string;

    switch (targetModel) {
      case 'claude':
        compiled = this.compileForClaude(input);
        formatApplied = 'xml-tags';
        break;
      case 'gpt':
        compiled = this.compileForGpt(input);
        formatApplied = 'json-structured';
        break;
      case 'gemini':
        compiled = this.compileForGemini(input);
        formatApplied = 'markdown-sections';
        break;
      case 'llama':
        compiled = this.compileForLlama(input);
        formatApplied = 'instruction-format';
        break;
      default:
        compiled = this.compileGeneric(input);
        formatApplied = 'generic';
        break;
    }

    const wasModified = compiled !== input;

    return {
      content: compiled,
      modified: wasModified,
      details: {
        targetModel,
        formatApplied,
        originalLength: input.length,
        compiledLength: compiled.length,
        compressionRatio: compiled.length / Math.max(input.length, 1),
      },
    };
  }

  private resolveTargetModel(context: StageContext): TargetModel {
    const modelHint = context.metadata['targetModel'] as string | undefined;
    if (!modelHint) return 'claude'; // Default for AgentCoders

    const lower = modelHint.toLowerCase();
    if (lower.includes('claude')) return 'claude';
    if (lower.includes('gpt') || lower.includes('openai')) return 'gpt';
    if (lower.includes('gemini') || lower.includes('google')) return 'gemini';
    if (lower.includes('llama') || lower.includes('meta')) return 'llama';
    return 'generic';
  }

  private compileForClaude(input: string): string {
    // Claude responds best to XML-tagged structured prompts
    const sections = this.parsePromptSections(input);

    if (sections.length <= 1) {
      // Simple prompt, no restructuring needed
      return input;
    }

    const xmlParts: string[] = [];

    for (const section of sections) {
      const tagName = this.toXmlTag(section.heading);
      xmlParts.push(`<${tagName}>\n${section.content.trim()}\n</${tagName}>`);
    }

    return xmlParts.join('\n\n');
  }

  private compileForGpt(input: string): string {
    // GPT models respond well to JSON-structured messages
    const sections = this.parsePromptSections(input);

    if (sections.length <= 1) return input;

    const structured = sections.map((section) => ({
      role: this.inferRole(section.heading),
      content: section.content.trim(),
    }));

    // Return as formatted JSON instruction
    return JSON.stringify({ messages: structured }, null, 2);
  }

  private compileForGemini(input: string): string {
    // Gemini works well with clear markdown sections
    const sections = this.parsePromptSections(input);

    if (sections.length <= 1) return input;

    return sections
      .map((section) => `## ${section.heading}\n\n${section.content.trim()}`)
      .join('\n\n---\n\n');
  }

  private compileForLlama(input: string): string {
    // Llama models use [INST] tags
    const sections = this.parsePromptSections(input);

    if (sections.length <= 1) {
      return `[INST] ${input.trim()} [/INST]`;
    }

    const systemParts: string[] = [];
    const userParts: string[] = [];

    for (const section of sections) {
      const role = this.inferRole(section.heading);
      if (role === 'system') {
        systemParts.push(section.content.trim());
      } else {
        userParts.push(section.content.trim());
      }
    }

    const parts: string[] = [];
    if (systemParts.length > 0) {
      parts.push(`<<SYS>>\n${systemParts.join('\n\n')}\n<</SYS>>`);
    }
    parts.push(`[INST] ${userParts.join('\n\n')} [/INST]`);

    return parts.join('\n\n');
  }

  private compileGeneric(input: string): string {
    // Generic: just ensure clear section separation
    return input;
  }

  private parsePromptSections(input: string): Array<{ heading: string; content: string }> {
    const sections: Array<{ heading: string; content: string }> = [];

    // Try XML tags first
    const xmlPattern = /<(\w[\w-]*)>\s*([\s\S]*?)\s*<\/\1>/g;
    let match: RegExpExecArray | null;
    const xmlMatches: Array<{ heading: string; content: string }> = [];

    while ((match = xmlPattern.exec(input)) !== null) {
      xmlMatches.push({ heading: match[1]!, content: match[2]! });
    }

    if (xmlMatches.length > 0) return xmlMatches;

    // Try markdown headings
    const lines = input.split('\n');
    let currentHeading = 'main';
    let currentContent: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^#{1,3}\s+(.+)$/);
      if (headingMatch) {
        if (currentContent.length > 0) {
          sections.push({ heading: currentHeading, content: currentContent.join('\n') });
        }
        currentHeading = headingMatch[1]!;
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    if (currentContent.length > 0) {
      sections.push({ heading: currentHeading, content: currentContent.join('\n') });
    }

    return sections.length > 0 ? sections : [{ heading: 'main', content: input }];
  }

  private toXmlTag(heading: string): string {
    return heading
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      || 'section';
  }

  private inferRole(heading: string): string {
    const lower = heading.toLowerCase();
    if (/system|instruction|context|background|role/.test(lower)) return 'system';
    if (/assistant|response|output|answer/.test(lower)) return 'assistant';
    return 'user';
  }
}
