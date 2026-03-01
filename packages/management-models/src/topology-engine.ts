import type { ManagementModelType, TopologyConfig } from '@agentcoders/shared';
import type { ManagementModel } from './model-interface.js';
import { ModelSelector } from './model-selector.js';

export class TopologyEngine {
  private selector = new ModelSelector();

  apply(modelType: ManagementModelType, agents: string[], config: Record<string, unknown> = {}): TopologyConfig {
    const model = this.selector.select(modelType, config);
    return model.configureTopology(agents, config);
  }

  rebalance(topology: TopologyConfig, agents: string[]): TopologyConfig {
    const model = this.selector.select(topology.modelType);
    return model.configureTopology(agents, {});
  }

  validate(topology: TopologyConfig): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (topology.groups.length === 0) {
      issues.push('Topology has no groups');
    }

    for (const group of topology.groups) {
      if (group.members.length === 0) {
        issues.push(`Group "${group.name}" has no members`);
      }
    }

    if (!topology.cadence.sprintLengthDays || topology.cadence.sprintLengthDays < 1) {
      issues.push('Sprint length must be at least 1 day');
    }

    return { valid: issues.length === 0, issues };
  }
}
