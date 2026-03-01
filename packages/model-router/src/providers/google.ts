import type { ProviderRequest, ProviderResponse, ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import { BaseProvider } from './base.js';
import { getConfig } from '../config.js';
import { CostCalculator } from '../cost-calculator.js';

const logger = createLogger('model-router:google');

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{ text: string }>;
    };
    finishReason: string;
  }>;
  usageMetadata: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

export class GoogleProvider extends BaseProvider {
  readonly provider: ModelProvider = 'google';
  private apiKey: string;
  private baseUrl: string;
  private costCalculator: CostCalculator;

  constructor(apiKey?: string) {
    super();
    const key = apiKey ?? getConfig().GOOGLE_API_KEY;
    if (!key) {
      throw new Error('GOOGLE_API_KEY is required for GoogleProvider. Set it in environment or pass it to the constructor.');
    }
    this.apiKey = key;
    this.baseUrl = 'https://generativelanguage.googleapis.com/v1beta';
    this.costCalculator = new CostCalculator();
  }

  async generate(request: ProviderRequest): Promise<ProviderResponse> {
    const modelId = 'gemini-2.0-flash';
    const startMs = Date.now();

    logger.debug({ modelId, maxTokens: request.maxTokens }, 'Sending request to Google Gemini');

    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [
      { role: 'user', parts: [{ text: request.prompt }] },
    ];

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
      },
    };

    if (request.systemPrompt) {
      body['systemInstruction'] = {
        parts: [{ text: request.systemPrompt }],
      };
    }

    if (request.temperature !== undefined) {
      (body['generationConfig'] as Record<string, unknown>)['temperature'] = request.temperature;
    }

    const url = `${this.baseUrl}/models/${modelId}:generateContent?key=${this.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Google Gemini API error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as GeminiResponse;
    const latencyMs = Date.now() - startMs;

    const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
    const costUsd = this.costCalculator.calculate('google', modelId, inputTokens, outputTokens);

    // Extract text from response candidates
    const content = data.candidates
      ?.map((c) => c.content.parts.map((p) => p.text).join(''))
      .join('') ?? '';

    let finishReason: ProviderResponse['finishReason'];
    const geminiReason = data.candidates?.[0]?.finishReason;
    switch (geminiReason) {
      case 'STOP':
        finishReason = 'complete';
        break;
      case 'MAX_TOKENS':
        finishReason = 'max-tokens';
        break;
      case 'SAFETY':
      case 'RECITATION':
        finishReason = 'stop';
        break;
      default:
        finishReason = 'complete';
    }

    logger.info({ modelId, inputTokens, outputTokens, latencyMs, costUsd }, 'Google Gemini response received');

    return {
      content,
      provider: 'google',
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
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-2.5-pro-preview-05-06',
    ];
  }

  async isHealthy(): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/models?key=${this.apiKey}`;
      const response = await fetch(url);
      return response.ok;
    } catch (err) {
      logger.warn({ err }, 'Google Gemini health check failed');
      return false;
    }
  }
}
