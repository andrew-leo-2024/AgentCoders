import type { ProviderRequest, ProviderResponse, ModelProvider } from '@agentcoders/shared';

export abstract class BaseProvider {
  abstract readonly provider: ModelProvider;

  abstract generate(request: ProviderRequest): Promise<ProviderResponse>;

  abstract listModels(): string[];

  abstract isHealthy(): Promise<boolean>;
}
