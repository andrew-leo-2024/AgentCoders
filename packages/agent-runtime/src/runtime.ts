import { createLogger, getDb, RedisChannels } from '@agentcoders/shared';
import { getConfig } from './config-loader.js';
import { RedisBus } from './redis-bus.js';
import { AdoClient } from './ado-client.js';
import { GitClient } from './git-client.js';
import { ClaudeCodeExecutor } from './claude-code-executor.js';
import { PrManager } from './pr-manager.js';
import { CostTracker } from './cost-tracker.js';
import { HealthServer } from './health.js';
import { Watchdog } from './watchdog.js';
import { Lifecycle } from './lifecycle.js';
import { PollLoop } from './poll-loop.js';
import { FreshContextExecutor } from './fresh-context-executor.js';
import { StateTracker } from './state-tracker.js';

export class AgentRuntime {
  private pollLoop: PollLoop | null = null;
  private lifecycle: Lifecycle | null = null;
  private freshContextExecutor: FreshContextExecutor | null = null;
  private stateTracker: StateTracker | null = null;

  async start(): Promise<void> {
    const config = getConfig();
    const logger = createLogger(`agent:${config.AGENT_ID}`);

    logger.info({ agentId: config.AGENT_ID, vertical: config.AGENT_VERTICAL }, 'Agent runtime starting');

    // Initialize components
    const db = getDb(config.DATABASE_URL);
    const redisBus = new RedisBus(config.REDIS_URL, config.TENANT_ID, logger);
    const adoClient = new AdoClient(config.ADO_ORG_URL, config.ADO_PROJECT, config.ADO_PAT, logger);
    const workDir = process.cwd();
    const gitClient = new GitClient(workDir, logger);
    const executor = new ClaudeCodeExecutor(logger);
    const repositoryId = config.ADO_REPOSITORY_ID ?? config.ADO_PROJECT;
    const prManager = new PrManager(adoClient, gitClient, repositoryId, logger);
    const costTracker = new CostTracker(db, logger);
    const healthServer = new HealthServer(config.AGENT_ID, logger);
    const watchdog = new Watchdog(executor, logger);

    // Initialize platform extension components
    this.freshContextExecutor = new FreshContextExecutor(logger);
    this.stateTracker = new StateTracker(logger);

    this.lifecycle = new Lifecycle(config.AGENT_ID, executor, redisBus, healthServer, logger);
    this.lifecycle.setup();

    // Start health server
    await healthServer.start(config.HEALTH_PORT);

    // Subscribe to Redis channels
    const verticalChannel = RedisChannels.vertical(config.TENANT_ID, config.AGENT_NAMESPACE);
    await redisBus.subscribe(verticalChannel, (msg) => {
      logger.info({ channel: verticalChannel, type: msg.type }, 'Received squad message');
    });

    const telegramChannel = RedisChannels.telegramInbound(config.TENANT_ID, config.AGENT_VERTICAL);
    await redisBus.subscribe(telegramChannel, (msg) => {
      logger.info({ channel: telegramChannel, type: msg.type }, 'Received Telegram message');
    });

    healthServer.updateState({
      redisConnected: true,
      pollIntervalMs: config.POLL_INTERVAL_MS,
    });

    // Start poll loop
    this.pollLoop = new PollLoop(
      {
        agentId: config.AGENT_ID,
        tenantId: config.TENANT_ID,
        vertical: config.AGENT_VERTICAL,
        namespace: config.AGENT_NAMESPACE,
        pollIntervalMs: config.POLL_INTERVAL_MS,
        maxTurnsCoding: config.MAX_TURNS_CODING,
        maxTurnsReview: config.MAX_TURNS_REVIEW,
        claudeCodeTimeoutMs: config.CLAUDE_CODE_TIMEOUT_MS,
        dailyBudgetUsd: config.DAILY_BUDGET_USD,
        monthlyBudgetUsd: config.MONTHLY_BUDGET_USD,
        workDir,
        adoProject: config.ADO_PROJECT,
        repositoryId,
        triageModel: config.CLAUDE_MODEL_TRIAGE,
        codingModel: config.CLAUDE_MODEL_CODING,
      },
      adoClient,
      gitClient,
      executor,
      prManager,
      redisBus,
      costTracker,
      healthServer,
      watchdog,
      this.lifecycle,
      logger,
    );

    this.pollLoop.start();

    // Publish online status
    await redisBus.publishHeartbeat(config.AGENT_ID, 'idle');

    logger.info('Agent runtime started successfully');
  }
}
