export interface AdoWorkItem {
  id: number;
  rev: number;
  fields: Record<string, unknown>;
  url: string;
}

export interface AdoWorkItemFields {
  'System.Id': number;
  'System.Title': string;
  'System.State': string;
  'System.WorkItemType': string;
  'System.AssignedTo'?: { displayName: string; uniqueName: string };
  'System.Description'?: string;
  'System.Tags'?: string;
  'Microsoft.VSTS.Common.Priority'?: number;
  'Microsoft.VSTS.Scheduling.StoryPoints'?: number;
  'System.AreaPath'?: string;
  'System.IterationPath'?: string;
}

export interface AdoPatchOperation {
  op: 'add' | 'replace' | 'remove' | 'test';
  path: string;
  value?: unknown;
}

export interface AdoPullRequest {
  pullRequestId: number;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'abandoned';
  sourceRefName: string;
  targetRefName: string;
  repository: { id: string; name: string };
  createdBy: { displayName: string; uniqueName: string };
  mergeStatus?: string;
  url: string;
}

export interface AdoCreatePrParams {
  repositoryId: string;
  sourceRefName: string;
  targetRefName: string;
  title: string;
  description: string;
  workItemIds?: number[];
  reviewerIds?: string[];
  autoComplete?: boolean;
  squashMerge?: boolean;
  deleteSourceBranch?: boolean;
}

export interface AdoPipelineRun {
  id: number;
  name: string;
  state: 'unknown' | 'inProgress' | 'completed' | 'canceling';
  result?: 'unknown' | 'succeeded' | 'failed' | 'canceled';
  url: string;
}

export interface WiqlQueryResult {
  workItems: Array<{ id: number; url: string }>;
}
