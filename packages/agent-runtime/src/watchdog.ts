import type { Logger } from '@agentcoders/shared';
import type { ClaudeCodeExecutor } from './claude-code-executor.js';

export class Watchdog {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly executor: ClaudeCodeExecutor,
    private readonly logger: Logger,
  ) {}

  start(timeoutMs: number, workItemId: number): void {
    this.stop();
    this.timer = setTimeout(() => {
      if (this.executor.isRunning) {
        this.logger.warn({ workItemId, timeoutMs }, 'Watchdog: killing Claude Code — timeout exceeded');
        this.executor.kill();
      }
    }, timeoutMs);
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
