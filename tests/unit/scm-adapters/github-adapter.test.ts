import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GitHubScmAdapter } from '../../../packages/scm-adapters/src/adapters/github-adapter.js';

describe('GitHubScmAdapter', () => {
  let adapter: GitHubScmAdapter;
  const mockSearchIssuesAndPullRequests = vi.fn();
  const mockIssuesGet = vi.fn();
  const mockIssuesUpdate = vi.fn();
  const mockPullsCreate = vi.fn();
  const mockPullsGet = vi.fn();
  const mockPullsMerge = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new GitHubScmAdapter('ghp_fake_token', 'myorg', 'myrepo');
    // Replace the real Octokit with a mock after construction
    (adapter as any).octokit = {
      search: { issuesAndPullRequests: mockSearchIssuesAndPullRequests },
      issues: { get: mockIssuesGet, update: mockIssuesUpdate },
      pulls: { create: mockPullsCreate, get: mockPullsGet, merge: mockPullsMerge },
    };
  });

  it('should map GitHub issues to ScmWorkItem via queryWorkItems', async () => {
    mockSearchIssuesAndPullRequests.mockResolvedValueOnce({
      data: {
        items: [
          {
            number: 42,
            title: 'Fix login form',
            state: 'open',
            assignee: { login: 'dev-agent-1' },
            labels: [{ name: 'bug' }, { name: 'priority:high' }],
            body: 'The login form crashes on empty password',
            html_url: 'https://github.com/myorg/myrepo/issues/42',
          },
          {
            number: 43,
            title: 'Add dark mode',
            state: 'open',
            assignee: null,
            labels: ['enhancement'],
            body: null,
            html_url: 'https://github.com/myorg/myrepo/issues/43',
          },
        ],
      },
    });

    const items = await adapter.queryWorkItems('is:issue state:open');

    expect(items).toHaveLength(2);

    expect(items[0]!.id).toBe(42);
    expect(items[0]!.title).toBe('Fix login form');
    expect(items[0]!.state).toBe('open');
    expect(items[0]!.assignedTo).toBe('dev-agent-1');
    expect(items[0]!.tags).toContain('bug');
    expect(items[0]!.tags).toContain('priority:high');
    expect(items[0]!.description).toBe('The login form crashes on empty password');
    expect(items[0]!.url).toContain('github.com');

    expect(items[1]!.id).toBe(43);
    expect(items[1]!.assignedTo).toBeUndefined();
    expect(items[1]!.description).toBeUndefined();
  });

  it('should scope search query to the configured repo', async () => {
    mockSearchIssuesAndPullRequests.mockResolvedValueOnce({ data: { items: [] } });

    await adapter.queryWorkItems('is:issue label:bug');

    expect(mockSearchIssuesAndPullRequests).toHaveBeenCalledWith({
      q: 'repo:myorg/myrepo is:issue label:bug',
      per_page: 100,
    });
  });

  it('should call octokit.pulls.create when creating a PR', async () => {
    mockPullsCreate.mockResolvedValueOnce({
      data: {
        number: 10,
        title: 'feat: add dark mode',
        head: { ref: 'feature/dark-mode' },
        base: { ref: 'main' },
        state: 'open',
        merged: false,
        html_url: 'https://github.com/myorg/myrepo/pull/10',
      },
    });

    const pr = await adapter.createPr(
      'feat: add dark mode',
      'feature/dark-mode',
      'main',
      [42, 43],
    );

    expect(mockPullsCreate).toHaveBeenCalledWith({
      owner: 'myorg',
      repo: 'myrepo',
      title: 'feat: add dark mode',
      head: 'feature/dark-mode',
      base: 'main',
      body: expect.stringContaining('#42'),
    });

    expect(pr.id).toBe(10);
    expect(pr.title).toBe('feat: add dark mode');
    expect(pr.sourceBranch).toBe('feature/dark-mode');
    expect(pr.targetBranch).toBe('main');
    expect(pr.status).toBe('active');
    expect(pr.workItemIds).toEqual([42, 43]);
    expect(pr.url).toContain('github.com');
  });

  it('should return empty array when no issues match the query', async () => {
    mockSearchIssuesAndPullRequests.mockResolvedValueOnce({ data: { items: [] } });

    const items = await adapter.queryWorkItems('is:issue label:nonexistent');

    expect(items).toHaveLength(0);
  });
});
