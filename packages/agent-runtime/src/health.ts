import { createServer, type Server } from 'node:http';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import type { Logger } from '@agentcoders/shared';

export interface HealthState {
  redisConnected: boolean;
  lastPollAt: Date | null;
  pollIntervalMs: number;
}

export class HealthServer {
  private server: Server | null = null;
  private state: HealthState = {
    redisConnected: false,
    lastPollAt: null,
    pollIntervalMs: 30_000,
  };

  readonly registry: Registry;
  readonly metrics: {
    workItemsProcessed: Counter;
    claudeCodeDuration: Histogram;
    tokenUsage: Counter;
    prsCreated: Counter;
    prsMerged: Counter;
    pollLoopActive: Gauge;
    lastPollTimestamp: Gauge;
    estimatedCostUsd: Counter;
  };

  constructor(private readonly agentId: string, private readonly logger: Logger) {
    this.registry = new Registry();
    this.registry.setDefaultLabels({ agent_id: agentId });
    collectDefaultMetrics({ register: this.registry });

    this.metrics = {
      workItemsProcessed: new Counter({
        name: 'agent_work_items_processed_total',
        help: 'Total work items processed',
        labelNames: ['agent_id', 'vertical', 'status'] as const,
        registers: [this.registry],
      }),
      claudeCodeDuration: new Histogram({
        name: 'agent_claude_code_duration_seconds',
        help: 'Duration of Claude Code sessions',
        buckets: [30, 60, 120, 300, 600, 900, 1200, 1800],
        registers: [this.registry],
      }),
      tokenUsage: new Counter({
        name: 'agent_token_usage_total',
        help: 'Total tokens used',
        labelNames: ['agent_id', 'model', 'direction'] as const,
        registers: [this.registry],
      }),
      prsCreated: new Counter({
        name: 'agent_prs_created_total',
        help: 'Total PRs created',
        registers: [this.registry],
      }),
      prsMerged: new Counter({
        name: 'agent_prs_merged_total',
        help: 'Total PRs merged',
        registers: [this.registry],
      }),
      pollLoopActive: new Gauge({
        name: 'agent_poll_loop_active',
        help: 'Whether the poll loop is active',
        registers: [this.registry],
      }),
      lastPollTimestamp: new Gauge({
        name: 'agent_last_poll_timestamp',
        help: 'Timestamp of last poll',
        registers: [this.registry],
      }),
      estimatedCostUsd: new Counter({
        name: 'agent_estimated_cost_usd_total',
        help: 'Estimated cost in USD',
        registers: [this.registry],
      }),
    };
  }

  updateState(partial: Partial<HealthState>): void {
    Object.assign(this.state, partial);
  }

  async start(port: number): Promise<void> {
    this.server = createServer(async (req, res) => {
      if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
      }

      if (req.url === '/readyz') {
        const ready = this.isReady();
        res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ready,
          redisConnected: this.state.redisConnected,
          lastPollAt: this.state.lastPollAt?.toISOString() ?? null,
        }));
        return;
      }

      if (req.url === '/metrics') {
        res.writeHead(200, { 'Content-Type': this.registry.contentType });
        res.end(await this.registry.metrics());
        return;
      }

      res.writeHead(404);
      res.end('Not Found');
    });

    return new Promise((resolve) => {
      this.server!.listen(port, () => {
        this.logger.info({ port }, 'Health server started');
        resolve();
      });
    });
  }

  private isReady(): boolean {
    if (!this.state.redisConnected) return false;
    if (!this.state.lastPollAt) return true; // Just started, no poll yet — still ready
    const staleThreshold = this.state.pollIntervalMs * 2;
    const timeSinceLastPoll = Date.now() - this.state.lastPollAt.getTime();
    return timeSinceLastPoll < staleThreshold;
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}
