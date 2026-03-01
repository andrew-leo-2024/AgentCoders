import type { ProviderRequest, ProviderResponse, ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import { BaseProvider } from './base.js';
import { getConfig } from '../config.js';
import { CostCalculator } from '../cost-calculator.js';

const logger = createLogger('model-router:openai');

interface OpenAIChatCompletion {
  id: string;
  choices: Array<{
    message: { content: string | null };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider extends BaseProvider {
  readonly provider: ModelProvider = 'openai';
  private apiKey: string;
  private baseUrl: string;
  private costCalculator: CostCalculator;

  constructor(apiKey?: string, baseUrl?: string) {
    super();
    const key = apiKey ?? getConfig().OPENAI_API_KEY;
    if (!key) {
      throw new Error('OPENAI_API_KEY is required for OpenAIProvider. Set it in environment or pass it to the constructor.');
    }
    this.apiKey = key;
    this.baseUrl = baseUrl ?? 'https://api.openai.com/v1';
    this.costCalculator = new CostCalculator();
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const modelId = 'gpt-4o';
    const startMs = Date.now();

    logger.debug({ modelId, maxTokens: request.maxTokens }, 'Sending request to OpenAI');

    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    const body: Record<string, unknown> = {
      model: modelId,
      messages,
      max_tokens: request.maxTokens ?? 4096,
    };

    if (request.temperature !== undefined) {
      body['temperature'] = request.temperature;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as OpenAIChatCompletion;
    const latencyMs = Date.now() - startMs;

    const inputTokens = data.usage.prompt_tokens;
    const outputTokens = data.usage.completion_tokens;
    const costUsd = this.costCalculator.calculate('openai', modelId, inputTokens, outputTokens);

    const content = data.choices[0]?.message.content ?? '';

    let finishReason: ProviderResponse['finishReason'];
    switch (data.choices[0]?.finish_reason) {
      case 'stop':
        finishReason = 'complete';
        break;
      case 'length':
        finishReason = 'max-tokens';
        break;
      default:
        finishReason = 'complete';
    }

    logger.info({ modelId, inputTokens, outputTokens, latencyMs, costUsd }, 'OpenAI response received');

    return {
      content,
      provider: 'openai',
      modelId,
      inputTokens,
      outputTokens,
      latencyMs,
      costUsd,
      finishReason,
    };
  }

  listModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'o1-preview',
      'o1-mini',
    ];
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      return response.ok;
    } catch (err) {
      logger.warn({ err }, 'OpenAI health check failed');
      return false;
    }
  }
}
