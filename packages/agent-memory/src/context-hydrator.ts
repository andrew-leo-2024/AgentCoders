import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@agentcoders/shared';
import type { AgentMemoryEntry } from '@agentcoders/shared';
import { MemoryStore } from './memory-store.js';

const logger = createLogger('agent-memory:hydrator');

export class ContextHydrator {
  private store: MemoryStore;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  async hydrate(tenantId: string, agentId: string, workspacePath: string, taskContext?: string): Promise<void> {
    const memories = await this.store.getByAgent(tenantId, agentId);
    if (memories.length === 0) {
      logger.debug({ agentId }, 'No memories to hydrate');
      return;
    }

    const relevant = taskContext
      ? this.filterRelevant(memories, taskContext)
      : memories.slice(0, 20);

    const content = this.buildClaudeMd(relevant);
    const claudeMdPath = join(workspacePath, '.claude', 'MEMORY.md');

    await writeFile(claudeMdPath, content, 'utf-8');
    logger.info({ agentId, memoryCount: relevant.length, path: claudeMdPath }, 'Context hydrated');
  }

  private filterRelevant(memories: AgentMemoryEntry[], context: string): AgentMemoryEntry[] {
    const contextLower = context.toLowerCase();
    const scored = memories.map(m => {
      const keyMatch = contextLower.includes(m.key.toLowerCase()) ? 2 : 0;
      const contentWords = m.content.toLowerCase().split(/\s+/);
      const contextWords = new Set(contextLower.split(/\s+/));
      const wordOverlap = contentWords.filter(w => contextWords.has(w)).length / Math.max(contentWords.length, 1);
      return { memory: m, score: m.relevanceScore + keyMatch + wordOverlap };
    });
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 15).map(s => s.memory);
  }

  private buildClaudeMd(memories: AgentMemoryEntry[]): string {
    const lines: string[] = ['# Agent Memory (Auto-hydrated)', ''];
    const byCategory = new Map<string, AgentMemoryEntry[]>();

    for (const m of memories) {
      const list = byCategory.get(m.category) ?? [];
      list.push(m);
      byCategory.set(m.category, list);
    }

    for (const [category, entries] of byCategory) {
      lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`, '');
      for (const entry of entries) {
        lines.push(`### ${entry.key}`, entry.content, '');
      }
    }

    return lines.join('\n');
  }
}
