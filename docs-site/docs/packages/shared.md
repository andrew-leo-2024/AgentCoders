---
sidebar_position: 1
title: "@agentcoders/shared"
---

# @agentcoders/shared

Foundation package providing types, database schema, utilities, and constants shared across all services.

**Entry point:** `dist/index.js`

## Types

### Agent Types (`types/agent.ts`)

```typescript
type AgentRole = 'coder' | 'reviewer' | 'tester' | 'jarvis';

type AgentStatus = 'idle' | 'polling' | 'working' | 'reviewing' | 'blocked' | 'offline' | 'error';

type ComplexityTier = 'XS' | 'S' | 'M' | 'L' | 'XL';

interface ComplexityConfig {
  tier: ComplexityTier;
  priceUsd: number;
  timeoutMs: number;
  humanEquivalentRange: string;
}
```

**Complexity pricing table:**

| Tier | Price | Timeout | Human Equivalent |
|------|-------|---------|-----------------|
| XS | $5 | 5 min | $50–100 |
| S | $15 | 15 min | $200–400 |
| M | $50 | 30 min | $800–2,000 |
| L | $150 | 45 min | $2,000–5,000 |
| XL | $500 | 60 min | $5,000–15,000 |

### Billing Types (`types/billing.ts`)

```typescript
type DwiStatus = 'in_progress' | 'pending_review' | 'approved' | 'merged' | 'completed' | 'failed' | 'reverted';

interface DwiRecord { ... }
interface Invoice { ... }
interface UsageRecord { ... }
```

### Tenant Types (`types/tenant.ts`)

```typescript
type IsolationTier = 'namespace' | 'namespace-dedicated-db' | 'dedicated-cluster';
type SubscriptionPlan = 'starter' | 'growth' | 'enterprise' | 'custom';
type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'deprovisioning';

interface Tenant { ... }
interface TenantSignup { ... }
```

### SCM Types (`types/scm-provider.ts`)

```typescript
type ScmProviderType = 'ado' | 'github';

interface ScmWorkItem {
  id: number;
  title: string;
  state: string;
  assignedTo?: string;
  tags?: string[];
  description?: string;
}

interface ScmPullRequest {
  id: number;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  status: string;
}

interface ScmProvider {
  queryWorkItems(query: string): Promise<ScmWorkItem[]>;
  getWorkItem(id: number): Promise<ScmWorkItem>;
  updateWorkItem(id: number, updates: Record<string, unknown>): Promise<void>;
  createPr(options: CreatePrOptions): Promise<ScmPullRequest>;
  mergePr(id: number): Promise<void>;
  getPr(id: number): Promise<ScmPullRequest>;
}
```

### Redis Message Types (`types/redis-messages.ts`)

Discriminated union for all Redis pub/sub messages:

```typescript
type RedisMessage =
  | HeartbeatMessage          // type: 'heartbeat'
  | EscalationMessage         // type: 'escalation'
  | ProgressUpdateMessage     // type: 'progress-update'
  | StatusUpdateMessage       // type: 'status-update'
  | TelegramInboundMessage    // type: 'telegram-inbound'
  | TelegramOutboundMessage   // type: 'telegram-outbound'
  | TelegramDecisionMessage   // type: 'telegram-decision'
```

### Additional Type Files

| File | Types |
|------|-------|
| `types/ado.ts` | Azure DevOps API response types |
| `types/enhancement.ts` | `EnhancementStage`, `StageContext`, `StageOutput`, `EnhancementResult` |
| `types/governance.ts` | `AuditEvent`, `TelemetryRecord`, `FailurePattern`, `InsurancePolicy`, `InsuranceClaim`, `DecisionProvenance`, `AuthorityGrant` |
| `types/management-model.ts` | `ManagementModel` interface, `ManagementModelType` |
| `types/memory.ts` | `AgentMemoryEntry`, `MemoryCategory`, `VaultConfig` |
| `types/model-router.ts` | `RouteOptions`, `RouteResult`, `ModelRoute`, `ModelProvider` |
| `types/skill.ts` | `SkillDefinition`, `SkillCategory`, `McpServerConfig` |

## Database Schema

25 tables defined in `db/schema.ts` using Drizzle ORM. See [Database Schema](../infrastructure/database-schema) for full details.

**Client setup** (`db/client.ts`):

```typescript
import { getDb } from '@agentcoders/shared';
const db = getDb(); // singleton, uses DATABASE_URL
```

## Utilities

### Logger (`utils/logger.ts`)

Structured logging via pino:

```typescript
import { createLogger } from '@agentcoders/shared';
const logger = createLogger('my-service');
logger.info({ key: 'value' }, 'Message');
```

### Config (`utils/config.ts`)

Zod-validated environment variable loading:

```typescript
import { loadConfig, agentConfigSchema } from '@agentcoders/shared';
const config = loadConfig(agentConfigSchema);
// config is fully typed and validated
```

**Available schemas:** `baseConfigSchema`, `agentConfigSchema`, `telegramConfigSchema`, `billingConfigSchema`, `tenantManagerConfigSchema`, `jarvisConfigSchema`, `modelRouterConfigSchema`, `governanceConfigSchema`, `enhancementConfigSchema`

### Retry (`utils/retry.ts`)

Exponential backoff with jitter:

```typescript
import { retry } from '@agentcoders/shared';
const result = await retry(() => fetchData(), {
  maxRetries: 3,
  baseDelayMs: 1000,
});
```

## Constants

### ADO Fields (`constants/ado-fields.ts`)

Constants for Azure DevOps field names and work item states:

```typescript
AdoFields.TITLE          // 'System.Title'
AdoFields.STATE          // 'System.State'
AdoFields.ASSIGNED_TO    // 'System.AssignedTo'
// ... etc

WiStates.NEW             // 'New'
WiStates.ACTIVE          // 'Active'
WiStates.CLOSED          // 'Closed'

AgentTags.CLAIMED        // 'agent-claimed'
AgentTags.IN_PROGRESS    // 'agent-in-progress'
```

### Redis Channels (`constants/redis-channels.ts`)

Tenant-scoped channel constructors. See [Redis Channels](../infrastructure/redis-channels) for the full list.

### Complexity Timeouts (`constants/`)

```typescript
COMPLEXITY_TIMEOUTS_MS: Record<ComplexityTier, number>
// XS: 300000, S: 900000, M: 1800000, L: 2700000, XL: 3600000
```
