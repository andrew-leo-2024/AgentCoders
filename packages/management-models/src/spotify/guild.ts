import type { AgentGroup, GroupMember } from '@agentcoders/shared';

export class Guild implements AgentGroup {
  id: string;
  name: string;
  type = 'guild';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  topic: string;

  constructor(id: string, name: string, topic: string) {
    this.id = id;
    this.name = name;
    this.topic = topic;
    this.members = [];
    this.metadata = { topic, voluntary: true };
  }

  addMember(agentId: string): void {
    this.members.push({ agentId, role: 'guild-member', joinedAt: new Date() });
  }
}
