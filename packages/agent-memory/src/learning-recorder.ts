import { createLogger } from '@agentcoders/shared';
import { MemoryStore } from './memory-store.js';
import { VaultManager } from './vault-manager.js';

const logger = createLogger('agent-memory:learning');

export interface TaskOutcome {
  workItemId: number;
  title: string;
  success: boolean;
  durationMs: number;
  tokensUsed: number;
  errorMessages?: string[];
  filesChanged?: string[];
  testsAdded?: number;
}

export class LearningRecorder {
  private store: MemoryStore;
  private vault: VaultManager;

  constructor(store: MemoryStore, vault: VaultManager) {
    this.store = store;
    this.vault = vault;
  }

  async recordOutcome(tenantId: string, agentId: string, outcome: TaskOutcome): Promise<void> {
    const lessons = this.extractLessons(outcome);

    for (const lesson of lessons) {
      await this.vault.addToVault('resource', lesson.key, lesson.content, lesson.relevance);
    }

    logger.info({
      agentId,
      workItemId: outcome.workItemId,
      lessonsExtracted: lessons.length,
    }, 'Task outcome recorded');
  }

  private extractLessons(outcome: TaskOutcome): Array<{ key: string; content: string; relevance: number }> {
    const lessons: Array<{ key: string; content: string; relevance: number }> = [];

    if (!outcome.success && outcome.errorMessages?.length) {
      lessons.push({
        key: `error:wi-${outcome.workItemId}`,
        content: `Task "${outcome.title}" failed. Errors: ${outcome.errorMessages.join('; ')}`,
        relevance: 0.9,
      });
    }

    if (outcome.success && outcome.durationMs > 0) {
      lessons.push({
        key: `perf:wi-${outcome.workItemId}`,
        content: `Task "${outcome.title}" completed in ${Math.round(outcome.durationMs / 1000)}s using ${outcome.tokensUsed} tokens. Files: ${outcome.filesChanged?.join(', ') ?? 'unknown'}`,
        relevance: 0.6,
      });
    }

    if (outcome.filesChanged?.length) {
      const dirs = [...new Set(outcome.filesChanged.map(f => f.split('/').slice(0, -1).join('/')))];
      lessons.push({
        key: `structure:wi-${outcome.workItemId}`,
        content: `Worked in directories: ${dirs.join(', ')}`,
        relevance: 0.4,
      });
    }

    return lessons;
  }
}
