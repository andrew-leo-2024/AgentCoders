// Model Router types — model-agnostic routing

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'ollama';

export interface ModelCapabilities {
  maxTokens: number;
  supportsVision: boolean;
  supportsTools: boolean;
  supportsStreaming: boolean;
  contextWindow: number;
}

export interface ModelPricing {
  inputPer1kTokens: number;
  outputPer1kTokens: number;
  currency: string;
}

export interface ModelRoute {
  id: string;
  tenantId: string;
  provider: ModelProvider;
  modelId: string;
  capabilities: ModelCapabilities;
  pricing: ModelPricing;
  isActive: boolean;
  priority: number;
}

export type RoutingStrategy = 'cost-optimized' | 'quality-optimized' | 'latency-optimized' | 'round-robin';

export interface FallbackChain {
  primary: string;
  secondary: string;
  tertiary?: string;
  maxRetries: number;
}

export interface ProviderRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: Record<string, unknown>[];
  stream?: boolean;
}

export interface ProviderResponse {
  content: string;
  provider: ModelProvider;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
  finishReason: 'complete' | 'max-tokens' | 'stop' | 'error';
}

export interface ModelRouteLog {
  id: string;
  tenantId: string;
  agentId: string;
  routeId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  qualityScore?: number;
  costUsd: number;
}
