import { Octokit } from '@octokit/rest';
import type { ProjectManagement, ScmWorkItem } from '@agentcoders/shared';

export class GitHubProjectManagement implements ProjectManagement {
  private readonly octokit: Octokit;

  constructor(
    token: string,
    private readonly owner: string,
    private readonly repo: string,
  ) {
    this.octokit = new Octokit({ auth: token });
  }

  async createTask(
    title: string,
    description: string,
    assignee?: string,
  ): Promise<ScmWorkItem> {
    const { data: issue } = await this.octokit.issues.create({
      owner: this.owner,
      repo: this.repo,
      title,
      body: description,
      assignees: assignee ? [assignee] : undefined,
      labels: ['task'],
    });

    return this.mapIssueToWorkItem(issue);
  }

  async updateTask(
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

  async queryTasks(filter: string): Promise<ScmWorkItem[]> {
    // Build a GitHub search query scoped to the repo with task label
    const qualifiedQuery = `repo:${this.owner}/${this.repo} is:issue label:task ${filter}`;

    const result = await this.octokit.search.issuesAndPullRequests({
      q: qualifiedQuery,
      per_page: 100,
    });

    return result.data.items.map((issue) => this.mapIssueToWorkItem(issue));
  }

  async getTask(id: number): Promise<ScmWorkItem> {
    const { data: issue } = await this.octokit.issues.get({
      owner: this.owner,
      repo: this.repo,
      issue_number: id,
    });

    return this.mapIssueToWorkItem(issue);
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
}
