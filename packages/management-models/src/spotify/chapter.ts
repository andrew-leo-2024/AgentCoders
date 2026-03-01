import type { AgentGroup, GroupMember } from '@agentcoders/shared';

export class Chapter implements AgentGroup {
  id: string;
  name: string;
  type = 'chapter';
  members: GroupMember[];
  metadata: Record<string, unknown>;
  specialty: string;

  constructor(id: string, name: string, specialty: string) {
    this.id = id;
    this.name = name;
    this.specialty = specialty;
    this.members = [];
    this.metadata = { specialty, crossCutting: true };
  }

  addMember(agentId: string): void {
    this.members.push({ agentId, role: 'chapter-member', joinedAt: new Date() });
  }

  getChapterLead(): GroupMember | undefined {
    return this.members.find(m => m.role === 'chapter-lead');
  }
}
