import type { AgentGroup, GroupMember } from '@agentcoders/shared';
import type { Squad } from './squad.js';

export class Tribe implements AgentGroup {
  id: string;
  name: string;
  type = 'tribe';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  squads: Squad[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.members = [];
    this.squads = [];
    this.metadata = { maxSquads: 10 };
  }

  addSquad(squad: Squad): void {
    this.squads.push(squad);
    for (const member of squad.members) {
      if (!this.members.find(m => m.agentId === member.agentId)) {
        this.members.push(member);
      }
    }
  }

  getTribeLead(): GroupMember | undefined {
    return this.members.find(m => m.role === 'tribe-lead');
  }
}
