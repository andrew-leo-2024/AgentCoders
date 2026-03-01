import type { ManagementModelType, AgentGroup, TopologyConfig, CadenceConfig } from '@agentcoders/shared';
import type { ManagementModel } from '../model-interface.js';
import { Squad } from './squad.js';
import { Tribe } from './tribe.js';
import { Chapter } from './chapter.js';
import { Guild } from './guild.js';

export { Squad, Tribe, Chapter, Guild };

class SpotifyModel implements ManagementModel {
  readonly type: ManagementModelType = 'spotify';
  private groups: AgentGroup[] = [];
  private workAssignmentIndex = 0;

  configureTopology(agents: string[], config: Record<string, unknown>): TopologyConfig {
    const squadSize = (config['squadSize'] as number) ?? 4;
    const squads: Squad[] = [];
    const tribe = new Tribe('tribe-1', 'Main Tribe');

    for (let i = 0; i < agents.length; i += squadSize) {
      const squadAgents = agents.slice(i, i + squadSize);
      const squad = new Squad(`squad-${squads.length + 1}`, `Squad ${squads.length + 1}`, tribe.name);
      for (let j = 0; j < squadAgents.length; j++) {
        const role = j === 0 ? 'product-owner' : 'developer';
        squad.addMember(squadAgents[j]!, role);
      }
      squads.push(squad);
      tribe.addSquad(squad);
    }

    const chapter = new Chapter('chapter-1', 'Engineering Chapter', 'engineering');
    for (const agent of agents) {
      chapter.addMember(agent);
    }

    const guild = new Guild('guild-1', 'Quality Guild', 'quality');
    for (const agent of agents.slice(0, Math.ceil(agents.length / 2))) {
      guild.addMember(agent);
    }

    this.groups = [tribe, ...squads, chapter, guild];

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
        { fromGroup: 'squad', toGroup: 'tribe', triggerConditions: ['blocked', 'cross-squad-dependency'] },
        { fromGroup: 'tribe', toGroup: 'chapter', triggerConditions: ['technical-decision', 'standard-violation'] },
      ],
    };
  }

  assignWork(workItemId: number, groups: AgentGroup[]): string {
    const squads = groups.filter(g => g.type === 'squad');
    if (squads.length === 0) return '';
    const squad = squads[this.workAssignmentIndex % squads.length]!;
    this.workAssignmentIndex++;
    const developers = squad.members.filter(m => m.role === 'developer');
    return developers.length > 0 ? developers[0]!.agentId : squad.members[0]?.agentId ?? '';
  }

  getGroups(): AgentGroup[] {
    return this.groups;
  }

  reportMetrics(): Record<string, number> {
    const squads = this.groups.filter(g => g.type === 'squad');
    return {
      totalSquads: squads.length,
      totalAgents: this.groups.flatMap(g => g.members).length,
      avgSquadSize: squads.length > 0
        ? squads.reduce((sum, s) => sum + s.members.length, 0) / squads.length
        : 0,
    };
  }
}

export function createSpotifyModel(_config: Record<string, unknown> = {}): ManagementModel {
  return new SpotifyModel();
}
