import type { ProviderRequest, ProviderResponse, ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import { BaseProvider } from './base.js';
import { getConfig } from '../config.js';
import { CostCalculator } from '../cost-calculator.js';

const logger = createLogger('model-router:ollama');

interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

export class OllamaProvider extends BaseProvider {
  readonly provider: ModelProvider = 'ollama';
  private baseUrl: string;
  private costCalculator: CostCalculator;

  constructor(baseUrl?: string) {
    super();
    this.baseUrl = baseUrl ?? getConfig().OLLAMA_BASE_URL;
    this.costCalculator = new CostCalculator();
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const modelId = 'llama3.1:8b';
    const startMs = Date.now();

    logger.debug({ modelId, baseUrl: this.baseUrl }, 'Sending request to Ollama');

    // Build the prompt: prepend system prompt if provided
    let fullPrompt = '';
    if (request.systemPrompt) {
      fullPrompt += `${request.systemPrompt}\n\n`;
    }
    fullPrompt += request.prompt;

    const body: Record<string, unknown> = {
      model: modelId,
      prompt: fullPrompt,
      stream: false,
    };

    if (request.temperature !== undefined) {
      body['options'] = { temperature: request.temperature };
    }

    if (request.maxTokens) {
      body['options'] = {
        ...((body['options'] as Record<string, unknown>) ?? {}),
        num_predict: request.maxTokens,
      };
    }

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    const latencyMs = Date.now() - startMs;

    const inputTokens = data.prompt_eval_count ?? 0;
    const outputTokens = data.eval_count ?? 0;
    const costUsd = this.costCalculator.calculate('ollama', modelId, inputTokens, outputTokens);

    const content = data.response ?? '';

    const finishReason: ProviderResponse['finishReason'] = data.done ? 'complete' : 'error';

    logger.info({ modelId, inputTokens, outputTokens, latencyMs, costUsd }, 'Ollama response received');

    return {
      content,
      provider: 'ollama',
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
      'llama3.1:8b',
      'llama3.1:70b',
      'codellama:13b',
      'mistral:7b',
      'deepseek-coder:6.7b',
    ];
  }

  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch (err) {
      logger.warn({ err }, 'Ollama health check failed');
      return false;
    }
  }
}
