import {
  loadConfig,
  governanceConfigSchema,
  type GovernanceEnvConfig,
} from '@agentcoders/shared';

let configInstance: GovernanceEnvConfig | null = null;

export function getGovernanceConfig(): GovernanceEnvConfig {
  if (!configInstance) {
    configInstance = loadConfig(governanceConfigSchema);
  }
  return configInstance;
}
