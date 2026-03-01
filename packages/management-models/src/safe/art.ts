import type { AgentGroup, GroupMember } from '@agentcoders/shared';

export class AgileReleaseTrain implements AgentGroup {
  id: string;
  name: string;
  type = 'art';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  teams: AgentGroup[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.members = [];
    this.teams = [];
    this.metadata = { piLength: 5, sprintsPerPi: 5 };
  }

  addTeam(team: AgentGroup): void {
    this.teams.push(team);
    for (const member of team.members) {
      if (!this.members.find(m => m.agentId === member.agentId)) {
        this.members.push(member);
      }
    }
  }

  getRTE(): GroupMember | undefined {
    return this.members.find(m => m.role === 'release-train-engineer');
  }
}
