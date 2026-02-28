import type { Logger } from '@agentcoders/shared';
import type { GitClient } from './git-client.js';
import type { AdoClient } from './ado-client.js';

export class RevertManager {
  constructor(
    private readonly git: GitClient,
    private readonly ado: AdoClient,
    private readonly repositoryId: string,
    private readonly logger: Logger,
  ) {}

  async revertMergedPr(params: {
    mergeCommitHash: string;
    workItemId: number;
    reason: string;
    baseBranch?: string;
  }): Promise<{ prId: number }> {
    const { mergeCommitHash, workItemId, reason, baseBranch = 'main' } = params;

    // Create revert branch
    const revertBranch = `ai/revert-${workItemId}-${Date.now()}`;
    await this.git.exec(['fetch', 'origin']);
    await this.git.exec(['checkout', '-b', revertBranch, `origin/${baseBranch}`]);

    // Create revert commit
    await this.git.createRevertCommit(mergeCommitHash);

    // Push and create PR
    await this.git.exec(['push', 'origin', revertBranch]);

    const pr = await this.ado.createPullRequest({
      repositoryId: this.repositoryId,
      sourceRefName: `refs/heads/${revertBranch}`,
      targetRefName: `refs/heads/${baseBranch}`,
      title: `[AI-REVERT] Revert changes for WI #${workItemId}`,
      description: [
        `## Automated Revert`,
        ``,
        `**Reason:** ${reason}`,
        `**Original Work Item:** #${workItemId}`,
        `**Reverted Commit:** ${mergeCommitHash}`,
        ``,
        `This revert was triggered automatically due to post-merge CI failure or manual request.`,
      ].join('\n'),
      workItemIds: [workItemId],
      autoComplete: false, // Revert PRs require human approval
    });

    await this.ado.addComment(
      workItemId,
      `Revert PR #${pr.pullRequestId} created. Reason: ${reason}`,
    );

    this.logger.info({ prId: pr.pullRequestId, workItemId, reason }, 'Created revert PR');
    return { prId: pr.pullRequestId };
  }
}
