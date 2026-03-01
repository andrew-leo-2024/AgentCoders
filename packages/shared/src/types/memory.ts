// Agent Memory types — PARA-categorized persistent memory

export type MemoryCategory = 'project' | 'area' | 'resource' | 'archive';

export interface AgentMemoryEntry {
  id: string;
  tenantId: string;
  agentId: string;
  category: MemoryCategory;
  key: string;
  content: string;
  relevanceScore: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface VaultConfig {
  agentId: string;
  tenantId: string;
  maxEntriesPerCategory: number;
  decayIntervalMs: number;
  defaultTtlMs: number;
}
