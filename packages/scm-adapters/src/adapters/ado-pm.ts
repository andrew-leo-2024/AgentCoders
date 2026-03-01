import type {
  ProjectManagement,
  ScmWorkItem,
  AdoWorkItemFields,
  AdoPatchOperation,
  WiqlQueryResult,
} from '@agentcoders/shared';

const ADO_API_VERSION = '7.1';

export class AdoProjectManagement implements ProjectManagement {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(
    orgUrl: string,
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

  async createTask(
    title: string,
    description: string,
    assignee?: string,
  ): Promise<ScmWorkItem> {
    const ops: AdoPatchOperation[] = [
      { op: 'add', path: '/fields/System.Title', value: title },
      { op: 'add', path: '/fields/System.Description', value: description },
    ];

    if (assignee) {
      ops.push({ op: 'add', path: '/fields/System.AssignedTo', value: assignee });
    }

    const wi = await this.request<{
      id: number;
      fields: AdoWorkItemFields;
      url: string;
    }>('/_apis/wit/workitems/$Task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(ops),
    });

    return this.mapWorkItem(wi);
  }

  async updateTask(
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

  async queryTasks(filter: string): Promise<ScmWorkItem[]> {
    const wiql = `SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] = 'Task' AND ${filter} ORDER BY [System.ChangedDate] DESC`;

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
    const idsParam = ids.slice(0, 200).join(',');

    const batchResult = await this.request<{
      value: Array<{ id: number; fields: AdoWorkItemFields; url: string }>;
    }>(`/_apis/wit/workitems?ids=${idsParam}&$expand=none`);

    return batchResult.value.map((wi) => this.mapWorkItem(wi));
  }

  async getTask(id: number): Promise<ScmWorkItem> {
    const wi = await this.request<{
      id: number;
      fields: AdoWorkItemFields;
      url: string;
    }>(`/_apis/wit/workitems/${id}`);

    return this.mapWorkItem(wi);
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
}
