import type { AgentGroup, GroupMember } from '@agentcoders/shared';

export class PlatformTeam implements AgentGroup {
  id: string;
  name: string;
  type = 'platform';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  services: string[];

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.members = [];
    this.services = [];
    this.metadata = { selfService: true };
  }

  addMember(agentId: string, role: string): void {
    this.members.push({ agentId, role, joinedAt: new Date() });
  }

  addService(service: string): void {
    this.services.push(service);
  }
}
