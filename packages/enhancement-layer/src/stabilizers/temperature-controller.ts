import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('temperature-controller');

interface TemperatureProfile {
  temperature: number;
  topP: number;
  reasoning: string;
}

const TASK_TEMPERATURE_MAP: Record<string, TemperatureProfile> = {
  // Deterministic tasks — low temperature
  'code-generation': { temperature: 0.2, topP: 0.9, reasoning: 'Code generation requires precision and consistency' },
  'bug-fix': { temperature: 0.1, topP: 0.85, reasoning: 'Bug fixes must be deterministic and targeted' },
  'refactoring': { temperature: 0.15, topP: 0.9, reasoning: 'Refactoring needs consistent structural changes' },
  'test-writing': { temperature: 0.2, topP: 0.9, reasoning: 'Tests require precise assertions and setup' },
  'type-definition': { temperature: 0.1, topP: 0.85, reasoning: 'Type definitions must be exact' },
  'migration': { temperature: 0.1, topP: 0.8, reasoning: 'Migrations must be precise and reversible' },

  // Semi-creative tasks — medium temperature
  'api-design': { temperature: 0.4, topP: 0.92, reasoning: 'API design benefits from some creative thinking' },
  'architecture': { temperature: 0.5, topP: 0.95, reasoning: 'Architecture decisions benefit from exploring alternatives' },
  'documentation': { temperature: 0.4, topP: 0.92, reasoning: 'Documentation should be clear but not repetitive' },
  'code-review': { temperature: 0.3, topP: 0.9, reasoning: 'Code review needs analytical precision with some creativity for suggestions' },

  // Creative tasks — higher temperature
  'brainstorming': { temperature: 0.8, topP: 0.98, reasoning: 'Brainstorming benefits from diverse ideas' },
  'naming': { temperature: 0.7, topP: 0.95, reasoning: 'Naming conventions benefit from creativity' },
  'ux-copy': { temperature: 0.6, topP: 0.95, reasoning: 'UX writing needs natural, varied language' },

  // Default
  'general': { temperature: 0.3, topP: 0.9, reasoning: 'Balanced default for general tasks' },
};

export class TemperatureController implements EnhancementStage {
  readonly name = 'temperature-controller';
  readonly type = 'stabilizer' as const;

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info({ tenantId: context.tenantId }, 'Temperature controller executing');

    // Determine task type from context metadata or by analyzing input
    const explicitTaskType = context.metadata['taskType'] as string | undefined;
    const detectedTaskType = explicitTaskType ?? this.detectTaskType(input);
    const normalizedTaskType = detectedTaskType.toLowerCase().replace(/\s+/g, '-');

    const profile = TASK_TEMPERATURE_MAP[normalizedTaskType] ?? TASK_TEMPERATURE_MAP['general']!;

    // Check if there's an override temperature in context
    const overrideTemp = context.metadata['temperature'] as number | undefined;
    const effectiveProfile = overrideTemp !== undefined
      ? { ...profile, temperature: overrideTemp, reasoning: `Override temperature: ${overrideTemp}` }
      : profile;

    logger.info(
      {
        taskType: normalizedTaskType,
        temperature: effectiveProfile.temperature,
        topP: effectiveProfile.topP,
      },
      'Temperature recommendation set',
    );

    // Store recommendation in context metadata for downstream consumers
    context.metadata['recommendedTemperature'] = effectiveProfile.temperature;
    context.metadata['recommendedTopP'] = effectiveProfile.topP;

    return {
      content: input,
      modified: false,
      details: {
        taskType: normalizedTaskType,
        detected: !explicitTaskType,
        temperature: effectiveProfile.temperature,
        topP: effectiveProfile.topP,
        reasoning: effectiveProfile.reasoning,
        availableTaskTypes: Object.keys(TASK_TEMPERATURE_MAP),
      },
    };
  }

  private detectTaskType(input: string): string {
    const lowerInput = input.toLowerCase();

    // Pattern matching for task type detection
    const patterns: Array<[RegExp, string]> = [
      [/(?:fix|bug|error|issue|broken|crash|fail)/i, 'bug-fix'],
      [/(?:test|spec|describe\(|it\(|expect\(|assert)/i, 'test-writing'],
      [/(?:refactor|clean\s*up|reorganize|restructure)/i, 'refactoring'],
      [/(?:migrate|migration|upgrade|update\s+(?:to|from))/i, 'migration'],
      [/(?:type|interface|typedef|schema|zod|enum)/i, 'type-definition'],
      [/(?:api|endpoint|route|rest|graphql|grpc)/i, 'api-design'],
      [/(?:architect|design|pattern|system\s+design|microservice)/i, 'architecture'],
      [/(?:document|readme|jsdoc|comment|explain)/i, 'documentation'],
      [/(?:review|pr\s+review|code\s+review|feedback)/i, 'code-review'],
      [/(?:brainstorm|idea|suggest|alternative|approach)/i, 'brainstorming'],
      [/(?:name|naming|convention|identifier)/i, 'naming'],
      [/(?:ui|ux|copy|text|label|message|notification)/i, 'ux-copy'],
    ];

    for (const [pattern, taskType] of patterns) {
      if (pattern.test(lowerInput)) {
        return taskType;
      }
    }

    return 'code-generation';
  }
}
