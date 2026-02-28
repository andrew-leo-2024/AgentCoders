import type { ComplexityTier, AgentStatus } from './agent.js';

// Discriminated union for all Redis messages
export type RedisMessage =
  | EscalationMessage
  | ReviewRequestMessage
  | SquadChatMessage
  | TaskAssignmentMessage
  | StatusUpdateMessage
  | ProgressUpdateMessage
  | TelegramInboundMessage
  | TelegramOutboundMessage
  | TelegramDecisionMessage
  | CrossVerticalRequestMessage
  | CrossVerticalCompletedMessage
  | HeartbeatMessage
  | BudgetAlertMessage;

export interface EscalationMessage {
  type: 'escalation';
  subType: 'merge-conflict' | 'test-failure' | 'timeout' | 'budget-exceeded' | 'blocked' | 'quality-issue';
  agentId: string;
  tenantId: string;
  workItemId: number;
  details: string;
  timestamp: string;
}

export interface ReviewRequestMessage {
  type: 'review-request';
  agentId: string;
  tenantId: string;
  prId: number;
  workItemId: number;
  repositoryId: string;
  timestamp: string;
}

export interface SquadChatMessage {
  type: 'squad-chat';
  agentId: string;
  tenantId: string;
  content: string;
  replyTo?: string;
  timestamp: string;
}

export interface TaskAssignmentMessage {
  type: 'task-assignment';
  targetAgentId: string;
  tenantId: string;
  workItemId: number;
  complexityTier: ComplexityTier;
  instructions?: string;
  timestamp: string;
}

export interface StatusUpdateMessage {
  type: 'status-update';
  agentId: string;
  tenantId: string;
  status: AgentStatus;
  workItemId?: number;
  details?: string;
  timestamp: string;
}

export interface ProgressUpdateMessage {
  type: 'progress-update';
  agentId: string;
  tenantId: string;
  workItemId: number;
  phase: 'branching' | 'coding' | 'testing' | 'committing' | 'pushing' | 'pr-creating' | 'done';
  details: string;
  tokensUsed?: number;
  timestamp: string;
}

export interface TelegramInboundMessage {
  type: 'telegram-inbound';
  tenantId: string;
  chatId: string;
  text: string;
  targetVertical?: string;
  timestamp: string;
}

export interface TelegramOutboundMessage {
  type: 'telegram-outbound';
  tenantId: string;
  chatId: string;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  inlineKeyboard?: Array<Array<{ text: string; callback_data: string }>>;
  timestamp: string;
}

export interface TelegramDecisionMessage {
  type: 'telegram-decision';
  tenantId: string;
  action: 'approve' | 'reject' | 'defer';
  itemId: string;
  chatId: string;
  timestamp: string;
}

export interface CrossVerticalRequestMessage {
  type: 'cross-vertical-request';
  tenantId: string;
  fromVertical: string;
  requestType: string;
  workItemId: number;
  details: string;
  timestamp: string;
}

export interface CrossVerticalCompletedMessage {
  type: 'cross-vertical-completed';
  tenantId: string;
  fromVertical: string;
  workItemId: number;
  result: 'success' | 'failure';
  details: string;
  timestamp: string;
}

export interface HeartbeatMessage {
  type: 'heartbeat';
  agentId: string;
  tenantId: string;
  status: AgentStatus;
  currentWorkItemId?: number;
  timestamp: string;
}

export interface BudgetAlertMessage {
  type: 'budget-alert';
  agentId: string;
  tenantId: string;
  alertType: 'warning-80pct' | 'exceeded' | 'session-limit';
  dailySpentUsd: number;
  dailyLimitUsd: number;
  timestamp: string;
}
