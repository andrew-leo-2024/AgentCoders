import { Redis } from 'ioredis';
import type { Logger, Database } from '@agentcoders/shared';
import { dwiRecords } from '@agentcoders/shared';
import { eq, and } from 'drizzle-orm';

/**
 * Merge event tracked by the quality gate monitor.
 * We watch for CI failures within 30 minutes of a merge and trigger reverts.
 */
interface MergeEvent {
  tenantId: string;
  agentId: string;
  dwiId: string;
  workItemId: number;
  prId: number;
  mergedAt: number; // epoch ms
}

/**
 * Post-merge quality enforcement.
 *
 * Monitors CI pipeline results after PR merge.
 * If CI fails within 30 minutes of merge, triggers a revert and marks the DWI as non-billable.
 */
export class QualityGateMonitor {
  private sub: Redis;
  private pub: Redis;
  private recentMerges = new Map<string, MergeEvent>(); // keyed by `{tenantId}:{prId}`
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  private static readonly REVERT_WINDOW_MS = 30 * 60_000; // 30 minutes

  constructor(
    private readonly redisUrl: string,
    private readonly db: Database,
    private readonly logger: Logger,
  ) {
    this.sub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
    this.pub = new Redis(redisUrl, { maxRetriesPerRequest: 3 });
  }

  /**
   * Starts monitoring CI results for merged PRs.
   *
   * Subscribes to:
   * - `{tenantId}:pr:merged` — records merge events
   * - `{tenantId}:ci:completed` — checks CI results against recent merges
   */
  async start(tenantIds: string[]): Promise<void> {
    for (const tenantId of tenantIds) {
      await this.sub.subscribe(`${tenantId}:pr:merged`);
      await this.sub.subscribe(`${tenantId}:ci:completed`);
      this.logger.info({ tenantId }, 'QualityGateMonitor subscribed to PR merge and CI channels');
    }

    this.sub.on('message', (channel: string, message: string) => {
      void this.handleMessage(channel, message);
    });

    // Periodically clean up merge events older than the revert window
    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleEntries();
    }, 60_000);

    this.logger.info('QualityGateMonitor started');
  }

  /**
   * Stops the monitor and cleans up resources.
   */
  async stop(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.recentMerges.clear();
    await this.sub.unsubscribe();
    this.sub.disconnect();
    this.pub.disconnect();
    this.logger.info('QualityGateMonitor stopped');
  }

  private async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const parsed = JSON.parse(message) as Record<string, unknown>;

      if (channel.endsWith(':pr:merged')) {
        this.handleMergeEvent(parsed);
      } else if (channel.endsWith(':ci:completed')) {
        await this.handleCiResult(parsed);
      }
    } catch (err) {
      this.logger.error({ channel, err }, 'Failed to handle quality gate message');
    }
  }

  /**
   * Records a PR merge event for tracking within the revert window.
   */
  private handleMergeEvent(data: Record<string, unknown>): void {
    const tenantId = data['tenantId'] as string;
    const agentId = data['agentId'] as string;
    const dwiId = data['dwiId'] as string;
    const workItemId = data['workItemId'] as number;
    const prId = data['prId'] as number;

    if (!tenantId || !prId) {
      this.logger.warn({ data }, 'Invalid merge event — missing tenantId or prId');
      return;
    }

    const key = `${tenantId}:${prId}`;
    this.recentMerges.set(key, {
      tenantId,
      agentId,
      dwiId,
      workItemId,
      prId,
      mergedAt: Date.now(),
    });

    this.logger.info({ tenantId, prId, dwiId }, 'Tracking merged PR for quality gate');
  }

  /**
   * Handles a CI pipeline completion event.
   * If the CI failed and the merge was within the revert window, triggers a revert.
   */
  private async handleCiResult(data: Record<string, unknown>): Promise<void> {
    const tenantId = data['tenantId'] as string;
    const prId = data['prId'] as number;
    const result = data['result'] as string;
    const pipelineId = data['pipelineId'] as number | undefined;

    if (!tenantId || !prId) return;

    const key = `${tenantId}:${prId}`;
    const mergeEvent = this.recentMerges.get(key);
    if (!mergeEvent) return; // Not a recently merged PR we're tracking

    const elapsed = Date.now() - mergeEvent.mergedAt;
    if (elapsed > QualityGateMonitor.REVERT_WINDOW_MS) {
      // Outside the revert window — clean up and ignore
      this.recentMerges.delete(key);
      return;
    }

    if (result === 'succeeded') {
      // CI passed — DWI quality is confirmed, clean up tracking
      this.recentMerges.delete(key);
      this.logger.info({ tenantId, prId, pipelineId }, 'CI passed within revert window — DWI quality confirmed');
      return;
    }

    if (result === 'failed') {
      this.logger.warn({
        tenantId,
        prId,
        dwiId: mergeEvent.dwiId,
        pipelineId,
        elapsedMs: elapsed,
      }, 'CI failed within revert window — triggering revert');

      // 1. Publish revert request to the agent's Redis channel
      await this.publishRevertRequest(mergeEvent);

      // 2. Mark the DWI as 'reverted' and not billable
      await this.markDwiReverted(mergeEvent.dwiId);

      // 3. Clean up tracking
      this.recentMerges.delete(key);
    }
  }

  /**
   * Publishes a revert request to the agent's Redis channel.
   */
  private async publishRevertRequest(mergeEvent: MergeEvent): Promise<void> {
    const channel = `${mergeEvent.tenantId}:agent:${mergeEvent.agentId}:progress`;
    const message = {
      type: 'revert-request',
      agentId: mergeEvent.agentId,
      tenantId: mergeEvent.tenantId,
      workItemId: mergeEvent.workItemId,
      prId: mergeEvent.prId,
      dwiId: mergeEvent.dwiId,
      reason: 'CI pipeline failed within 30 minutes of merge',
      timestamp: new Date().toISOString(),
    };

    await this.pub.publish(channel, JSON.stringify(message));
    this.logger.info({
      channel,
      agentId: mergeEvent.agentId,
      prId: mergeEvent.prId,
    }, 'Published revert request');
  }

  /**
   * Marks a DWI as reverted in the database.
   * Reverted DWIs are NOT billable.
   */
  private async markDwiReverted(dwiId: string): Promise<void> {
    await this.db
      .update(dwiRecords)
      .set({
        status: 'reverted',
        isBillable: false,
      })
      .where(eq(dwiRecords.id, dwiId));

    this.logger.info({ dwiId }, 'Marked DWI as reverted (not billable)');
  }

  /**
   * Removes merge events older than the revert window.
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, event] of this.recentMerges) {
      if (now - event.mergedAt > QualityGateMonitor.REVERT_WINDOW_MS) {
        this.recentMerges.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug({ cleaned }, 'Cleaned up stale merge tracking entries');
    }
  }
}
