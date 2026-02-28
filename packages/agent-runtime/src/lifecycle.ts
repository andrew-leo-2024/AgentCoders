import type { Logger } from '@agentcoders/shared';
import type { ClaudeCodeExecutor } from './claude-code-executor.js';
import type { RedisBus } from './redis-bus.js';
import type { HealthServer } from './health.js';

export class Lifecycle {
  private shuttingDown = false;

  constructor(
    private readonly agentId: string,
    private readonly executor: ClaudeCodeExecutor,
    private readonly redisBus: RedisBus,
    private readonly healthServer: HealthServer,
    private readonly logger: Logger,
  ) {}

  setup(): void {
    const shutdown = (signal: string) => this.gracefulShutdown(signal);
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  private async gracefulShutdown(signal: string): Promise<void> {
    if (this.shuttingDown) return;
    this.shuttingDown = true;
    this.logger.info({ signal }, 'Graceful shutdown initiated');

    // 1. Stop accepting new work (poll loop checks this.isShuttingDown)

    // 2. Wait for current task to finish (max 60s)
    const deadline = Date.now() + 60_000;
    while (this.executor.isRunning && Date.now() < deadline) {
      this.logger.info('Waiting for current task to finish...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    if (this.executor.isRunning) {
      this.logger.warn('Force-killing Claude Code after 60s shutdown grace period');
      this.executor.kill();
    }

    // 3. Publish offline status
    await this.redisBus.publishHeartbeat(this.agentId, 'offline');

    // 4. Close connections
    await this.redisBus.close();
    await this.healthServer.stop();

    this.logger.info('Shutdown complete');
    process.exit(0);
  }
}
