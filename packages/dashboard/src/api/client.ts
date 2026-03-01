const BASE_URL = '/api';

// --- Interfaces ---

export interface AuditEvent {
  id: string;
  tenantId: string;
  agentId: string;
  eventType: string;
  category: string;
  details: string;
  timestamp: string;
  immutable: boolean;
}

export interface TelemetryRecord {
  id: string;
  tenantId: string;
  agentId: string;
  metricName: string;
  metricValue: number;
  unit: string;
  tags: Record<string, string>;
  recordedAt: string;
}

export interface FailurePattern {
  id: string;
  tenantId: string;
  signature: string;
  category: string;
  occurrenceCount: number;
  status: 'active' | 'resolved' | 'suppressed';
  firstSeen: string;
  lastSeen: string;
  resolution: string | null;
  affectedAgents: string[];
}

export interface ModelRoute {
  id: string;
  tenantId: string;
  provider: string;
  modelId: string;
  priority: number;
  isActive: boolean;
  costPerInputToken: number;
  costPerOutputToken: number;
  maxTokens: number;
  tags: string[];
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  version: string;
  description: string;
  inputSchema: Record<string, unknown>;
  isEnabled: boolean;
  createdAt: string;
}

export interface ManagementGroup {
  id: string;
  name: string;
  parentId: string | null;
  agents: string[];
  escalationPath: string[];
}

export interface ManagementConfig {
  tenantId: string;
  modelType: string;
  groups: ManagementGroup[];
  cadence: {
    standupCron: string;
    reviewCron: string;
    planningCron: string;
  };
  escalationPolicies: {
    level: number;
    target: string;
    timeoutMinutes: number;
  }[];
}

export interface EnhancementStage {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped';
  score: number | null;
  durationMs: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

export interface EnhancementRun {
  id: string;
  tenantId: string;
  agentId: string;
  workItemId: string;
  status: 'queued' | 'running' | 'passed' | 'failed';
  stages: EnhancementStage[];
  overallScore: number | null;
  startedAt: string;
  completedAt: string | null;
}

export interface InsuranceClaim {
  id: string;
  reason: string;
  amount: number;
  status: 'pending' | 'approved' | 'denied' | 'paid';
  filedAt: string;
  resolvedAt: string | null;
}

export interface InsurancePolicy {
  id: string;
  tenantId: string;
  policyType: string;
  coverageLimit: number;
  premiumMonthly: number;
  slaTarget: number;
  slaActual: number;
  isCompliant: boolean;
  activeSince: string;
  claims: InsuranceClaim[];
}

// --- Fetch helper ---

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

// --- API client ---

export const api = {
  getAuditEvents: (tenantId: string) =>
    fetchJson<AuditEvent[]>(`/tenants/${tenantId}/audit`),
  getTelemetry: (tenantId: string) =>
    fetchJson<TelemetryRecord[]>(`/tenants/${tenantId}/telemetry`),
  getFailurePatterns: (tenantId: string) =>
    fetchJson<FailurePattern[]>(`/tenants/${tenantId}/failure-patterns`),
  getModelRoutes: (tenantId: string) =>
    fetchJson<ModelRoute[]>(`/tenants/${tenantId}/model-routes`),
  getSkills: () =>
    fetchJson<Skill[]>('/skills'),
  getManagementConfig: (tenantId: string) =>
    fetchJson<ManagementConfig>(`/tenants/${tenantId}/management`),
  getEnhancementRuns: (tenantId: string) =>
    fetchJson<EnhancementRun[]>(`/tenants/${tenantId}/enhancements`),
  getInsurancePolicies: (tenantId: string) =>
    fetchJson<InsurancePolicy[]>(`/tenants/${tenantId}/insurance`),
};
