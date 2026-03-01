import type { AgentGroup, GroupMember } from '@agentcoders/shared';

export class Squad implements AgentGroup {
  id: string;
  name: string;
  type = 'squad';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  tribe: string;

  constructor(id: string, name: string, tribe: string) {
    this.id = id;
    this.name = name;
    this.tribe = tribe;
    this.members = [];
    this.metadata = { tribe, autonomous: true };
  }

  addMember(agentId: string, role: string): void {
    this.members.push({ agentId, role, joinedAt: new Date() });
  }

  getProductOwner(): GroupMember | undefined {
    return this.members.find(m => m.role === 'product-owner');
  }
}
