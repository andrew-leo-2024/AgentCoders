import { pgTable, uuid, varchar, text, integer, boolean, timestamp, jsonb, real, bigint, pgEnum } from 'drizzle-orm/pg-core';

// Enums
export const isolationTierEnum = pgEnum('isolation_tier', ['namespace', 'namespace-dedicated-db', 'dedicated-cluster']);
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['starter', 'growth', 'enterprise', 'custom']);
export const tenantStatusEnum = pgEnum('tenant_status', ['provisioning', 'active', 'suspended', 'deprovisioning']);
export const agentRoleEnum = pgEnum('agent_role', ['coder', 'reviewer', 'tester', 'jarvis']);
export const agentStatusEnum = pgEnum('agent_status', ['idle', 'polling', 'working', 'reviewing', 'blocked', 'offline', 'error']);
export const complexityTierEnum = pgEnum('complexity_tier', ['XS', 'S', 'M', 'L', 'XL']);
export const dwiStatusEnum = pgEnum('dwi_status', ['in_progress', 'pending_review', 'approved', 'merged', 'completed', 'failed', 'reverted']);
export const invoiceStatusEnum = pgEnum('invoice_status', ['draft', 'sent', 'paid', 'void']);

// Tenants
export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  isolationTier: isolationTierEnum('isolation_tier').notNull().default('namespace'),
  subscriptionPlan: subscriptionPlanEnum('subscription_plan').notNull().default('starter'),
  status: tenantStatusEnum('status').notNull().default('provisioning'),
  adoConfig: jsonb('ado_config').$type<{ orgUrl: string; project: string; pat: string }>(),
  telegramConfig: jsonb('telegram_config').$type<{ botToken: string; ownerChatId: string }>(),
  verticals: jsonb('verticals').$type<Array<{ name: string; type: string; namespace: string; agentCount: number }>>().default([]),
  resourceQuotas: jsonb('resource_quotas').$type<{ maxAgents: number; maxConcurrentTasks: number; dailyBudgetUsd: number }>().notNull(),
  billingConfig: jsonb('billing_config').$type<{ stripeCustomerId: string; stripeSubscriptionId: string }>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Agents
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  agentId: varchar('agent_id', { length: 100 }).notNull().unique(),
  vertical: varchar('vertical', { length: 50 }).notNull(),
  role: agentRoleEnum('role').notNull().default('coder'),
  namespace: varchar('namespace', { length: 255 }).notNull(),
  status: agentStatusEnum('status').notNull().default('offline'),
  currentWorkItemId: integer('current_work_item_id'),
  currentBranch: varchar('current_branch', { length: 255 }),
  lastPollAt: timestamp('last_poll_at'),
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
  tokensUsedToday: bigint('tokens_used_today', { mode: 'number' }).notNull().default(0),
  costUsedTodayUsd: real('cost_used_today_usd').notNull().default(0),
  workItemsCompletedToday: integer('work_items_completed_today').notNull().default(0),
  config: jsonb('config').$type<{
    pollIntervalMs: number;
    maxTurnsCoding: number;
    maxTurnsReview: number;
    claudeCodeTimeoutMs: number;
    dailyBudgetUsd: number;
    monthlyBudgetUsd: number;
  }>().notNull(),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Agent Actions (audit log)
export const agentActions = pgTable('agent_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  action: varchar('action', { length: 100 }).notNull(),
  workItemId: integer('work_item_id'),
  prId: integer('pr_id'),
  details: jsonb('details'),
  durationMs: integer('duration_ms'),
  tokensUsed: integer('tokens_used'),
  estimatedCostUsd: real('estimated_cost_usd'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Work Item Log
export const workItemLog = pgTable('work_item_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  workItemId: integer('work_item_id').notNull(),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  title: text('title').notNull(),
  state: varchar('state', { length: 50 }).notNull(),
  complexityTier: complexityTierEnum('complexity_tier'),
  branchName: varchar('branch_name', { length: 255 }),
  claimedAt: timestamp('claimed_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
});

// PR Log
export const prLog = pgTable('pr_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  prId: integer('pr_id').notNull(),
  workItemId: integer('work_item_id').notNull(),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  repositoryId: varchar('repository_id', { length: 100 }).notNull(),
  title: text('title').notNull(),
  sourceBranch: varchar('source_branch', { length: 255 }).notNull(),
  targetBranch: varchar('target_branch', { length: 255 }).notNull().default('main'),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  mergedAt: timestamp('merged_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Claude Sessions
export const claudeSessions = pgTable('claude_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  workItemId: integer('work_item_id'),
  model: varchar('model', { length: 100 }).notNull(),
  mode: varchar('mode', { length: 20 }).notNull(), // 'triage' | 'coding' | 'review'
  inputTokens: bigint('input_tokens', { mode: 'number' }).notNull().default(0),
  outputTokens: bigint('output_tokens', { mode: 'number' }).notNull().default(0),
  estimatedCostUsd: real('estimated_cost_usd').notNull().default(0),
  turns: integer('turns').notNull().default(0),
  durationMs: integer('duration_ms'),
  exitReason: varchar('exit_reason', { length: 50 }), // 'completed' | 'timeout' | 'max-turns' | 'error' | 'budget'
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
});

// Messages (squad chat)
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  channel: varchar('channel', { length: 255 }).notNull(),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  content: text('content').notNull(),
  replyToId: uuid('reply_to_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Escalations
export const escalations = pgTable('escalations', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  workItemId: integer('work_item_id'),
  subType: varchar('sub_type', { length: 50 }).notNull(),
  details: text('details').notNull(),
  resolution: text('resolution'),
  resolvedBy: varchar('resolved_by', { length: 100 }),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// DWI Records (billing)
export const dwiRecords = pgTable('dwi_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  workItemId: integer('work_item_id').notNull(),
  prId: integer('pr_id'),
  complexityTier: complexityTierEnum('complexity_tier').notNull(),
  priceUsd: real('price_usd').notNull(),
  status: dwiStatusEnum('status').notNull().default('in_progress'),
  workItemExists: boolean('work_item_exists').notNull().default(true),
  prLinked: boolean('pr_linked').notNull().default(false),
  ciPassed: boolean('ci_passed').notNull().default(false),
  prApproved: boolean('pr_approved').notNull().default(false),
  prMerged: boolean('pr_merged').notNull().default(false),
  workItemClosed: boolean('work_item_closed').notNull().default(false),
  isBillable: boolean('is_billable').notNull().default(false),
  startedAt: timestamp('started_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  durationMs: integer('duration_ms'),
});

// Usage Records (internal cost tracking — AWU)
export const usageRecords = pgTable('usage_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  agentId: varchar('agent_id', { length: 100 }).notNull(),
  sessionId: uuid('session_id').references(() => claudeSessions.id),
  model: varchar('model', { length: 100 }).notNull(),
  inputTokens: bigint('input_tokens', { mode: 'number' }).notNull(),
  outputTokens: bigint('output_tokens', { mode: 'number' }).notNull(),
  estimatedCostUsd: real('estimated_cost_usd').notNull(),
  recordedAt: timestamp('recorded_at').notNull().defaultNow(),
});

// Subscriptions
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id).unique(),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  plan: subscriptionPlanEnum('plan').notNull(),
  status: varchar('status', { length: 50 }).notNull().default('active'),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// Invoices
export const invoices = pgTable('invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  stripeInvoiceId: varchar('stripe_invoice_id', { length: 255 }),
  periodStart: timestamp('period_start').notNull(),
  periodEnd: timestamp('period_end').notNull(),
  totalDwis: integer('total_dwis').notNull().default(0),
  totalUsd: real('total_usd').notNull().default(0),
  totalSavingsUsd: real('total_savings_usd').notNull().default(0),
  lineItems: jsonb('line_items').$type<Array<{
    dwiId: string;
    workItemTitle: string;
    complexityTier: string;
    priceUsd: number;
    humanEquivalentUsd: string;
  }>>().default([]),
  status: invoiceStatusEnum('status').notNull().default('draft'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
