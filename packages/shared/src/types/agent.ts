import type { VerticalType } from './tenant.js';

export type AgentRole = 'coder' | 'reviewer' | 'tester' | 'jarvis';
export type AgentStatus = 'idle' | 'polling' | 'working' | 'reviewing' | 'blocked' | 'offline' | 'error';

export interface AgentConfig {
  agentId: string;
  tenantId: string;
  vertical: VerticalType;
  role: AgentRole;
  namespace: string;
  pollIntervalMs: number;
  maxTurnsCoding: number;
  maxTurnsReview: number;
  claudeCodeTimeoutMs: number;
  dailyBudgetUsd: number;
  monthlyBudgetUsd: number;
}

export interface AgentState {
  agentId: string;
  tenantId: string;
  status: AgentStatus;
  currentWorkItemId: number | null;
  currentBranch: string | null;
  lastPollAt: Date | null;
  lastHeartbeatAt: Date;
  tokensUsedToday: number;
  costUsedTodayUsd: number;
  workItemsCompletedToday: number;
  startedAt: Date;
}

export type ComplexityTier = 'XS' | 'S' | 'M' | 'L' | 'XL';

export const COMPLEXITY_PRICING: Record<ComplexityTier, number> = {
  XS: 5,
  S: 15,
  M: 50,
  L: 150,
  XL: 500,
};

export const COMPLEXITY_TIMEOUTS_MS: Record<ComplexityTier, number> = {
  XS: 5 * 60_000,
  S: 15 * 60_000,
  M: 30 * 60_000,
  L: 45 * 60_000,
  XL: 60 * 60_000,
};

export const COMPLEXITY_HUMAN_EQUIVALENT: Record<ComplexityTier, string> = {
  XS: '$50-100',
  S: '$200-400',
  M: '$800-2,000',
  L: '$2,000-5,000',
  XL: '$5,000-15,000',
};
