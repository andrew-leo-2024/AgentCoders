import { loadConfig, modelRouterConfigSchema, type ModelRouterEnvConfig } from '@agentcoders/shared';

let configInstance: ModelRouterEnvConfig | null = null;

export function getConfig(): ModelRouterEnvConfig {
  if (!configInstance) configInstance = loadConfig(modelRouterConfigSchema);
  return configInstance;
}
