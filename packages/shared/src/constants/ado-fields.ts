// Standard Azure DevOps work item field paths

export const AdoFields = {
  Id: 'System.Id',
  Title: 'System.Title',
  State: 'System.State',
  WorkItemType: 'System.WorkItemType',
  AssignedTo: 'System.AssignedTo',
  Description: 'System.Description',
  Tags: 'System.Tags',
  Priority: 'Microsoft.VSTS.Common.Priority',
  StoryPoints: 'Microsoft.VSTS.Scheduling.StoryPoints',
  AreaPath: 'System.AreaPath',
  IterationPath: 'System.IterationPath',
  Reason: 'System.Reason',
  CreatedDate: 'System.CreatedDate',
  ChangedDate: 'System.ChangedDate',
  CommentCount: 'System.CommentCount',
} as const;

// Work item states
export const WiStates = {
  New: 'New',
  Active: 'Active',
  Resolved: 'Resolved',
  Closed: 'Closed',
  Removed: 'Removed',
} as const;

// Tags used by agents
export const AgentTags = {
  AiClaimed: 'ai-claimed',
  AiCompleted: 'ai-completed',
  AiBlocked: 'ai-blocked',
  AiEscalated: 'ai-escalated',
  AiReviewNeeded: 'ai-review-needed',
} as const;
