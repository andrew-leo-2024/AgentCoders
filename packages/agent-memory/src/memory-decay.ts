import { createLogger } from '@agentcoders/shared';
import { MemoryStore } from './memory-store.js';

const logger = createLogger('agent-memory:decay');

export class MemoryDecay {
  private store: MemoryStore;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(store: MemoryStore) {
    this.store = store;
  }

  start(intervalMs: number): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.runDecayCycle();
    }, intervalMs);
    logger.info({ intervalMs }, 'Memory decay started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Memory decay stopped');
    }
  }

  async runDecayCycle(): Promise<{ pruned: number; decayed: number }> {
    const pruned = await this.store.deleteExpired();

    // Decay relevance scores for old memories
    const tenantId = ''; // Decay runs across all tenants
    const agentId = '';
    // For now, just prune expired — relevance decay would need a bulk update
    const decayed = 0;

    if (pruned > 0 || decayed > 0) {
      logger.info({ pruned, decayed }, 'Decay cycle complete');
    }

    return { pruned, decayed };
  }
}
