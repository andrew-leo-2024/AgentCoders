import type { AgentGroup } from '@agentcoders/shared';

export interface PIObjective {
  id: string;
  description: string;
  assignedTeam: string;
  businessValue: number;
  committed: boolean;
}

export class PiPlanning {
  objectives: PIObjective[] = [];

  planIncrement(teams: AgentGroup[], features: Array<{ id: string; description: string; priority: number }>): PIObjective[] {
    this.objectives = [];
    const sortedFeatures = [...features].sort((a, b) => b.priority - a.priority);

    for (let i = 0; i < sortedFeatures.length; i++) {
      const feature = sortedFeatures[i]!;
      const team = teams[i % teams.length]!;
      this.objectives.push({
        id: `pi-obj-${i + 1}`,
        description: feature.description,
        assignedTeam: team.id,
        businessValue: feature.priority,
        committed: i < teams.length * 2,
      });
    }

    return this.objectives;
  }

  getCommitted(): PIObjective[] {
    return this.objectives.filter(o => o.committed);
  }

  getUncommitted(): PIObjective[] {
    return this.objectives.filter(o => !o.committed);
  }
}
