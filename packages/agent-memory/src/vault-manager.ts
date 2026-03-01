import type { MemoryCategory, VaultConfig, AgentMemoryEntry } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import { MemoryStore } from './memory-store.js';

const logger = createLogger('agent-memory:vault');

const PARA_CATEGORIES: MemoryCategory[] = ['project', 'area', 'resource', 'archive'];

export class VaultManager {
  private store: MemoryStore;
  private config: VaultConfig;

  constructor(store: MemoryStore, config: VaultConfig) {
    this.store = store;
    this.config = config;
  }

  async getVaultContents(): Promise<Record<MemoryCategory, AgentMemoryEntry[]>> {
    const result = {} as Record<MemoryCategory, AgentMemoryEntry[]>;
    for (const cat of PARA_CATEGORIES) {
      result[cat] = await this.store.getByAgent(this.config.tenantId, this.config.agentId, cat);
    }
    return result;
  }

  async addToVault(category: MemoryCategory, key: string, content: string, relevanceScore = 1.0): Promise<AgentMemoryEntry> {
    const entries = await this.store.getByAgent(this.config.tenantId, this.config.agentId, category);
    if (entries.length >= this.config.maxEntriesPerCategory) {
      const oldest = entries[entries.length - 1];
      if (oldest) {
        if (category !== 'archive') {
          await this.archiveEntry(oldest);
        } else {
          await this.store.delete(oldest.id);
        }
      }
    }
    return this.store.create({
      tenantId: this.config.tenantId,
      agentId: this.config.agentId,
      category,
      key,
      content,
      relevanceScore,
      expiresAt: this.config.defaultTtlMs > 0
        ? new Date(Date.now() + this.config.defaultTtlMs)
        : undefined,
    });
  }

  async archiveEntry(entry: AgentMemoryEntry): Promise<void> {
    await this.store.update(entry.id, { category: 'archive', relevanceScore: entry.relevanceScore * 0.5 });
    logger.info({ entryId: entry.id, key: entry.key }, 'Entry archived');
  }

  async promoteEntry(entryId: string, toCategory: MemoryCategory): Promise<void> {
    await this.store.update(entryId, { category: toCategory });
  }
}
