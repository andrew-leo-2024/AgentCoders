import type { AgentGroup, GroupMember } from '@agentcoders/shared';

export class EnablingTeam implements AgentGroup {
  id: string;
  name: string;
  type = 'enabling';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  capabilities: string[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.members = [];
    this.capabilities = [];
    this.metadata = { temporary: true, upskilling: true };
  }

  addMember(agentId: string, role: string): void {
    this.members.push({ agentId, role, joinedAt: new Date() });
  }

  addCapability(capability: string): void {
    this.capabilities.push(capability);
  }
}
