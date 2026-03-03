import {
  type Logger,
  type AgentStatus,
  type ScmProvider,
  type ScmProviderType,
  AgentTags,
  COMPLEXITY_TIMEOUTS_MS,
  type ComplexityTier,
} from '@agentcoders/shared';
import type { GitClient } from './git-client.js';
import type { ClaudeCodeExecutor, ClaudeCodeResult } from './claude-code-executor.js';
import type { PrManager } from './pr-manager.js';
import type { RedisBus } from './redis-bus.js';
import type { CostTracker } from './cost-tracker.js';
import type { HealthServer } from './health.js';
import type { Watchdog } from './watchdog.js';
import type { Lifecycle } from './lifecycle.js';
import type { PrStatusPoller } from './pr-status-poller.js';

export interface PollLoopConfig {
  agentId: string;
  tenantId: string;
  vertical: string;
  namespace: string;
  pollIntervalMs: number;
  maxTurnsCoding: number;
  maxTurnsReview: number;
  claudeCodeTimeoutMs: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
  workDir: string;
  scmProvider: ScmProviderType;
  adoProject?: string;
  repositoryId?: string;
  triageModel: string;
  codingModel: string;
}

export class PollLoop {
  private isProcessing = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private currentStatus: AgentStatus = 'idle';

  constructor(
    private readonly config: PollLoopConfig,
    private readonly scm: ScmProvider,
    private readonly git: GitClient,
    private readonly executor: ClaudeCodeExecutor,
    private readonly prManager: PrManager,
    private readonly redisBus: RedisBus,
    private readonly costTracker: CostTracker,
    private readonly healthServer: HealthServer,
    private readonly watchdog: Watchdog,
    private readonly lifecycle: Lifecycle,
    private readonly logger: Logger,
    private readonly prStatusPoller?: PrStatusPoller,
  ) {}

  start(): void {
    this.logger.info({ pollIntervalMs: this.config.pollIntervalMs }, 'Starting poll loop');
    this.healthServer.metrics.pollLoopActive.set(1);

    // Initial poll
    void this.poll();

    // Schedule with jitter
    this.timer = setInterval(() => {
      const jitter = Math.random() * 30_000; // 0-30s jitter to prevent thundering herd
      setTimeout(() => void this.poll(), jitter);
    }, this.config.pollIntervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.healthServer.metrics.pollLoopActive.set(0);
  }

  private async poll(): Promise<void> {
    // Non-reentrant guard
    if (this.isProcessing) {
      this.logger.debug('Poll skipped — already processing');
      return;
    }

    // Shutdown check
    if (this.lifecycle.isShuttingDown) {
      this.logger.info('Poll skipped — shutting down');
      return;
    }

    this.isProcessing = true;
    this.setStatus('polling');
    this.healthServer.updateState({ lastPollAt: new Date() });
    this.healthServer.metrics.lastPollTimestamp.set(Date.now() / 1000);

    try {
      // Check budget
      const budget = await this.costTracker.checkBudget(
        this.config.tenantId,
        this.config.agentId,
        this.config.dailyBudgetUsd,
        this.config.monthlyBudgetUsd,
      );

      if (!budget.withinBudget) {
        this.logger.warn({ budget }, 'Budget exceeded — going idle');
        await this.redisBus.publishEscalation(
          this.config.agentId, 0, 'budget-exceeded',
          `Daily: $${budget.dailySpent.toFixed(2)}/$${this.config.dailyBudgetUsd}, Monthly: $${budget.monthlySpent.toFixed(2)}/$${this.config.monthlyBudgetUsd}`,
        );
        this.setStatus('idle');
        return;
      }

      // Query for unclaimed work items (SCM-agnostic)
      const query = this.buildWorkItemQuery();
      const workItems = await this.scm.queryWorkItems(query);
      if (workItems.length === 0) {
        this.logger.debug('No unclaimed work items found');
        this.setStatus('idle');
        return;
      }

      // Get first work item details
      const wi = workItems[0]!;
      const title = wi.title;
      const description = wi.description ?? '';

      this.logger.info({ workItemId: wi.id, title }, 'Found work item — evaluating');

      // Triage with Claude Haiku (API direct — lightweight)
      const triageResult = await this.triageWorkItem(wi.id, title, description);

      if (triageResult.action === 'ignore') {
        this.logger.info({ workItemId: wi.id, reason: triageResult.reason }, 'Ignoring work item');
        return;
      }

      if (triageResult.action === 'escalate') {
        this.logger.info({ workItemId: wi.id, reason: triageResult.reason }, 'Escalating work item');
        await this.redisBus.publishEscalation(
          this.config.agentId, wi.id, 'blocked', triageResult.reason,
        );
        return;
      }

      // Claim the work item
      await this.claimWorkItem(wi.id, title, triageResult.complexityTier);
      await this.processWorkItem(wi.id, title, description, triageResult.complexityTier);
    } catch (err) {
      this.logger.error({ err }, 'Poll loop error');
      this.setStatus('error');
    } finally {
      this.isProcessing = false;
      // Publish heartbeat
      await this.redisBus.publishHeartbeat(this.config.agentId, this.currentStatus);
    }
  }

  private async triageWorkItem(
    workItemId: number,
    title: string,
    description: string,
  ): Promise<{
    action: 'claim' | 'ignore' | 'escalate';
    reason: string;
    complexityTier: ComplexityTier;
  }> {
    const prompt = `You are an AI agent evaluating a work item. Respond with a JSON object only.

Work Item #${workItemId}:
Title: ${title}
Description: ${description}

Evaluate:
1. Can this be implemented by an AI coding agent? (consider: clear requirements, reasonable scope, no physical/external dependencies)
2. What is the complexity tier? (XS: trivial fix, S: small feature, M: medium feature, L: large feature, XL: major feature)

Respond ONLY with JSON:
{"action": "claim"|"ignore"|"escalate", "reason": "brief explanation", "complexityTier": "XS"|"S"|"M"|"L"|"XL"}`;

    const result = await this.executor.execute({
      prompt,
      workDir: this.config.workDir,
      maxTurns: 1,
      timeoutMs: 60_000,
      model: this.config.triageModel,
    });

    try {
      const jsonMatch = result.output.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      this.logger.warn({ workItemId, output: result.output }, 'Failed to parse triage result');
    }

    // Default: claim as Medium
    return { action: 'claim', reason: 'Default claim — triage parsing failed', complexityTier: 'M' };
  }

  private async claimWorkItem(workItemId: number, title: string, complexityTier: ComplexityTier): Promise<void> {
    this.setStatus('working');
    this.logger.info({ workItemId, title, complexityTier }, 'Claiming work item');

    await this.scm.updateWorkItem(workItemId, {
      state: 'Active',
      tags: [AgentTags.AiClaimed],
      assignedTo: this.config.agentId,
    });

    await this.scm.addComment?.(workItemId,
      `Claimed by AI agent \`${this.config.agentId}\` (${this.config.vertical}). Estimated complexity: ${complexityTier}`,
    );

    await this.redisBus.publishProgress(
      this.config.agentId, workItemId, 'branching',
      `Claimed WI #${workItemId}: ${title} [${complexityTier}]`,
    );
  }

  private async processWorkItem(
    workItemId: number,
    title: string,
    description: string,
    complexityTier: ComplexityTier,
  ): Promise<void> {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40);

    let branch: string | null = null;

    try {
      // 1. Create branch
      branch = await this.git.createBranch(workItemId, slug);
      await this.redisBus.publishProgress(this.config.agentId, workItemId, 'branching', `Created branch: ${branch}`);

      // 2. Pre-flight freshness check
      const preflight = await this.prManager.preFlightCheck();
      if (!preflight.fresh) {
        await this.redisBus.publishEscalation(
          this.config.agentId, workItemId, 'merge-conflict',
          `Branch is ${preflight.behindBy} commits behind and rebase failed`,
        );
        return;
      }

      // 3. Claude Code coding session with watchdog timeout
      const timeoutMs = COMPLEXITY_TIMEOUTS_MS[complexityTier];
      this.watchdog.start(timeoutMs, workItemId);

      await this.redisBus.publishProgress(this.config.agentId, workItemId, 'coding', 'Starting Claude Code session');

      const codingResult = await this.executor.execute({
        prompt: this.buildCodingPrompt(workItemId, title, description),
        workDir: this.config.workDir,
        maxTurns: this.config.maxTurnsCoding,
        timeoutMs,
        codingModel: undefined,
        model: this.config.codingModel,
      } as Parameters<typeof this.executor.execute>[0]);

      this.watchdog.stop();
      await this.recordCodingSession(workItemId, codingResult, complexityTier);

      if (codingResult.exitReason === 'timeout') {
        await this.redisBus.publishEscalation(
          this.config.agentId, workItemId, 'timeout',
          `Claude Code timed out after ${timeoutMs}ms for ${complexityTier} work item`,
        );
        return;
      }

      // 4. Commit and push
      await this.redisBus.publishProgress(this.config.agentId, workItemId, 'committing', 'Committing changes');
      await this.git.commitAndPush(branch, `AI: ${title} (WI #${workItemId})`);

      // 5. Create PR
      await this.redisBus.publishProgress(this.config.agentId, workItemId, 'pr-creating', 'Creating pull request');
      const pr = await this.prManager.createPr({
        workItemId,
        title,
        branch,
        description: codingResult.output.slice(0, 2000),
      });

      this.healthServer.metrics.prsCreated.inc();

      // Publish DWI events for billing
      await this.redisBus.publishDwiWorkItemCreated(this.config.agentId, workItemId, title);
      await this.redisBus.publishPrLinked(this.config.agentId, workItemId, pr.prId, pr.url);

      // Track PR for CI/review/merge lifecycle events
      this.prStatusPoller?.trackPr(workItemId, pr.prId);

      // 6. Update work item
      await this.scm.updateWorkItem(workItemId, {
        state: 'Resolved',
        tags: [AgentTags.AiClaimed, AgentTags.AiCompleted],
      });

      await this.redisBus.publishProgress(
        this.config.agentId, workItemId, 'done',
        `PR #${pr.prId} created for WI #${workItemId}`,
      );

      this.healthServer.metrics.workItemsProcessed.inc({
        agent_id: this.config.agentId,
        vertical: this.config.vertical,
        status: 'completed',
      });

      this.logger.info({ workItemId, prId: pr.prId, branch }, 'Work item completed');
    } catch (err) {
      this.logger.error({ workItemId, err }, 'Failed to process work item');
      this.healthServer.metrics.workItemsProcessed.inc({
        agent_id: this.config.agentId,
        vertical: this.config.vertical,
        status: 'failed',
      });

      await this.redisBus.publishEscalation(
        this.config.agentId, workItemId, 'blocked',
        `Processing failed: ${err instanceof Error ? err.message : String(err)}`,
      );

      // Tag work item as blocked
      await this.scm.updateWorkItem(workItemId, {
        tags: [AgentTags.AiClaimed, AgentTags.AiBlocked],
      }).catch(() => {}); // Best effort
    } finally {
      // Return to main branch
      if (branch) {
        await this.git.cleanWorkspace().catch(() => {});
      }
      this.setStatus('idle');
    }
  }

  private buildWorkItemQuery(): string {
    if (this.config.scmProvider === 'github') {
      // GitHub search query: open issues without ai-claimed label
      return `is:issue is:open -label:${AgentTags.AiClaimed} label:agent-ready`;
    }
    // ADO WIQL query
    return `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.TeamProject] = '${this.config.adoProject}'
        AND [System.State] = 'New'
        AND [System.Tags] NOT CONTAINS '${AgentTags.AiClaimed}'
        AND [System.AreaPath] UNDER '${this.config.adoProject}\\${this.config.vertical}'
      ORDER BY [Microsoft.VSTS.Common.Priority] ASC, [System.CreatedDate] ASC
    `;
  }

  private buildCodingPrompt(workItemId: number, title: string, description: string): string {
    return `You are an AI coding agent working on a software project.

## Work Item #${workItemId}
**Title:** ${title}
**Description:** ${description}

## Instructions
1. Analyze the codebase to understand the existing patterns and architecture
2. Implement the changes described in the work item
3. Follow existing code style and conventions
4. Write or update tests if the project has a test suite
5. Ensure the code compiles/builds without errors
6. Keep changes focused — only modify what's needed for this work item

## Rules
- Do NOT modify unrelated files
- Do NOT add unnecessary dependencies
- Do NOT break existing functionality
- If you encounter blocking issues, explain them clearly in your output`;
  }

  private async recordCodingSession(
    workItemId: number,
    result: ClaudeCodeResult,
    _complexityTier: ComplexityTier,
  ): Promise<void> {
    await this.costTracker.recordSession({
      tenantId: this.config.tenantId,
      agentId: this.config.agentId,
      workItemId,
      model: this.config.codingModel,
      mode: 'coding',
      inputTokens: result.tokensUsed.input,
      outputTokens: result.tokensUsed.output,
      turns: result.turns,
      durationMs: result.durationMs,
      exitReason: result.exitReason,
    });

    this.healthServer.metrics.claudeCodeDuration.observe(result.durationMs / 1000);
    this.healthServer.metrics.tokenUsage.inc(
      { agent_id: this.config.agentId, model: this.config.codingModel, direction: 'input' },
      result.tokensUsed.input,
    );
    this.healthServer.metrics.tokenUsage.inc(
      { agent_id: this.config.agentId, model: this.config.codingModel, direction: 'output' },
      result.tokensUsed.output,
    );
    this.healthServer.metrics.estimatedCostUsd.inc(
      this.costTracker.estimateCost(this.config.codingModel, result.tokensUsed.input, result.tokensUsed.output),
    );
  }

  private setStatus(status: AgentStatus): void {
    this.currentStatus = status;
  }
}
