export type IsolationTier = 'namespace' | 'namespace-dedicated-db' | 'dedicated-cluster';
export type SubscriptionPlan = 'starter' | 'growth' | 'enterprise' | 'custom';
export type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'deprovisioning';
export type VerticalType = 'frontend' | 'backend' | 'devops' | 'qa' | 'data' | 'mobile' | 'infra';

export interface TenantAdoConfig {
  orgUrl: string;
  project: string;
  pat: string;
}

export interface TenantTelegramConfig {
  botToken: string;
  ownerChatId: string;
}

export interface ResourceQuotas {
  maxAgents: number;
  maxConcurrentTasks: number;
  dailyBudgetUsd: number;
}

export interface BillingConfig {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
}

export interface TenantVertical {
  name: string;
  type: VerticalType;
  namespace: string;
  agentCount: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  isolationTier: IsolationTier;
  subscriptionPlan: SubscriptionPlan;
  status: TenantStatus;
  adoConfig: TenantAdoConfig;
  telegramConfig: TenantTelegramConfig;
  verticals: TenantVertical[];
  resourceQuotas: ResourceQuotas;
  billingConfig: BillingConfig;
  createdAt: Date;
  updatedAt: Date;
}
