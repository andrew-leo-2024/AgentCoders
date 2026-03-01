import { Octokit } from '@octokit/rest';
import type { ScmProvider, ScmWorkItem, ScmPullRequest } from '@agentcoders/shared';

export class GitHubScmAdapter implements ScmProvider {
  public readonly type = 'github' as const;
  private readonly octokit: Octokit;

  constructor(
    token: string,
    private readonly owner: string,
    private readonly repo: string,
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  async queryWorkItems(query: string): Promise<ScmWorkItem[]> {
    // Scope the search to the configured repository
    const qualifiedQuery = `repo:${this.owner}/${this.repo} ${query}`;

    const result = await this.octokit.search.issuesAndPullRequests({
      q: qualifiedQuery,
      per_page: 100,
    });

    return result.data.items.map((issue) => this.mapIssueToWorkItem(issue));
  }

  async getWorkItem(id: number): Promise<ScmWorkItem> {
    const { data: issue } = await this.octokit.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: id,
    });

    return this.mapIssueToWorkItem(issue);
  }

  async updateWorkItem(
    id: number,
    updates: Partial<ScmWorkItem>,
  ): Promise<void> {
    const params: Record<string, unknown> = {
      owner: this.owner,
      repo: this.repo,
      issue_number: id,
    };

    if (updates.title !== undefined) {
      params.title = updates.title;
    }
    if (updates.description !== undefined) {
      params.body = updates.description;
    }
    if (updates.state !== undefined) {
      // Map state to GitHub state — 'open' and 'closed' are the valid values
      params.state = updates.state === 'closed' || updates.state === 'Closed'
        ? 'closed'
        : 'open';
    }
    if (updates.assignedTo !== undefined) {
      params.assignees = [updates.assignedTo];
    }
    if (updates.tags !== undefined) {
      params.labels = updates.tags;
    }

    await this.octokit.issues.update(params as Parameters<typeof this.octokit.issues.update>[0]);
  }

  async createPr(
    title: string,
    sourceBranch: string,
    targetBranch: string,
    workItemIds: number[],
  ): Promise<ScmPullRequest> {
    // Build body with issue references so GitHub auto-links them
    const issueRefs = workItemIds.length > 0
      ? `\n\nRelated issues: ${workItemIds.map((id) => `#${id}`).join(', ')}`
      : '';

    const { data: pr } = await this.octokit.pulls.create({
      owner: this.owner,
      repo: this.repo,
      title,
      head: sourceBranch,
      base: targetBranch,
      body: `Pull request created by AgentCoders.${issueRefs}`,
    });

    return {
      id: pr.number,
      title: pr.title,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      status: this.mapPrState(pr.state, pr.merged),
      workItemIds,
      url: pr.html_url,
    };
  }

  async mergePr(prId: number): Promise<void> {
    await this.octokit.pulls.merge({
      owner: this.owner,
      repo: this.repo,
      pull_number: prId,
      merge_method: 'squash',
    });
  }

  async getPr(prId: number): Promise<ScmPullRequest> {
    const { data: pr } = await this.octokit.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prId,
    });

    // Extract linked issue numbers from the PR body
    const workItemIds = this.extractIssueNumbers(pr.body ?? '');

    return {
      id: pr.number,
      title: pr.title,
      sourceBranch: pr.head.ref,
      targetBranch: pr.base.ref,
      status: this.mapPrState(pr.state, pr.merged),
      workItemIds,
      url: pr.html_url,
    };
  }

  private mapIssueToWorkItem(issue: {
    number: number;
    title: string;
    state: string;
    assignee?: { login: string } | null;
    labels: Array<{ name?: string } | string>;
    body?: string | null;
    html_url: string;
  }): ScmWorkItem {
    return {
      id: issue.number,
      title: issue.title,
      state: issue.state,
      assignedTo: issue.assignee?.login,
      tags: issue.labels.map((label) =>
        typeof label === 'string' ? label : (label.name ?? ''),
      ).filter(Boolean),
      description: issue.body ?? undefined,
      url: issue.html_url,
    };
  }

  private mapPrState(
    state: string,
    merged: boolean | null | undefined,
  ): ScmPullRequest['status'] {
    if (merged) return 'completed';
    if (state === 'closed') return 'abandoned';
    return 'active';
  }

  private extractIssueNumbers(body: string): number[] {
    const pattern = /#(\d+)/g;
    const ids: number[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      ids.push(Number(match[1]));
    }
    return ids;
  }
}
