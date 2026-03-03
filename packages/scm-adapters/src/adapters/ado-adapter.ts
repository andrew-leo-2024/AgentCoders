import type {
  ScmProvider,
  ScmWorkItem,
  ScmPullRequest,
  AdoPatchOperation,
  WiqlQueryResult,
  AdoWorkItemFields,
  AdoPullRequest,
} from '@agentcoders/shared';

const ADO_API_VERSION = '7.1';

export class AdoScmAdapter implements ScmProvider {
  public readonly type = 'ado' as const;
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(
    private readonly orgUrl: string,
    private readonly project: string,
    pat: string,
  ) {
    this.baseUrl = `${orgUrl}/${project}`;
    this.authHeader = `Basic ${Buffer.from(`:${pat}`).toString('base64')}`;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}${path.includes('?') ? '&' : '?'}api-version=${ADO_API_VERSION}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `ADO API error ${response.status} for ${options.method ?? 'GET'} ${path}: ${body}`,
      );
    }

    return response.json() as Promise<T>;
  }

  async queryWorkItems(wiql: string): Promise<ScmWorkItem[]> {
    const result = await this.request<WiqlQueryResult>(
      '/_apis/wit/wiql',
      {
        method: 'POST',
        body: JSON.stringify({ query: wiql }),
      },
    );

    if (!result.workItems || result.workItems.length === 0) {
      return [];
    }

    const ids = result.workItems.map((wi) => wi.id);
    const batchSize = 200;
    const items: ScmWorkItem[] = [];

    for (let i = 0; i < ids.length; i += batchSize) {
      const batch = ids.slice(i, i + batchSize);
      const idsParam = batch.join(',');
      const batchResult = await this.request<{
        value: Array<{ id: number; fields: AdoWorkItemFields; url: string }>;
      }>(
        `/_apis/wit/workitems?ids=${idsParam}&$expand=none`,
      );

      for (const wi of batchResult.value) {
        items.push(this.mapWorkItem(wi));
      }
    }

    return items;
  }

  async getWorkItem(id: number): Promise<ScmWorkItem> {
    const wi = await this.request<{
      id: number;
      fields: AdoWorkItemFields;
      url: string;
    }>(`/_apis/wit/workitems/${id}`);

    return this.mapWorkItem(wi);
  }

  async updateWorkItem(
    id: number,
    updates: Partial<ScmWorkItem>,
  ): Promise<void> {
    const ops: AdoPatchOperation[] = [];

    if (updates.title !== undefined) {
      ops.push({ op: 'replace', path: '/fields/System.Title', value: updates.title });
    }
    if (updates.state !== undefined) {
      ops.push({ op: 'replace', path: '/fields/System.State', value: updates.state });
    }
    if (updates.assignedTo !== undefined) {
      ops.push({ op: 'replace', path: '/fields/System.AssignedTo', value: updates.assignedTo });
    }
    if (updates.description !== undefined) {
      ops.push({ op: 'replace', path: '/fields/System.Description', value: updates.description });
    }
    if (updates.tags !== undefined) {
      ops.push({ op: 'replace', path: '/fields/System.Tags', value: updates.tags.join('; ') });
    }

    if (ops.length === 0) return;

    await this.request(`/_apis/wit/workitems/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(ops),
    });
  }

  async createPr(
    title: string,
    sourceBranch: string,
    targetBranch: string,
    workItemIds: number[],
  ): Promise<ScmPullRequest> {
    // Discover default repository for the project
    const repos = await this.request<{
      value: Array<{ id: string; name: string }>;
    }>('/_apis/git/repositories');

    if (!repos.value || repos.value.length === 0) {
      throw new Error(`No git repositories found in project ${this.project}`);
    }

    const repoId = repos.value[0].id;

    const sourceRef = sourceBranch.startsWith('refs/')
      ? sourceBranch
      : `refs/heads/${sourceBranch}`;
    const targetRef = targetBranch.startsWith('refs/')
      ? targetBranch
      : `refs/heads/${targetBranch}`;

    const body: Record<string, unknown> = {
      sourceRefName: sourceRef,
      targetRefName: targetRef,
      title,
      workItemRefs: workItemIds.map((id) => ({ id: String(id) })),
    };

    const pr = await this.request<AdoPullRequest>(
      `/_apis/git/repositories/${repoId}/pullrequests`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );

    return this.mapPullRequest(pr, workItemIds);
  }

  async mergePr(prId: number): Promise<void> {
    const repos = await this.request<{
      value: Array<{ id: string }>;
    }>('/_apis/git/repositories');

    if (!repos.value || repos.value.length === 0) {
      throw new Error(`No git repositories found in project ${this.project}`);
    }

    const repoId = repos.value[0].id;

    // Get current PR to obtain the last merge source commit
    const pr = await this.request<AdoPullRequest & { lastMergeSourceCommit?: { commitId: string } }>(
      `/_apis/git/repositories/${repoId}/pullrequests/${prId}`,
    );

    const lastMergeSourceCommit = pr.lastMergeSourceCommit?.commitId;

    await this.request(
      `/_apis/git/repositories/${repoId}/pullrequests/${prId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          lastMergeSourceCommit: lastMergeSourceCommit
            ? { commitId: lastMergeSourceCommit }
            : undefined,
          completionOptions: {
            mergeStrategy: 'squash',
            deleteSourceBranch: true,
            transitionWorkItems: true,
          },
        }),
      },
    );
  }

  async addComment(id: number, text: string): Promise<void> {
    await this.request(
      `/_apis/wit/workitems/${id}/comments?api-version=7.1-preview.4`,
      {
        method: 'POST',
        body: JSON.stringify({ text }),
      },
    );
  }

  async getPr(prId: number): Promise<ScmPullRequest> {
    const repos = await this.request<{
      value: Array<{ id: string }>;
    }>('/_apis/git/repositories');

    if (!repos.value || repos.value.length === 0) {
      throw new Error(`No git repositories found in project ${this.project}`);
    }

    const repoId = repos.value[0].id;

    const pr = await this.request<AdoPullRequest>(
      `/_apis/git/repositories/${repoId}/pullrequests/${prId}`,
    );

    // Fetch linked work items for this PR
    const workItemRefs = await this.request<{
      value: Array<{ id: string }>;
    }>(
      `/_apis/git/repositories/${repoId}/pullrequests/${prId}/workitems`,
    );

    const workItemIds = workItemRefs.value?.map((ref) => Number(ref.id)) ?? [];

    return this.mapPullRequest(pr, workItemIds);
  }

  private mapWorkItem(wi: {
    id: number;
    fields: AdoWorkItemFields;
    url: string;
  }): ScmWorkItem {
    const fields = wi.fields;
    return {
      id: wi.id,
      title: fields['System.Title'] ?? '',
      state: fields['System.State'] ?? '',
      assignedTo: fields['System.AssignedTo']?.displayName,
      tags: fields['System.Tags']
        ? fields['System.Tags'].split(';').map((t) => t.trim()).filter(Boolean)
        : [],
      description: fields['System.Description'],
      url: wi.url,
    };
  }

  private mapPullRequest(
    pr: AdoPullRequest,
    workItemIds: number[],
  ): ScmPullRequest {
    return {
      id: pr.pullRequestId,
      title: pr.title,
      sourceBranch: pr.sourceRefName.replace('refs/heads/', ''),
      targetBranch: pr.targetRefName.replace('refs/heads/', ''),
      status: pr.status,
      workItemIds,
      url: pr.url,
    };
  }
}
