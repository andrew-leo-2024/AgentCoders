import type { ManagementModelType, AgentGroup, TopologyConfig, CadenceConfig } from '@agentcoders/shared';
import type { ManagementModel } from '../model-interface.js';
import { AgileReleaseTrain } from './art.js';
import { PiPlanning } from './pi-planning.js';

export { AgileReleaseTrain, PiPlanning };

class SafeModel implements ManagementModel {
  readonly type: ManagementModelType = 'safe';
  private groups: AgentGroup[] = [];
  private piPlanner = new PiPlanning();
  private workAssignmentIndex = 0;

  configureTopology(agents: string[], config: Record<string, unknown>): TopologyConfig {
    const teamSize = (config['teamSize'] as number) ?? 5;
    const art = new AgileReleaseTrain('art-1', 'Main ART');
    const teams: AgentGroup[] = [];

    for (let i = 0; i < agents.length; i += teamSize) {
      const teamAgents = agents.slice(i, i + teamSize);
      const team: AgentGroup = {
        id: `team-${teams.length + 1}`,
        name: `Team ${teams.length + 1}`,
        type: 'agile-team',
        members: teamAgents.map((a, j) => ({
          agentId: a,
          role: j === 0 ? 'scrum-master' : 'developer',
          joinedAt: new Date(),
        })),
        metadata: {},
      };
      teams.push(team);
      art.addTeam(team);
    }

    if (agents.length > 0) {
      art.members.push({
        agentId: agents[0]!,
        role: 'release-train-engineer',
        joinedAt: new Date(),
      });
    }

    this.groups = [art, ...teams];

    const cadence: CadenceConfig = {
      sprintLengthDays: (config['sprintLengthDays'] as number) ?? 14,
      standupFrequency: 'daily',
      retrospectiveFrequency: 'per-sprint',
      planningFrequency: 'per-pi',
    };

    return {
      modelType: this.type,
      groups: this.groups,
      cadence,
      escalationPaths: [
        { fromGroup: 'agile-team', toGroup: 'art', triggerConditions: ['cross-team-dependency', 'impediment'] },
      ],
    };
  }

  assignWork(workItemId: number, groups: AgentGroup[]): string {
    const teams = groups.filter(g => g.type === 'agile-team');
    if (teams.length === 0) return '';
    const team = teams[this.workAssignmentIndex % teams.length]!;
    this.workAssignmentIndex++;
    const devs = team.members.filter(m => m.role === 'developer');
    return devs.length > 0 ? devs[0]!.agentId : team.members[0]?.agentId ?? '';
  }

  getGroups(): AgentGroup[] {
    return this.groups;
  }

  reportMetrics(): Record<string, number> {
    const teams = this.groups.filter(g => g.type === 'agile-team');
    return {
      totalTeams: teams.length,
      totalAgents: this.groups.flatMap(g => g.members).length,
      committedObjectives: this.piPlanner.getCommitted().length,
    };
  }
}

export function createSafeModel(_config: Record<string, unknown> = {}): ManagementModel {
  return new SafeModel();
}
