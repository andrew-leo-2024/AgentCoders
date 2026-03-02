---
sidebar_position: 1
title: Database Schema
---

# Database Schema

25 tables managed by Drizzle ORM in `packages/shared/src/db/schema.ts`. All tables use UUID primary keys and include `tenantId` for multi-tenant isolation.

## Enums

| Enum | Values |
|------|--------|
| `isolationTier` | `namespace`, `namespace-dedicated-db`, `dedicated-cluster` |
| `subscriptionPlan` | `starter`, `growth`, `enterprise`, `custom` |
| `tenantStatus` | `provisioning`, `active`, `suspended`, `deprovisioning` |
| `agentRole` | `coder`, `reviewer`, `tester`, `jarvis` |
| `agentStatus` | `idle`, `polling`, `working`, `reviewing`, `blocked`, `offline`, `error` |
| `complexityTier` | `XS`, `S`, `M`, `L`, `XL` |
| `dwiStatus` | `in_progress`, `pending_review`, `approved`, `merged`, `completed`, `failed`, `reverted` |
| `invoiceStatus` | `draft`, `sent`, `paid`, `void` |
| `auditEventCategory` | `agent`, `task`, `model`, `enhancement`, `security`, `billing`, `governance` |
| `failureCategory` | `model-error`, `timeout`, `validation`, `infrastructure`, `logic`, `unknown` |
| `failurePatternStatus` | `active`, `resolved`, `suppressed` |
| `insurancePolicyType` | `sla-guarantee`, `quality-guarantee`, `uptime-guarantee`, `data-protection` |
| `insurancePolicyStatus` | `active`, `expired`, `claimed`, `suspended` |
| `memoryCategory` | `project`, `area`, `resource`, `archive` |
| `modelProvider` | `anthropic`, `openai`, `google`, `ollama` |
| `skillCategory` | `frontend`, `backend`, `devops`, `security`, `testing`, `design`, `general` |
| `managementModelType` | `spotify`, `safe`, `scrum-at-scale`, `team-topologies` |
| `routingStrategy` | `cost-optimized`, `quality-optimized`, `latency-optimized`, `round-robin` |

## Core Tables

### tenants

Root tenant table. All other tables reference this via `tenantId`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK, default random |
| `name` | varchar | Tenant display name |
| `slug` | varchar | **Unique**, URL-safe identifier |
| `isolationTier` | enum | `namespace` / `namespace-dedicated-db` / `dedicated-cluster` |
| `subscriptionPlan` | enum | `starter` / `growth` / `enterprise` / `custom` |
| `status` | enum | `provisioning` / `active` / `suspended` / `deprovisioning` |
| `adoConfig` | jsonb | Azure DevOps connection config |
| `telegramConfig` | jsonb | Telegram bot config |
| `verticals` | jsonb | Array of vertical definitions |
| `resourceQuotas` | jsonb | CPU, memory, agent limits |
| `billingConfig` | jsonb | Stripe and billing settings |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### agents

Agent pod instances.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | **Unique**, human-readable ID |
| `vertical` | varchar | e.g., `frontend`, `backend` |
| `role` | enum | `coder` / `reviewer` / `tester` / `jarvis` |
| `namespace` | varchar | K8s namespace |
| `status` | enum | `idle` / `polling` / `working` / `reviewing` / `blocked` / `offline` / `error` |
| `currentWorkItemId` | integer | Currently assigned work item |
| `currentBranch` | varchar | Current git branch |
| `lastPollAt` | timestamp | |
| `lastHeartbeatAt` | timestamp | |
| `tokensUsedToday` | bigint | Daily token counter |
| `costUsedTodayUsd` | real | Daily cost counter |
| `workItemsCompletedToday` | integer | Daily completion counter |
| `config` | jsonb | Agent-specific configuration |
| `startedAt` | timestamp | |
| `createdAt` | timestamp | |

### agentActions

Agent activity log — every action taken by an agent.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `action` | varchar | Action type |
| `workItemId` | integer | |
| `prId` | integer | |
| `details` | jsonb | Action details |
| `durationMs` | integer | |
| `tokensUsed` | integer | |
| `estimatedCostUsd` | real | |
| `createdAt` | timestamp | |

### workItemLog

Work item tracking — one record per claimed work item.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `workItemId` | integer | |
| `agentId` | varchar | |
| `title` | varchar | |
| `state` | varchar | |
| `complexityTier` | enum | XS/S/M/L/XL |
| `branchName` | varchar | |
| `claimedAt` | timestamp | |
| `completedAt` | timestamp | |
| `durationMs` | integer | |

### prLog

Pull request tracking.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `prId` | integer | |
| `workItemId` | integer | |
| `agentId` | varchar | |
| `repositoryId` | varchar | |
| `title` | varchar | |
| `sourceBranch` | varchar | |
| `targetBranch` | varchar | Default: `main` |
| `status` | varchar | Default: `active` |
| `mergedAt` | timestamp | |
| `createdAt` | timestamp | |

### claudeSessions

Claude Code session records.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `workItemId` | integer | |
| `model` | varchar | |
| `mode` | varchar | `triage` / `coding` / `review` |
| `inputTokens` | bigint | |
| `outputTokens` | bigint | |
| `estimatedCostUsd` | real | |
| `turns` | integer | |
| `durationMs` | integer | |
| `exitReason` | varchar | `completed` / `timeout` / `max-turns` / `error` / `budget` |
| `startedAt` | timestamp | |
| `completedAt` | timestamp | |

### messages

Internal messaging between agents.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `channel` | varchar | |
| `agentId` | varchar | |
| `content` | text | |
| `replyToId` | uuid | |
| `createdAt` | timestamp | |

### escalations

Escalation records.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `workItemId` | integer | |
| `subType` | varchar | `merge-conflict` / `test-failure` / `timeout` / `budget-exceeded` / `blocked` / `quality-issue` |
| `details` | jsonb | |
| `resolution` | varchar | |
| `resolvedBy` | varchar | |
| `resolvedAt` | timestamp | |
| `createdAt` | timestamp | |

### dwiRecords

Delivered Work Item billing records.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `workItemId` | integer | |
| `prId` | integer | |
| `complexityTier` | enum | |
| `priceUsd` | real | |
| `status` | enum | `in_progress` → `completed` or `reverted` |
| `workItemExists` | boolean | Gate 1 |
| `prLinked` | boolean | Gate 2 |
| `ciPassed` | boolean | Gate 3 |
| `prApproved` | boolean | Gate 4 |
| `prMerged` | boolean | Gate 5 |
| `workItemClosed` | boolean | Gate 6 |
| `isBillable` | boolean | True only when all 6 gates pass |
| `startedAt` | timestamp | |
| `completedAt` | timestamp | |
| `durationMs` | integer | |

### usageRecords

Token usage tracking per Claude session.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `sessionId` | uuid | FK → claudeSessions |
| `model` | varchar | |
| `inputTokens` | bigint | |
| `outputTokens` | bigint | |
| `estimatedCostUsd` | real | |
| `recordedAt` | timestamp | |

### subscriptions

Stripe subscription records.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants, **unique** |
| `stripeCustomerId` | varchar | |
| `stripeSubscriptionId` | varchar | |
| `plan` | varchar | |
| `status` | varchar | Default: `active` |
| `currentPeriodStart` | timestamp | |
| `currentPeriodEnd` | timestamp | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### invoices

Billing invoices.

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `stripeInvoiceId` | varchar | |
| `periodStart` | timestamp | |
| `periodEnd` | timestamp | |
| `totalDwis` | integer | |
| `totalUsd` | real | |
| `totalSavingsUsd` | real | Savings vs human equivalent |
| `lineItems` | jsonb | Itemized DWI list |
| `status` | enum | `draft` / `sent` / `paid` / `void` |
| `createdAt` | timestamp | |

## Platform Extension Tables

### auditEvents

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `eventType` | varchar | |
| `category` | enum | agent/task/model/enhancement/security/billing/governance |
| `details` | jsonb | |
| `parentEventId` | uuid | For event chaining |
| `timestamp` | timestamp | |

### telemetryRecords

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `metricName` | varchar | |
| `metricValue` | real | |
| `dimensions` | jsonb | Key-value tags |
| `recordedAt` | timestamp | |

### failurePatterns

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `patternHash` | varchar | SHA256 of signature |
| `signature` | text | `error.name: error.message` |
| `category` | enum | model-error/timeout/validation/infrastructure/logic/unknown |
| `occurrenceCount` | integer | |
| `firstSeenAt` | timestamp | |
| `lastSeenAt` | timestamp | |
| `resolution` | text | |
| `status` | enum | active/resolved/suppressed |

### insurancePolicies

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `policyType` | enum | sla/quality/uptime/data-protection |
| `coverageDetails` | jsonb | |
| `slaTargets` | jsonb | Key-value metric targets |
| `status` | enum | active/expired/claimed/suspended |
| `activatedAt` | timestamp | |
| `expiresAt` | timestamp | |

### insuranceClaims

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `policyId` | uuid | FK → insurancePolicies |
| `incidentDetails` | jsonb | |
| `resolution` | text | |
| `resolvedAt` | timestamp | |
| `createdAt` | timestamp | |

### agentMemories

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `category` | enum | project/area/resource/archive (PARA) |
| `key` | varchar | Memory identifier |
| `content` | text | |
| `relevanceScore` | real | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |
| `expiresAt` | timestamp | TTL for memory decay |

### modelRoutes

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `provider` | enum | anthropic/openai/google/ollama |
| `modelId` | varchar | |
| `capabilities` | jsonb | |
| `pricing` | jsonb | Input/output cost per 1k tokens |
| `isActive` | boolean | |
| `priority` | integer | Lower = higher priority |

### modelRouteLogs

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `routeId` | uuid | FK → modelRoutes |
| `inputTokens` | bigint | |
| `outputTokens` | bigint | |
| `latencyMs` | integer | |
| `qualityScore` | real | |
| `costUsd` | real | |
| `recordedAt` | timestamp | |

### skills

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `name` | varchar | **Unique** |
| `category` | enum | frontend/backend/devops/security/testing/design/general |
| `version` | varchar | Default: `1.0.0` |
| `description` | text | |
| `content` | text | Skill definition content |
| `isBuiltin` | boolean | |
| `createdAt` | timestamp | |

### agentSkills

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `skillId` | uuid | FK → skills |
| `activatedAt` | timestamp | |

### skillScores

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `skillId` | uuid | FK → skills |
| `taskType` | varchar | |
| `qualityDelta` | real | Quality improvement |
| `sampleCount` | integer | Number of tasks measured |
| `updatedAt` | timestamp | |

### managementConfigs

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `modelType` | enum | spotify/safe/scrum-at-scale/team-topologies |
| `topology` | jsonb | Model-specific group structure |
| `cadence` | jsonb | Cron expressions for ceremonies |
| `escalationPaths` | jsonb | Escalation routing config |

### enhancementRuns

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `workItemId` | integer | |
| `pipelineConfig` | jsonb | Stage configuration |
| `stages` | jsonb | Per-stage results |
| `finalScore` | real | |
| `durationMs` | integer | |
| `createdAt` | timestamp | |

### decisionProvenance

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | PK |
| `tenantId` | uuid | FK → tenants |
| `agentId` | varchar | |
| `workItemId` | integer | |
| `decisionType` | varchar | |
| `modelUsed` | varchar | |
| `promptHash` | varchar | |
| `contextSources` | jsonb | Array of source references |
| `confidenceScore` | real | |
| `createdAt` | timestamp | |
