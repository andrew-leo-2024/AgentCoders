// SCM Provider types — backend abstraction for ADO/GitHub

export type ScmProviderType = 'ado' | 'github';

export interface ScmWorkItem {
  id: number;
  title: string;
  state: string;
  assignedTo?: string;
  tags: string[];
  description?: string;
  url: string;
}

export interface ScmPullRequest {
  id: number;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'active' | 'completed' | 'abandoned';
  workItemIds: number[];
  url: string;
}

export interface ScmProvider {
  type: ScmProviderType;
  queryWorkItems(query: string): Promise<ScmWorkItem[]>;
  getWorkItem(id: number): Promise<ScmWorkItem>;
  updateWorkItem(id: number, updates: Partial<ScmWorkItem>): Promise<void>;
  createPr(title: string, sourceBranch: string, targetBranch: string, workItemIds: number[]): Promise<ScmPullRequest>;
  mergePr(prId: number): Promise<void>;
  getPr(prId: number): Promise<ScmPullRequest>;
}

export interface ScmProviderConfig {
  type: ScmProviderType;
  orgUrl?: string;
  project?: string;
  pat?: string;
  token?: string;
  owner?: string;
  repo?: string;
}

export interface ProjectManagement {
  createTask(title: string, description: string, assignee?: string): Promise<ScmWorkItem>;
  updateTask(id: number, updates: Partial<ScmWorkItem>): Promise<void>;
  queryTasks(filter: string): Promise<ScmWorkItem[]>;
  getTask(id: number): Promise<ScmWorkItem>;
}
