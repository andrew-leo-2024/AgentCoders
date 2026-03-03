import type { Logger, ScmProvider } from '@agentcoders/shared';
import type { RedisBus } from './redis-bus.js';

interface TrackedPr {
  workItemId: number;
  prId: number;
  ciCompleted: boolean;
  prApproved: boolean;
  prMerged: boolean;
  workItemClosed: boolean;
}

const POLL_INTERVAL_MS = 60_000;

export class PrStatusPoller {
  private tracked = new Map<number, TrackedPr>();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly scm: ScmProvider,
    private readonly redisBus: RedisBus,
    private readonly agentId: string,
    private readonly logger: Logger,
  ) {}

  trackPr(workItemId: number, prId: number): void {
    this.tracked.set(prId, {
      workItemId,
      prId,
      ciCompleted: false,
      prApproved: false,
      prMerged: false,
      workItemClosed: false,
    });
    this.logger.info({ prId, workItemId }, 'Tracking PR for DWI lifecycle events');
  }

  start(): void {
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.logger.info('PR status poller started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed for testing — runs one poll cycle for all tracked PRs */
  async tick(): Promise<void> {
    for (const [prId, entry] of this.tracked) {
      try {
        await this.checkPr(entry);

        // Remove fully completed entries
        if (entry.ciCompleted && entry.prApproved && entry.prMerged && entry.workItemClosed) {
          this.tracked.delete(prId);
          this.logger.info({ prId, workItemId: entry.workItemId }, 'DWI lifecycle complete — stopped tracking PR');
        }
      } catch (err) {
        this.logger.warn({ prId, err }, 'Error checking PR status');
      }
    }
  }

  private async checkPr(entry: TrackedPr): Promise<void> {
    const { prId, workItemId } = entry;

    // Check CI status
    if (!entry.ciCompleted && this.scm.getCheckRunStatus) {
      const ci = await this.scm.getCheckRunStatus(prId);
      if (ci.state === 'success' || ci.state === 'failure') {
        entry.ciCompleted = true;
        await this.redisBus.publishCiCompleted(this.agentId, workItemId, prId, ci.state === 'success');
        this.logger.info({ prId, workItemId, passed: ci.state === 'success' }, 'CI completed');
      }
    }

    // Check PR review status
    if (!entry.prApproved && this.scm.getPrReviewStatus) {
      const review = await this.scm.getPrReviewStatus(prId);
      if (review.approved) {
        entry.prApproved = true;
        await this.redisBus.publishPrApproved(this.agentId, workItemId, prId);
        this.logger.info({ prId, workItemId }, 'PR approved');
      }
    }

    // Check PR merge status
    if (!entry.prMerged) {
      const pr = await this.scm.getPr(prId);
      if (pr.status === 'completed') {
        entry.prMerged = true;
        await this.redisBus.publishPrMerged(this.agentId, workItemId, prId);
        this.logger.info({ prId, workItemId }, 'PR merged');
      }
    }

    // Check work item / issue closed
    if (!entry.workItemClosed && entry.prMerged) {
      const wi = await this.scm.getWorkItem(workItemId);
      if (wi.state === 'closed' || wi.state === 'Closed') {
        entry.workItemClosed = true;
        await this.redisBus.publishDwiWorkItemClosed(this.agentId, workItemId);
        this.logger.info({ prId, workItemId }, 'Work item closed');
      }
    }
  }
}
