import { retry, type Logger, type AdoWorkItem, type AdoPatchOperation, type AdoCreatePrParams, type AdoPullRequest, type WiqlQueryResult } from '@agentcoders/shared';

export class AdoClient {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;

  constructor(
    private readonly orgUrl: string,
    private readonly project: string,
    private readonly pat: string,
    private readonly logger: Logger,
  ) {
    this.baseUrl = `${orgUrl}/${project}/_apis`;
    const encoded = Buffer.from(`:${pat}`).toString('base64');
    this.headers = {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
    };
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const response = await retry(
      async () => {
        const res = await fetch(url, {
          ...options,
          headers: { ...this.headers, ...options.headers as Record<string, string> },
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`ADO API ${res.status}: ${body}`);
        }
        return res.json() as Promise<T>;
      },
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        retryableErrors: (err) => {
          if (err instanceof Error && err.message.includes('429')) return true;
          if (err instanceof Error && err.message.includes('5')) return true;
          return false;
        },
      },
      this.logger,
    );
    return response;
  }

  async queryWorkItems(wiql: string): Promise<WiqlQueryResult> {
    return this.request<WiqlQueryResult>(`/wit/wiql?api-version=7.1`, {
      method: 'POST',
      body: JSON.stringify({ query: wiql }),
    });
  }

  async getWorkItem(id: number, expand?: string): Promise<AdoWorkItem> {
    const query = expand ? `?$expand=${expand}&api-version=7.1` : '?api-version=7.1';
    return this.request<AdoWorkItem>(`/wit/workitems/${id}${query}`);
  }

  async getWorkItems(ids: number[]): Promise<AdoWorkItem[]> {
    if (ids.length === 0) return [];
    const idsParam = ids.join(',');
    const result = await this.request<{ value: AdoWorkItem[] }>(
      `/wit/workitems?ids=${idsParam}&api-version=7.1`,
    );
    return result.value;
  }

  async updateWorkItem(id: number, operations: AdoPatchOperation[]): Promise<AdoWorkItem> {
    return this.request<AdoWorkItem>(`/wit/workitems/${id}?api-version=7.1`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(operations),
    });
  }

  async createWorkItem(type: string, operations: AdoPatchOperation[]): Promise<AdoWorkItem> {
    return this.request<AdoWorkItem>(`/wit/workitems/$${type}?api-version=7.1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(operations),
    });
  }

  async addComment(workItemId: number, text: string): Promise<void> {
    await this.request(`/wit/workitems/${workItemId}/comments?api-version=7.1-preview.4`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  }

  async createPullRequest(params: AdoCreatePrParams): Promise<AdoPullRequest> {
    const body: Record<string, unknown> = {
      sourceRefName: params.sourceRefName,
      targetRefName: params.targetRefName,
      title: params.title,
      description: params.description,
    };

    if (params.workItemIds?.length) {
      body.workItemRefs = params.workItemIds.map((id) => ({
        id: String(id),
      }));
    }

    if (params.reviewerIds?.length) {
      body.reviewers = params.reviewerIds.map((id) => ({ id }));
    }

    if (params.autoComplete) {
      body.completionOptions = {
        mergeStrategy: params.squashMerge ? 'squash' : 'noFastForward',
        deleteSourceBranch: params.deleteSourceBranch ?? true,
      };
    }

    const gitBaseUrl = `${this.orgUrl}/${this.project}/_apis/git/repositories/${params.repositoryId}`;
    return this.request<AdoPullRequest>(`${gitBaseUrl}/pullrequests?api-version=7.1`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  async setPrVote(repositoryId: string, prId: number, reviewerId: string, vote: number): Promise<void> {
    const gitBaseUrl = `${this.orgUrl}/${this.project}/_apis/git/repositories/${repositoryId}`;
    await this.request(`${gitBaseUrl}/pullrequests/${prId}/reviewers/${reviewerId}?api-version=7.1`, {
      method: 'PUT',
      body: JSON.stringify({ vote }),
    });
  }

  async completePullRequest(repositoryId: string, prId: number, squashMerge = true, deleteSourceBranch = true): Promise<void> {
    const gitBaseUrl = `${this.orgUrl}/${this.project}/_apis/git/repositories/${repositoryId}`;
    // Get current PR to get lastMergeSourceCommit
    const pr = await this.request<AdoPullRequest & { lastMergeSourceCommit?: { commitId: string } }>(
      `${gitBaseUrl}/pullrequests/${prId}?api-version=7.1`,
    );
    await this.request(`${gitBaseUrl}/pullrequests/${prId}?api-version=7.1`, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        lastMergeSourceCommit: pr.lastMergeSourceCommit,
        completionOptions: {
          mergeStrategy: squashMerge ? 'squash' : 'noFastForward',
          deleteSourceBranch,
        },
      }),
    });
  }

  async triggerPipeline(pipelineId: number, branch: string): Promise<{ id: number }> {
    return this.request<{ id: number }>(
      `${this.orgUrl}/${this.project}/_apis/pipelines/${pipelineId}/runs?api-version=7.1`,
      {
        method: 'POST',
        body: JSON.stringify({
          resources: {
            repositories: {
              self: { refName: `refs/heads/${branch}` },
            },
          },
        }),
      },
    );
  }
}
