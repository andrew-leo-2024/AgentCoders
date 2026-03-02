---
sidebar_position: 14
title: "@agentcoders/scm-adapters"
---

# @agentcoders/scm-adapters

Unified source control and project management adapters for Azure DevOps and GitHub.

**Entry point:** `dist/adapter-factory.js`
**Source files:** 7

## Factory Functions

```typescript
import { createScmAdapter, createProjectManagement } from '@agentcoders/scm-adapters';

// Azure DevOps
const adoScm = createScmAdapter({
  type: 'ado',
  orgUrl: 'https://dev.azure.com/myorg',
  project: 'myproject',
  pat: '<personal-access-token>'
});

// GitHub
const ghScm = createScmAdapter({
  type: 'github',
  token: '<github-token>',
  owner: 'myorg',
  repo: 'myrepo'
});

// Project Management (same config)
const pm = createProjectManagement({ type: 'ado', ... });
```

## SCM Interface

Both adapters implement `ScmProvider`:

```typescript
interface ScmProvider {
  queryWorkItems(query: string): Promise<ScmWorkItem[]>;
  getWorkItem(id: number): Promise<ScmWorkItem>;
  getWorkItems(ids: number[]): Promise<ScmWorkItem[]>;  // batch fetch
  updateWorkItem(id: number, updates: Record<string, unknown>): Promise<void>;
  createPr(options: CreatePrOptions): Promise<ScmPullRequest>;
  mergePr(id: number): Promise<void>;
  getPr(id: number): Promise<ScmPullRequest>;
  addComment(workItemId: number, text: string): Promise<void>;
}
```

## Azure DevOps Adapter

### AdoScmAdapter (`adapters/ado-adapter.ts`)

- **Query language:** WIQL (Work Item Query Language)
- **Auth:** Basic auth with PAT token (base64 encoded `:pat`)
- **API version:** v7.1
- **Batch fetch:** `getWorkItems(ids)` fetches multiple work items in a single API call
- **Field mapping:** Maps ADO field paths (e.g., `System.Title`) to `ScmWorkItem` interface
- **Error handling:** Throws on HTTP errors with status code and body

### AdoPmAdapter (`adapters/ado-pm.ts`)

Project management operations:
- Create/update work items with JSON-patch operations
- Query boards and sprints
- Link work items (parent-child, related)

## GitHub Adapter

### GitHubScmAdapter (`adapters/github-adapter.ts`)

- **Query language:** GitHub issue search syntax
- **Auth:** Token via Octokit SDK
- **Issue mapping:** Maps GitHub issues to `ScmWorkItem` interface
- **PR creation:** `octokit.pulls.create()` with branch linking
- **Repo scoping:** All queries scoped to `owner/repo`

### GitHubPmAdapter (`adapters/github-pm.ts`)

Project management operations:
- Issue creation and updates
- Label management
- Milestone tracking
- Issue/PR linking via `#` syntax

## Data Types

```typescript
interface ScmWorkItem {
  id: number;
  title: string;
  state: string;
  assignedTo?: string;
  tags?: string[];
  description?: string;
}

interface ScmPullRequest {
  id: number;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  status: string;
}

interface CreatePrOptions {
  title: string;
  sourceBranch: string;
  targetBranch: string;
  description?: string;
}
```
