import type { ModelProvider } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';

const logger = createLogger('model-router:cost');

/**
 * Pricing entry: cost per 1k tokens in USD.
 */
interface PricingEntry {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
}

/**
 * Known model pricing table.
 * Prices in USD per 1,000 tokens.
 */
const PRICING_TABLE: Record<string, PricingEntry> = {
  // Anthropic
  'claude-opus-4-20250514': { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075 },
  'claude-sonnet-4-20250514': { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 },
  'claude-haiku-4-5-20251001': { inputPer1kTokens: 0.001, outputPer1kTokens: 0.005 },

  // OpenAI
  'gpt-4o': { inputPer1kTokens: 0.0025, outputPer1kTokens: 0.01 },
  'gpt-4o-mini': { inputPer1kTokens: 0.00015, outputPer1kTokens: 0.0006 },
  'gpt-4-turbo': { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 },
  'o1-preview': { inputPer1kTokens: 0.015, outputPer1kTokens: 0.06 },
  'o1-mini': { inputPer1kTokens: 0.003, outputPer1kTokens: 0.012 },

  // Google
  'gemini-2.0-flash': { inputPer1kTokens: 0.0001, outputPer1kTokens: 0.0004 },
  'gemini-2.0-flash-lite': { inputPer1kTokens: 0.000075, outputPer1kTokens: 0.0003 },
  'gemini-2.5-pro-preview-05-06': { inputPer1kTokens: 0.00125, outputPer1kTokens: 0.01 },

  // Ollama (local — zero cost)
  'llama3.1:8b': { inputPer1kTokens: 0, outputPer1kTokens: 0 },
  'llama3.1:70b': { inputPer1kTokens: 0, outputPer1kTokens: 0 },
  'codellama:13b': { inputPer1kTokens: 0, outputPer1kTokens: 0 },
  'mistral:7b': { inputPer1kTokens: 0, outputPer1kTokens: 0 },
  'deepseek-coder:6.7b': { inputPer1kTokens: 0, outputPer1kTokens: 0 },
};

/**
 * Calculates the cost of API calls based on provider, model, and token usage.
 * Uses a built-in pricing table for known models, falling back to provider-level
 * estimates for unknown models.
 */
export class CostCalculator {
  /**
   * Calculate cost in USD for a given model invocation.
   */
  calculate(
    provider: ModelProvider,
    modelId: string,
    inputTokens: number,
    outputTokens: number,
  ): number {
    const pricing = this.getPricing(provider, modelId);

    const inputCost = (inputTokens / 1000) * pricing.inputPer1kTokens;
    const outputCost = (outputTokens / 1000) * pricing.outputPer1kTokens;
    const totalCost = inputCost + outputCost;

    return Math.round(totalCost * 1_000_000) / 1_000_000; // 6 decimal places
  }

  /**
   * Look up pricing for a model. Falls back to conservative provider-level defaults.
   */
  private getPricing(provider: ModelProvider, modelId: string): PricingEntry {
    const known = PRICING_TABLE[modelId];
    if (known) return known;

    logger.debug({ provider, modelId }, 'Unknown model — using provider-level default pricing');

    // Conservative fallback pricing per provider
    switch (provider) {
      case 'anthropic':
        return { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 };
      case 'openai':
        return { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 };
      case 'google':
        return { inputPer1kTokens: 0.001, outputPer1kTokens: 0.005 };
      case 'ollama':
        return { inputPer1kTokens: 0, outputPer1kTokens: 0 };
      default:
        return { inputPer1kTokens: 0.01, outputPer1kTokens: 0.03 };
    }
  }

  /**
   * Returns the pricing table entry for a model, or undefined if unknown.
   */
  getPricingEntry(modelId: string): PricingEntry | undefined {
    return PRICING_TABLE[modelId];
  }

  /**
   * Lists all known model IDs in the pricing table.
   */
  listKnownModels(): string[] {
    return Object.keys(PRICING_TABLE);
  }
}
