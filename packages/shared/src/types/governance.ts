// Governance types — audit, telemetry, failure patterns, AI-insurance, provenance

export type AuditEventCategory = 'agent' | 'task' | 'model' | 'enhancement' | 'security' | 'billing' | 'governance';

export interface AuditEvent {
  id: string;
  tenantId: string;
  agentId: string;
  eventType: string;
  category: AuditEventCategory;
  details: Record<string, unknown>;
  parentEventId?: string;
  timestamp: Date;
}

export interface TelemetryRecord {
  id: string;
  tenantId: string;
  agentId: string;
  metricName: string;
  metricValue: number;
  dimensions: Record<string, string>;
  recordedAt: Date;
}

export type FailurePatternStatus = 'active' | 'resolved' | 'suppressed';
export type FailureCategory = 'model-error' | 'timeout' | 'validation' | 'infrastructure' | 'logic' | 'unknown';

export interface FailurePattern {
  id: string;
  tenantId: string;
  patternHash: string;
  signature: string;
  category: FailureCategory;
  occurrenceCount: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  resolution?: string;
  status: FailurePatternStatus;
}

export type InsurancePolicyType = 'sla-guarantee' | 'quality-guarantee' | 'uptime-guarantee' | 'data-protection';
export type InsurancePolicyStatus = 'active' | 'expired' | 'claimed' | 'suspended';

export interface InsurancePolicy {
  id: string;
  tenantId: string;
  policyType: InsurancePolicyType;
  coverageDetails: Record<string, unknown>;
  slaTargets: Record<string, number>;
  status: InsurancePolicyStatus;
  activatedAt: Date;
  expiresAt: Date;
}

export interface InsuranceClaim {
  id: string;
  tenantId: string;
  policyId: string;
  incidentDetails: Record<string, unknown>;
  resolution?: string;
  resolvedAt?: Date;
  createdAt: Date;
}

export interface DecisionProvenance {
  id: string;
  tenantId: string;
  agentId: string;
  workItemId?: number;
  decisionType: string;
  modelUsed: string;
  promptHash: string;
  contextSources: string[];
  confidenceScore: number;
}

export interface AuthorityGrant {
  agentId: string;
  tenantId: string;
  scope: string;
  grantedAt: Date;
  expiresAt: Date;
  grantedBy: string;
  autoRevoke: boolean;
}
