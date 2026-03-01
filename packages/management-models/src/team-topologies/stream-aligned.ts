import type { AgentGroup, GroupMember } from '@agentcoders/shared';

export class StreamAlignedTeam implements AgentGroup {
  id: string;
  name: string;
  type = 'stream-aligned';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  stream: string;

  constructor(id: string, name: string, stream: string) {
    this.id = id;
    this.name = name;
    this.stream = stream;
    this.members = [];
    this.metadata = { stream, flowOriented: true };
  }

  addMember(agentId: string, role: string): void {
    this.members.push({ agentId, role, joinedAt: new Date() });
  }
}
