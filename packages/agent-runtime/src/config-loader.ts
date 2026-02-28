import { loadConfig, agentConfigSchema, type AgentEnvConfig } from '@agentcoders/shared';

let configInstance: AgentEnvConfig | null = null;

export function getConfig(): AgentEnvConfig {
  if (!configInstance) {
    configInstance = loadConfig(agentConfigSchema);
  }
  return configInstance;
}
