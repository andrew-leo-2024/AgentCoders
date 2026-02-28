import type { ComplexityTier } from './agent.js';

export type DwiStatus = 'in_progress' | 'pending_review' | 'approved' | 'merged' | 'completed' | 'failed' | 'reverted';

export interface DwiRecord {
  id: string;
  tenantId: string;
  agentId: string;
  workItemId: number;
  prId: number | null;
  complexityTier: ComplexityTier;
  priceUsd: number;
  status: DwiStatus;
  workItemExists: boolean;
  prLinked: boolean;
  ciPassed: boolean;
  prApproved: boolean;
  prMerged: boolean;
  workItemClosed: boolean;
  isBillable: boolean;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface UsageRecord {
  id: string;
  tenantId: string;
  agentId: string;
  sessionId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
  recordedAt: Date;
}

export interface InvoiceLineItem {
  dwiId: string;
  workItemTitle: string;
  complexityTier: ComplexityTier;
  priceUsd: number;
  humanEquivalentUsd: string;
}

export interface Invoice {
  id: string;
  tenantId: string;
  stripeInvoiceId: string;
  periodStart: Date;
  periodEnd: Date;
  totalDwis: number;
  totalUsd: number;
  totalSavingsUsd: number;
  lineItems: InvoiceLineItem[];
  status: 'draft' | 'sent' | 'paid' | 'void';
  createdAt: Date;
}

export interface BudgetState {
  tenantId: string;
  agentId: string;
  dailySpentUsd: number;
  dailyLimitUsd: number;
  monthlySpentUsd: number;
  monthlyLimitUsd: number;
  isOverBudget: boolean;
}
