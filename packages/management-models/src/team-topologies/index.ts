import type { ManagementModelType, AgentGroup, TopologyConfig, CadenceConfig } from '@agentcoders/shared';
import type { ManagementModel } from '../model-interface.js';
import { StreamAlignedTeam } from './stream-aligned.js';
import { PlatformTeam } from './platform-team.js';
import { EnablingTeam } from './enabling-team.js';

export { StreamAlignedTeam, PlatformTeam, EnablingTeam };

class TeamTopologiesModel implements ManagementModel {
  readonly type: ManagementModelType = 'team-topologies';
  private groups: AgentGroup[] = [];
  private workAssignmentIndex = 0;

  configureTopology(agents: string[], config: Record<string, unknown>): TopologyConfig {
    const platformRatio = (config['platformRatio'] as number) ?? 0.2;
    const enablingRatio = (config['enablingRatio'] as number) ?? 0.1;

    const platformCount = Math.max(1, Math.floor(agents.length * platformRatio));
    const enablingCount = Math.max(1, Math.floor(agents.length * enablingRatio));
    const streamCount = agents.length - platformCount - enablingCount;

    const streamTeam = new StreamAlignedTeam('stream-1', 'Stream Team', 'main');
    const platformTeam = new PlatformTeam('platform-1', 'Platform Team');
    const enablingTeam = new EnablingTeam('enabling-1', 'Enabling Team');

    let idx = 0;
    for (let i = 0; i < streamCount && idx < agents.length; i++, idx++) {
      streamTeam.addMember(agents[idx]!, i === 0 ? 'team-lead' : 'developer');
    }
    for (let i = 0; i < platformCount && idx < agents.length; i++, idx++) {
      platformTeam.addMember(agents[idx]!, i === 0 ? 'team-lead' : 'platform-engineer');
    }
    for (let i = 0; i < enablingCount && idx < agents.length; i++, idx++) {
      enablingTeam.addMember(agents[idx]!, i === 0 ? 'team-lead' : 'enabler');
    }

    this.groups = [streamTeam, platformTeam, enablingTeam];

    const cadence: CadenceConfig = {
      sprintLengthDays: (config['sprintLengthDays'] as number) ?? 14,
      standupFrequency: 'daily',
      retrospectiveFrequency: 'per-sprint',
      planningFrequency: 'per-sprint',
    };

    return {
      modelType: this.type,
      groups: this.groups,
      cadence,
      escalationPaths: [
        { fromGroup: 'stream-aligned', toGroup: 'platform', triggerConditions: ['platform-capability-needed'] },
        { fromGroup: 'stream-aligned', toGroup: 'enabling', triggerConditions: ['skill-gap', 'new-technology'] },
      ],
    };
  }

  assignWork(workItemId: number, groups: AgentGroup[]): string {
    const streamTeams = groups.filter(g => g.type === 'stream-aligned');
    if (streamTeams.length === 0) return '';
    const team = streamTeams[this.workAssignmentIndex % streamTeams.length]!;
    this.workAssignmentIndex++;
    const devs = team.members.filter(m => m.role === 'developer');
    return devs.length > 0 ? devs[0]!.agentId : team.members[0]?.agentId ?? '';
  }

  getGroups(): AgentGroup[] {
    return this.groups;
  }

  reportMetrics(): Record<string, number> {
    return {
      streamAlignedTeams: this.groups.filter(g => g.type === 'stream-aligned').length,
      platformTeams: this.groups.filter(g => g.type === 'platform').length,
      enablingTeams: this.groups.filter(g => g.type === 'enabling').length,
      totalAgents: this.groups.flatMap(g => g.members).length,
    };
  }
}

export function createTeamTopologiesModel(_config: Record<string, unknown> = {}): ManagementModel {
  return new TeamTopologiesModel();
}
