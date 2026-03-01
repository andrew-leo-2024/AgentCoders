import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { AdoScmAdapter } from '../../../packages/scm-adapters/src/adapters/ado-adapter.js';

function jsonResponse(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    headers: new Headers(),
    redirected: false,
    statusText: 'OK',
    type: 'basic',
    url: '',
    clone: () => jsonResponse(data, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: async () => new ArrayBuffer(0),
    blob: async () => new Blob(),
    formData: async () => new FormData(),
  } as Response;
}

describe('AdoScmAdapter', () => {
  let adapter: AdoScmAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new AdoScmAdapter(
      'https://dev.azure.com/myorg',
      'MyProject',
      'fake-pat-token',
    );
  });

  it('should call ADO WIQL API via queryWorkItems', async () => {
    // First call: WIQL query returns work item IDs
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        workItems: [
          { id: 100, url: 'https://dev.azure.com/...' },
          { id: 101, url: 'https://dev.azure.com/...' },
        ],
      }),
    );

    // Second call: batch get work items by IDs
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        value: [
          {
            id: 100,
            fields: {
              'System.Title': 'Fix auth bug',
              'System.State': 'New',
              'System.AssignedTo': { displayName: 'Agent Alpha' },
              'System.Tags': 'bug; priority:high',
              'System.Description': 'Auth module is broken',
            },
            url: 'https://dev.azure.com/myorg/MyProject/_apis/wit/workitems/100',
          },
          {
            id: 101,
            fields: {
              'System.Title': 'Add logging',
              'System.State': 'Active',
              'System.AssignedTo': null,
              'System.Tags': '',
              'System.Description': null,
            },
            url: 'https://dev.azure.com/myorg/MyProject/_apis/wit/workitems/101',
          },
        ],
      }),
    );

    const wiql = "SELECT [System.Id] FROM WorkItems WHERE [System.State] = 'New'";
    const items = await adapter.queryWorkItems(wiql);

    // Verify WIQL API was called
    expect(mockFetch).toHaveBeenCalledTimes(2);
    const [wiqlUrl, wiqlOpts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(wiqlUrl).toContain('/_apis/wit/wiql');
    expect(wiqlUrl).toContain('api-version=');
    expect(wiqlOpts.method).toBe('POST');
    const wiqlBody = JSON.parse(wiqlOpts.body as string);
    expect(wiqlBody.query).toBe(wiql);

    // Verify results
    expect(items).toHaveLength(2);

    expect(items[0]!.id).toBe(100);
    expect(items[0]!.title).toBe('Fix auth bug');
    expect(items[0]!.state).toBe('New');
    expect(items[0]!.assignedTo).toBe('Agent Alpha');
    expect(items[0]!.tags).toContain('bug');
    expect(items[0]!.tags).toContain('priority:high');

    expect(items[1]!.id).toBe(101);
    expect(items[1]!.title).toBe('Add logging');
    expect(items[1]!.assignedTo).toBeUndefined();
  });

  it('should map ADO fields to ScmWorkItem via getWorkItem', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 200,
        fields: {
          'System.Title': 'Implement caching',
          'System.State': 'Active',
          'System.AssignedTo': { displayName: 'Agent Beta' },
          'System.Tags': 'feature; sprint-5',
          'System.Description': 'Add Redis caching layer',
        },
        url: 'https://dev.azure.com/myorg/MyProject/_apis/wit/workitems/200',
      }),
    );

    const item = await adapter.getWorkItem(200);

    expect(item.id).toBe(200);
    expect(item.title).toBe('Implement caching');
    expect(item.state).toBe('Active');
    expect(item.assignedTo).toBe('Agent Beta');
    expect(item.tags).toEqual(['feature', 'sprint-5']);
    expect(item.description).toBe('Add Redis caching layer');

    // Verify the URL was correct
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain('/_apis/wit/workitems/200');
    expect(url).toContain('api-version=');
  });

  it('should return empty array when WIQL returns no work items', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ workItems: [] }),
    );

    const items = await adapter.queryWorkItems("SELECT [System.Id] FROM WorkItems WHERE 1=0");

    expect(items).toHaveLength(0);
    // Should only make the WIQL call, not a batch fetch
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw on HTTP error responses', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ message: 'Unauthorized' }, 401),
    );

    await expect(
      adapter.getWorkItem(999),
    ).rejects.toThrow(/ADO API error 401/);
  });

  it('should include Authorization header with base64-encoded PAT', async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({
        id: 1,
        fields: { 'System.Title': 'test', 'System.State': 'New' },
        url: 'test',
      }),
    );

    await adapter.getWorkItem(1);

    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers['Authorization']).toMatch(/^Basic /);
    // Decode and verify it contains the PAT
    const decoded = Buffer.from(headers['Authorization'].replace('Basic ', ''), 'base64').toString();
    expect(decoded).toBe(':fake-pat-token');
  });
});
