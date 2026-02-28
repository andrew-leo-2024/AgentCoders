import {
  retry,
  type Logger,
  type AdoWorkItem,
  type AdoPatchOperation,
  type WiqlQueryResult,
} from '@agentcoders/shared';

/**
 * Lightweight ADO client for Jarvis.
 * Mirrors the agent-runtime AdoClient but only includes methods needed by Jarvis.
 */
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

  async createWorkItem(type: string, operations: AdoPatchOperation[]): Promise<AdoWorkItem> {
    return this.request<AdoWorkItem>(`/wit/workitems/$${type}?api-version=7.1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json-patch+json' },
      body: JSON.stringify(operations),
    });
  }

  async updateWorkItem(id: number, operations: AdoPatchOperation[]): Promise<AdoWorkItem> {
    return this.request<AdoWorkItem>(`/wit/workitems/${id}?api-version=7.1`, {
      method: 'PATCH',
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
}
