// Skill Registry types — skills + MCP server config

export type SkillCategory = 'frontend' | 'backend' | 'devops' | 'security' | 'testing' | 'design' | 'general';

export interface SkillDefinition {
  id: string;
  name: string;
  category: SkillCategory;
  version: string;
  description: string;
  content: string;
  isBuiltin: boolean;
  createdAt: Date;
}

export interface AgentSkill {
  id: string;
  tenantId: string;
  agentId: string;
  skillId: string;
  activatedAt: Date;
}

export interface SkillScoreRecord {
  id: string;
  tenantId: string;
  skillId: string;
  taskType: string;
  qualityDelta: number;
  sampleCount: number;
  updatedAt: Date;
}

export interface McpServerConfig {
  name: string;
  url: string;
  authToken?: string;
  tools: string[];
  enabled: boolean;
}
