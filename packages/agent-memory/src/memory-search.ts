import type { AgentMemoryEntry } from '@agentcoders/shared';
import { MemoryStore } from './memory-store.js';

export class MemorySearch {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  async search(tenantId: string, agentId: string, query: string): Promise<AgentMemoryEntry[]> {
    const keyResults = await this.store.search(tenantId, agentId, query);

    const allMemories = await this.store.getByAgent(tenantId, agentId);
    const fuzzyResults = this.fuzzyMatch(allMemories, query);

    const seen = new Set(keyResults.map(r => r.id));
    const combined = [...keyResults];
    for (const r of fuzzyResults) {
      if (!seen.has(r.id)) {
        combined.push(r);
        seen.add(r.id);
      }
    }

    return combined;
  }

  private fuzzyMatch(memories: AgentMemoryEntry[], query: string): AgentMemoryEntry[] {
    const queryTokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (queryTokens.length === 0) return [];

    const scored = memories.map(m => {
      const text = `${m.key} ${m.content}`.toLowerCase();
      const matchCount = queryTokens.filter(t => text.includes(t)).length;
      const score = matchCount / queryTokens.length;
      return { memory: m, score };
    });

    return scored
      .filter(s => s.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(s => s.memory);
  }
}
