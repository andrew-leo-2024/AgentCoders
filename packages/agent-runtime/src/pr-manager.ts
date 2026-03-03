import type { Logger, ScmProvider } from '@agentcoders/shared';
import type { GitClient } from './git-client.js';

export interface CreatePrResult {
  prId: number;
  url: string;
}

export class PrManager {
  constructor(
    private readonly scm: ScmProvider,
    private readonly git: GitClient,
    private readonly logger: Logger,
  ) {}

  async preFlightCheck(baseBranch = 'main'): Promise<{ fresh: boolean; behindBy: number }> {
    const behindBy = await this.git.getCommitsBehind(baseBranch);
    if (behindBy > 0) {
      this.logger.info({ behindBy }, 'Branch is behind base — attempting rebase');
      const result = await this.git.rebase(baseBranch);
      if (!result.success) {
        return { fresh: false, behindBy };
      }
    }
    return { fresh: true, behindBy: 0 };
  }

  async createPr(params: {
    workItemId: number;
    title: string;
    branch: string;
    description: string;
    baseBranch?: string;
  }): Promise<CreatePrResult> {
    const { workItemId, title, branch, description, baseBranch = 'main' } = params;

    // Push latest
    await this.git.exec(['push', 'origin', branch]);

    const pr = await this.scm.createPr(
      `[AI] ${title}`,
      branch,
      baseBranch,
      [workItemId],
    );

    // Add comment to work item
    await this.scm.addComment?.(
      workItemId,
      `PR #${pr.id} created by AI agent: ${pr.url}`,
    );

    this.logger.info({ prId: pr.id, workItemId }, 'Created pull request');
    return { prId: pr.id, url: pr.url };
  }
}
