import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('schema-enforcer');

export class SchemaEnforcer implements EnhancementStage {
  readonly name = 'schema-enforcer';
  readonly type = 'stabilizer' as const;

  private readonly retryCount: number;

  constructor(retryCount: number = 3) {
    this.retryCount = retryCount;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, retryCount: this.retryCount },
      'Schema enforcement executing',
    );

    // Check if we have an expected schema in context metadata
    const expectedSchema = context.metadata['expectedSchema'] as Record<string, unknown> | undefined;

    if (!expectedSchema) {
      // No schema specified — try to validate any JSON in the output
      const jsonBlocks = this.extractJsonBlocks(input);
      if (jsonBlocks.length === 0) {
        return {
          content: input,
          modified: false,
          details: {
            message: 'No expected schema and no JSON blocks found — passthrough',
          },
        };
      }

      // Validate that extracted JSON is well-formed
      const validationResults = jsonBlocks.map((block, i) => ({
        blockIndex: i,
        ...this.validateJson(block),
      }));

      const hasInvalid = validationResults.some((r) => !r.valid);

      if (hasInvalid) {
        // Attempt to fix common JSON issues
        let fixedContent = input;
        let wasFixed = false;

        for (const result of validationResults) {
          if (!result.valid && result.fixedJson) {
            fixedContent = fixedContent.replace(jsonBlocks[result.blockIndex]!, result.fixedJson);
            wasFixed = true;
          }
        }

        return {
          content: fixedContent,
          modified: wasFixed,
          details: {
            jsonBlocksFound: jsonBlocks.length,
            validationResults: validationResults.map((r) => ({
              blockIndex: r.blockIndex,
              valid: r.valid,
              error: r.error,
              fixed: !!r.fixedJson,
            })),
          },
        };
      }

      return {
        content: input,
        modified: false,
        details: {
          jsonBlocksFound: jsonBlocks.length,
          allValid: true,
        },
      };
    }

    // Schema-based validation
    const jsonBlocks = this.extractJsonBlocks(input);
    const results = jsonBlocks.map((block, i) => {
      const validation = this.validateAgainstSchema(block, expectedSchema);
      return { blockIndex: i, ...validation };
    });

    const allValid = results.every((r) => r.valid);

    return {
      content: input,
      modified: false,
      details: {
        hasExpectedSchema: true,
        jsonBlocksFound: jsonBlocks.length,
        validationResults: results,
        allValid,
        retryRecommended: !allValid,
        retriesRemaining: !allValid ? this.retryCount : 0,
      },
    };
  }

  private extractJsonBlocks(input: string): string[] {
    const blocks: string[] = [];

    // Extract from markdown code blocks
    const codeBlockRegex = /```(?:json)?\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = codeBlockRegex.exec(input)) !== null) {
      const block = match[1]?.trim();
      if (block && (block.startsWith('{') || block.startsWith('['))) {
        blocks.push(block);
      }
    }

    // If no code blocks, try to find inline JSON
    if (blocks.length === 0) {
      const inlineJsonRegex = /(?:^|\n)\s*(\{[\s\S]*?\})\s*(?:\n|$)/g;
      while ((match = inlineJsonRegex.exec(input)) !== null) {
        const block = match[1]?.trim();
        if (block) {
          blocks.push(block);
        }
      }
    }

    return blocks;
  }

  private validateJson(jsonStr: string): { valid: boolean; error?: string; fixedJson?: string } {
    try {
      JSON.parse(jsonStr);
      return { valid: true };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Try common fixes
      const fixed = this.attemptJsonFix(jsonStr);
      if (fixed) {
        return { valid: false, error: errorMsg, fixedJson: fixed };
      }

      return { valid: false, error: errorMsg };
    }
  }

  private attemptJsonFix(jsonStr: string): string | null {
    let attempt = jsonStr;

    // Fix 1: Remove trailing commas before } or ]
    attempt = attempt.replace(/,\s*([}\]])/g, '$1');

    // Fix 2: Add missing quotes around unquoted keys
    attempt = attempt.replace(/(?<=\{|,)\s*(\w+)\s*:/g, '"$1":');

    // Fix 3: Replace single quotes with double quotes (outside of values)
    attempt = attempt.replace(/'/g, '"');

    // Fix 4: Remove comments
    attempt = attempt.replace(/\/\/.*$/gm, '');
    attempt = attempt.replace(/\/\*[\s\S]*?\*\//g, '');

    try {
      JSON.parse(attempt);
      return attempt;
    } catch {
      return null;
    }
  }

  private validateAgainstSchema(
    jsonStr: string,
    schema: Record<string, unknown>,
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { valid: false, errors: ['Invalid JSON'] };
    }

    // Simple type/key validation against schema
    if (typeof schema === 'object' && schema !== null) {
      const schemaType = schema['type'] as string | undefined;

      if (schemaType === 'object' && typeof parsed !== 'object') {
        errors.push(`Expected object, got ${typeof parsed}`);
      }
      if (schemaType === 'array' && !Array.isArray(parsed)) {
        errors.push(`Expected array, got ${typeof parsed}`);
      }

      // Check required fields
      const required = schema['required'] as string[] | undefined;
      if (required && typeof parsed === 'object' && parsed !== null) {
        for (const field of required) {
          if (!(field in (parsed as Record<string, unknown>))) {
            errors.push(`Missing required field: ${field}`);
          }
        }
      }

      // Check property types
      const properties = schema['properties'] as Record<string, { type?: string }> | undefined;
      if (properties && typeof parsed === 'object' && parsed !== null) {
        const obj = parsed as Record<string, unknown>;
        for (const [key, propSchema] of Object.entries(properties)) {
          if (key in obj && propSchema.type) {
            const actualType = Array.isArray(obj[key]) ? 'array' : typeof obj[key];
            if (actualType !== propSchema.type) {
              errors.push(`Field "${key}" expected type "${propSchema.type}", got "${actualType}"`);
            }
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
