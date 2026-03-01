import type { ManagementModelType, AgentGroup, TopologyConfig, CadenceConfig } from '@agentcoders/shared';

export interface ManagementModel {
  readonly type: ManagementModelType;
  configureTopology(agents: string[], config: Record<string, unknown>): TopologyConfig;
  assignWork(workItemId: number, groups: AgentGroup[]): string;
  getGroups(): AgentGroup[];
  reportMetrics(): Record<string, number>;
}

export { ModelSelector } from './model-selector.js';
export { TopologyEngine } from './topology-engine.js';
export { createSpotifyModel } from './spotify/index.js';
export { createSafeModel } from './safe/index.js';
export { createTeamTopologiesModel } from './team-topologies/index.js';
