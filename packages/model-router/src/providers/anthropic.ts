import Anthropic from '@anthropic-ai/sdk';
import type { ProviderRequest, ProviderResponse, ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import { BaseProvider } from './base.js';
import { getConfig } from '../config.js';
import { CostCalculator } from '../cost-calculator.js';

const logger = createLogger('model-router:anthropic');

export class AnthropicProvider extends BaseProvider {
  readonly provider: ModelProvider = 'anthropic';
  private client: Anthropic;
  private costCalculator: CostCalculator;

  constructor(apiKey?: string) {
    super();
    const key = apiKey ?? getConfig().ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is required for AnthropicProvider. Set it in environment or pass it to the constructor.');
    }
    this.client = new Anthropic({ apiKey: key });
    this.costCalculator = new CostCalculator();
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const modelId = 'claude-sonnet-4-20250514';
    const startMs = Date.now();

    logger.debug({ modelId, maxTokens: request.maxTokens }, 'Sending request to Anthropic');

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: request.prompt },
    ];

    const createParams: Anthropic.MessageCreateParams = {
      model: modelId,
      max_tokens: request.maxTokens ?? 4096,
      messages,
    };

    if (request.systemPrompt) {
      createParams.system = request.systemPrompt;
    }

    if (request.temperature !== undefined) {
      createParams.temperature = request.temperature;
    }

    const response = await this.client.messages.create(createParams);

    const latencyMs = Date.now() - startMs;
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const costUsd = this.costCalculator.calculate('anthropic', modelId, inputTokens, outputTokens);

    // Extract text content from the response
    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    const content = textBlocks.map((block) => block.text).join('');

    // Map stop reason to our format
    let finishReason: ProviderResponse['finishReason'];
    switch (response.stop_reason) {
      case 'end_turn':
        finishReason = 'complete';
        break;
      case 'max_tokens':
        finishReason = 'max-tokens';
        break;
      case 'stop_sequence':
        finishReason = 'stop';
        break;
      default:
        finishReason = 'complete';
    }

    logger.info({ modelId, inputTokens, outputTokens, latencyMs, costUsd }, 'Anthropic response received');

    return {
      content,
      provider: 'anthropic',
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
      'claude-opus-4-20250514',
      'claude-sonnet-4-20250514',
      'claude-haiku-4-5-20251001',
    ];
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Lightweight health check: send a minimal message
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return response.stop_reason !== null;
    } catch (err) {
      logger.warn({ err }, 'Anthropic health check failed');
      return false;
    }
  }
}
