# AgentCoders

Autonomous AI development teams for rent. AgentCoders is a multi-agent factory that deploys hierarchical AI dev squads — each led by a Jarvis CEO agent managing specialist pods of coders, reviewers, and testers — to autonomously deliver work items from Azure DevOps or GitHub, with value-based billing and full governance.

| Metric | Value |
|--------|-------|
| Packages | 14 |
| TypeScript Files | 181 |
| Lines of Code | ~22,000 |
| Database Tables | 25 |
| Test Files | 16 |
| Dockerfiles | 6 |

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Packages](#packages)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Schema](#database-schema)
- [Redis Channels](#redis-channels)
- [Tenant Management](#tenant-management)
- [Dashboard](#dashboard)
- [Model Router](#model-router)
- [Enhancement Pipeline](#enhancement-pipeline)
- [Governance](#governance)
- [Agent Memory](#agent-memory)
- [Skill Registry](#skill-registry)
- [Management Models](#management-models)
- [SCM Adapters](#scm-adapters)
- [Agent Roles & Statuses](#agent-roles--statuses)
- [Billing (DWI)](#billing-dwi)
- [Deployment](#deployment)
- [Testing](#testing)
- [Scripts](#scripts)

---

## Architecture Overview

```
                    ┌─────────────┐
                    │  Telegram   │
                    │   Gateway   │
                    └──────┬──────┘
                           │ Redis Pub/Sub
                    ┌──────▼──────┐
                    │   Jarvis    │ ◄── CEO Agent
                    │   Runtime   │     (task decomposition, squad mgmt)
                    └──────┬──────┘
               ┌───────────┼───────────┐
               ▼           ▼           ▼
          ┌─────────┐ ┌─────────┐ ┌─────────┐
          │  Coder  │ │Reviewer │ │ Tester  │ ◄── Agent Pods
          │  Agent  │ │  Agent  │ │  Agent  │     (Claude Code CLI)
          └────┬────┘ └────┬────┘ └────┬────┘
               │           │           │
          ┌────▼───────────▼───────────▼────┐
          │         Shared Layer            │
          │  (DB, Redis, Types, Utils)      │
          └────┬───────────┬───────────┬────┘
               ▼           ▼           ▼
          ┌─────────┐ ┌─────────┐ ┌─────────┐
          │ Billing │ │ Tenant  │ │Dashboard│
          │ Service │ │ Manager │ │ (React) │
          └─────────┘ └─────────┘ └─────────┘
```

**Tech Stack:**
- **Monorepo:** Turborepo + pnpm workspaces
- **Language:** TypeScript (ESM, Node16 module resolution)
- **Database:** PostgreSQL via Drizzle ORM (25 tables)
- **Cache/Pub-Sub:** Redis via ioredis
- **AI Engine:** Claude Code CLI (`claude -p`) as headless executor
- **SCM:** Azure DevOps + GitHub (dual adapter)
- **Frontend:** React + Vite + nginx
- **Deploy:** Kubernetes (Kustomize), multi-stage Dockerfiles
- **CI/CD:** Azure Pipelines

---

## Packages

| Package | Purpose | Entry Point |
|---------|---------|-------------|
| `@agentcoders/shared` | Types, DB schema (Drizzle), utils (pino, zod, retry), constants | `dist/index.js` |
| `@agentcoders/agent-runtime` | Core agent pod: poll loop, Claude Code executor, ADO/git clients, health/metrics | `dist/main.js` |
| `@agentcoders/jarvis-runtime` | Jarvis CEO: agent spawner, task decomposer, squad/escalation management | `dist/jarvis.js` |
| `@agentcoders/telegram-gateway` | Telegraf bot, prefix-based routing, approval flow | `dist/bot.js` |
| `@agentcoders/billing-service` | DWI tracker, Stripe integration, budget enforcement, quality gates | `dist/dwi-tracker.js` |
| `@agentcoders/tenant-manager` | 3-tier isolation provisioner, onboarding, REST API | `dist/tenant-api.js` |
| `@agentcoders/dashboard` | React + Vite: 10-page value dashboard | N/A (static) |
| `@agentcoders/model-router` | Multi-provider LLM routing with fallback chains | `dist/main.js` |
| `@agentcoders/enhancement-layer` | 20-stage prompt enhancement pipeline | `dist/pipeline.js` |
| `@agentcoders/governance` | Audit trail, telemetry, AI-insurance, failure patterns | `dist/audit-trail.js` |
| `@agentcoders/agent-memory` | PARA-based context persistence and hydration | `dist/main.js` |
| `@agentcoders/skill-registry` | Skill catalog, MCP connector, builtin skills | `dist/main.js` |
| `@agentcoders/management-models` | Spotify, SAFe, Team Topologies org models | `dist/model-interface.js` |
| `@agentcoders/scm-adapters` | Unified GitHub + Azure DevOps adapter | `dist/adapter-factory.js` |

---

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm 9+
- PostgreSQL 15+
- Redis 7+

### Install

```bash
pnpm install
```

### Build

```bash
pnpm run build
```

### Test

```bash
pnpm run test          # all tests
pnpm run test:unit     # unit tests only
pnpm run test:watch    # watch mode
```

### Develop

```bash
pnpm run dev           # all packages in dev mode
```

### Database

```bash
pnpm run db:generate   # generate Drizzle migrations
pnpm run db:migrate    # run migrations
pnpm run db:push       # push schema directly
```

### Environment Setup

Copy the required environment variables for each service you want to run. All services require `DATABASE_URL` and `REDIS_URL` at minimum. See [Environment Variables](#environment-variables) for the full list.

---

## Environment Variables

All config schemas use Zod validation via `loadConfig()` from `@agentcoders/shared`.

### Base (all services)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DATABASE_URL` | string (url) | *required* | PostgreSQL connection string |
| `REDIS_URL` | string | `redis://localhost:6379` | Redis connection string |
| `LOG_LEVEL` | enum | `info` | `trace` \| `debug` \| `info` \| `warn` \| `error` \| `fatal` |
| `NODE_ENV` | enum | `development` | `development` \| `staging` \| `production` |

### Agent Runtime

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AGENT_ID` | string | *required* | Unique agent identifier |
| `TENANT_ID` | uuid | *required* | Owning tenant |
| `AGENT_VERTICAL` | string | *required* | Vertical assignment (e.g., `frontend`) |
| `AGENT_NAMESPACE` | string | *required* | K8s namespace |
| `ADO_ORG_URL` | string (url) | *required* | Azure DevOps org URL |
| `ADO_PROJECT` | string | *required* | ADO project name |
| `ADO_PAT` | string | *required* | ADO personal access token |
| `ADO_REPOSITORY_ID` | string | *optional* | ADO repository ID |
| `ANTHROPIC_API_KEY` | string | *required* | Anthropic API key |
| `CLAUDE_MODEL_CODING` | string | `claude-sonnet-4-6` | Model for coding tasks |
| `CLAUDE_MODEL_TRIAGE` | string | `claude-haiku-4-5-20251001` | Model for triage |
| `POLL_INTERVAL_MS` | number | `30000` | Work item poll interval (min 5000) |
| `CLAUDE_CODE_TIMEOUT_MS` | number | `900000` | Claude session timeout (min 60000) |
| `MAX_TURNS_CODING` | number | `25` | Max turns for coding sessions |
| `MAX_TURNS_REVIEW` | number | `15` | Max turns for review sessions |
| `DAILY_BUDGET_USD` | number | `100` | Daily budget cap |
| `MONTHLY_BUDGET_USD` | number | `2000` | Monthly budget cap |
| `HEALTH_PORT` | number | `8080` | Health endpoint port |

### Jarvis Runtime

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TENANT_ID` | uuid | *required* | Owning tenant |
| `JARVIS_NAMESPACE` | string | `jarvis` | K8s namespace |
| `ADO_ORG_URL` | string (url) | *required* | Azure DevOps org URL |
| `ADO_PROJECT` | string | *required* | ADO project name |
| `ADO_PAT` | string | *required* | ADO PAT |
| `TELEGRAM_CHAT_ID` | string | *required* | Telegram chat for updates |
| `POLL_INTERVAL_MS` | number | `30000` | Poll interval |
| `DAILY_SUMMARY_INTERVAL_MS` | number | `86400000` | Daily summary interval |
| `AGENT_IMAGE` | string | `agentcoders/agent-runtime:latest` | Docker image for spawned agents |

### Telegram Gateway

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `TELEGRAM_BOT_TOKEN` | string | *required* | Telegraf bot token |
| `TELEGRAM_OWNER_CHAT_ID` | string | *required* | Owner chat ID |

### Billing Service

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `STRIPE_SECRET_KEY` | string | *required* | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | string | *required* | Stripe webhook secret |
| `HEALTH_PORT` | number | `8081` | Health endpoint port |

### Tenant Manager

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `STRIPE_SECRET_KEY` | string | *required* | Stripe secret key |
| `K8S_IN_CLUSTER` | boolean | `true` | Running inside K8s cluster |
| `HEALTH_PORT` | number | `8082` | Health endpoint port |

### Model Router

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `DEFAULT_PROVIDER` | enum | `anthropic` | `anthropic` \| `openai` \| `google` \| `ollama` |
| `DEFAULT_STRATEGY` | enum | `quality-optimized` | `cost-optimized` \| `quality-optimized` \| `latency-optimized` \| `round-robin` |
| `ANTHROPIC_API_KEY` | string | *optional* | Anthropic API key |
| `OPENAI_API_KEY` | string | *optional* | OpenAI API key |
| `GOOGLE_API_KEY` | string | *optional* | Google API key |
| `OLLAMA_BASE_URL` | string | `http://localhost:11434` | Ollama endpoint |
| `RATE_LIMIT_RPM` | number | `60` | Requests per minute limit |
| `HEALTH_PORT` | number | `8090` | Health endpoint port |

### Governance

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AUDIT_FLUSH_INTERVAL_MS` | number | `5000` | Audit buffer flush interval |
| `TELEMETRY_FLUSH_INTERVAL_MS` | number | `10000` | Telemetry buffer flush interval |
| `FAILURE_PATTERN_WINDOW_MS` | number | `3600000` | Failure pattern detection window |
| `AUTHORITY_DECAY_CHECK_INTERVAL_MS` | number | `60000` | Authority decay check interval |

### Enhancement Layer

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MAX_REFINEMENT_LOOPS` | number | `3` | Max output refinement iterations |
| `CONFIDENCE_THRESHOLD` | number | `0.7` | Minimum confidence score |
| `MAX_COST_PER_ENHANCEMENT_USD` | number | `5.0` | Cost ceiling per enhancement run |
| `SECURITY_SCAN_ENABLED` | boolean | `true` | Enable security scanning |
| `PII_DETECTION_ENABLED` | boolean | `true` | Enable PII detection |

---

## Database Schema

25 tables managed by Drizzle ORM in `packages/shared/src/db/schema.ts`.

### Enums

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

### Core Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `tenants` | Multi-tenant root | `slug` (unique), `isolationTier`, `subscriptionPlan`, `status`, `adoConfig`, `telegramConfig`, `verticals`, `resourceQuotas`, `billingConfig` |
| `agents` | Agent instances | `agentId` (unique), `tenantId` (FK), `vertical`, `role`, `status`, `currentWorkItemId`, `tokensUsedToday`, `costUsedTodayUsd`, `config` |
| `agentActions` | Agent activity log | `tenantId` (FK), `agentId`, `action`, `workItemId`, `prId`, `details`, `durationMs`, `tokensUsed` |
| `workItemLog` | Work item tracking | `tenantId` (FK), `workItemId`, `agentId`, `complexityTier`, `branchName`, `claimedAt`, `completedAt` |
| `prLog` | Pull request tracking | `tenantId` (FK), `prId`, `workItemId`, `agentId`, `repositoryId`, `sourceBranch`, `targetBranch`, `status` |
| `claudeSessions` | Claude Code session records | `tenantId` (FK), `agentId`, `model`, `mode` (triage/coding/review), `inputTokens`, `outputTokens`, `estimatedCostUsd`, `exitReason` |
| `messages` | Internal messaging | `tenantId` (FK), `channel`, `agentId`, `content` |
| `escalations` | Escalation records | `tenantId` (FK), `agentId`, `workItemId`, `subType`, `details`, `resolution`, `resolvedBy` |
| `dwiRecords` | Delivered Work Item billing | `tenantId` (FK), `complexityTier`, `priceUsd`, `status`, 6 boolean quality gates, `isBillable` |
| `usageRecords` | Token usage tracking | `tenantId` (FK), `agentId`, `sessionId` (FK), `model`, `inputTokens`, `outputTokens`, `estimatedCostUsd` |
| `subscriptions` | Stripe subscriptions | `tenantId` (FK, unique), `stripeCustomerId`, `stripeSubscriptionId`, `plan`, `status` |
| `invoices` | Billing invoices | `tenantId` (FK), `stripeInvoiceId`, `totalDwis`, `totalUsd`, `totalSavingsUsd`, `lineItems`, `status` |

### Platform Extension Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `auditEvents` | Immutable governance trail | `eventType`, `category`, `details`, `parentEventId` |
| `telemetryRecords` | Metrics collection | `metricName`, `metricValue`, `dimensions` |
| `failurePatterns` | Failure detection | `patternHash`, `signature`, `category`, `occurrenceCount`, `resolution`, `status` |
| `insurancePolicies` | SLA/quality guarantees | `policyType`, `coverageDetails`, `slaTargets`, `status` |
| `insuranceClaims` | Insurance claims | `policyId` (FK), `incidentDetails`, `resolution` |
| `agentMemories` | Agent knowledge store | `category` (PARA), `key`, `content`, `relevanceScore`, `expiresAt` |
| `modelRoutes` | LLM routing config | `provider`, `modelId`, `capabilities`, `pricing`, `isActive`, `priority` |
| `modelRouteLogs` | Model usage tracking | `routeId` (FK), `inputTokens`, `outputTokens`, `latencyMs`, `qualityScore`, `costUsd` |
| `skills` | Skill repository | `name` (unique), `category`, `version`, `content`, `isBuiltin` |
| `agentSkills` | Agent-skill mapping | `agentId`, `skillId` (FK), `activatedAt` |
| `skillScores` | Skill performance | `skillId` (FK), `taskType`, `qualityDelta`, `sampleCount` |
| `managementConfigs` | Org topology config | `modelType`, `topology`, `cadence`, `escalationPaths` |
| `enhancementRuns` | Pipeline run records | `pipelineConfig`, `stages`, `finalScore`, `durationMs` |
| `decisionProvenance` | Decision traceability | `decisionType`, `modelUsed`, `promptHash`, `contextSources`, `confidenceScore` |

---

## Redis Channels

All channels are prefixed with `{tenantId}:` for multi-tenant isolation.

### Channel Map

| Channel Pattern | Publisher | Subscriber | Purpose |
|----------------|-----------|------------|---------|
| `{tenantId}:vertical:{namespace}` | Jarvis | Agent Pods | Work distribution per vertical |
| `{tenantId}:cross-vertical:new-request` | Agent | Jarvis | Cross-vertical work request |
| `{tenantId}:cross-vertical:completed` | Agent | Jarvis | Cross-vertical completion |
| `{tenantId}:telegram:{vertical}` | Telegram Gateway | Jarvis | Inbound user commands |
| `{tenantId}:telegram:outbound` | Agent Runtime | Telegram Gateway | Outbound notifications |
| `{tenantId}:telegram:decision` | Approval Handler | Jarvis | Approval decisions |
| `{tenantId}:agent:{agentId}:progress` | Agent Runtime | Usage Recorder | Progress updates |
| `{tenantId}:agent:heartbeat` | Agent Runtime | Telegram Gateway | Agent heartbeats |
| `{tenantId}:dwi:work-item-created` | Agent | DWI Tracker | Work item lifecycle start |
| `{tenantId}:pr:linked` | Agent | DWI Tracker | PR linked to work item |
| `{tenantId}:ci:completed` | CI Pipeline | DWI Tracker, Quality Gates | CI result |
| `{tenantId}:pr:approved` | Reviewer | DWI Tracker | PR approved |
| `{tenantId}:pr:merged` | SCM | DWI Tracker, Quality Gates | PR merged |
| `{tenantId}:dwi:work-item-closed` | Agent | DWI Tracker | Work item closed |
| `{tenantId}:dwi:completed` | DWI Tracker | Billing | DWI finalized |
| `{tenantId}:billing:budget-exceeded` | DWI Tracker | Agent Runtime | Hard budget stop |
| `{tenantId}:billing:budget-alert` | Budget Enforcer | Jarvis | 80% budget warning |
| `{tenantId}:governance:audit` | Audit Trail | Governance consumers | Audit events |
| `{tenantId}:governance:telemetry` | Telemetry Collector | Dashboard | Metrics stream |
| `{tenantId}:governance:failure-alert` | Failure Pattern Engine | Jarvis | Failure threshold reached |
| `{tenantId}:model-router:route` | Model Router | Governance | Routing decisions |
| `{tenantId}:enhancement:{agentId}` | Enhancement Pipeline | Agent Runtime | Enhancement results |
| `{tenantId}:memory:sync` | Memory Store | Agent Pods | Memory synchronization |

---

## Tenant Management

### API Endpoints

Base URL: `http://tenant-manager:8082`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Health check |
| `GET` | `/readyz` | Readiness check |
| `POST` | `/api/tenants` | Create new tenant |
| `GET` | `/api/tenants/:id` | Get tenant by ID |
| `PATCH` | `/api/tenants/:id` | Update tenant (name, plan, quotas) |
| `DELETE` | `/api/tenants/:id` | Deactivate tenant (sets `deprovisioning`) |
| `POST` | `/api/tenants/:id/verticals` | Add vertical to tenant |
| `GET` | `/api/tenants/:id/usage` | Get resource usage |
| `GET` | `/api/tenants/:id/provisioning-status` | Get onboarding progress |
| `GET` | `/api/tenants/:id/audit` | Get audit events |
| `GET` | `/api/tenants/:id/telemetry` | Get telemetry records |
| `GET` | `/api/tenants/:id/failure-patterns` | Get failure patterns |
| `GET` | `/api/tenants/:id/model-routes` | Get model routes |
| `GET` | `/api/tenants/:id/management` | Get management config |
| `GET` | `/api/tenants/:id/enhancements` | Get enhancement runs |
| `GET` | `/api/tenants/:id/insurance` | Get insurance policies |
| `GET` | `/api/skills` | List all skills (global) |

### Isolation Tiers

| Tier | Name | Isolation Level |
|------|------|----------------|
| 1 | `namespace` | Shared DB/Redis, K8s namespace isolation, network policies, RBAC, resource quotas |
| 2 | `namespace-dedicated-db` | Dedicated PostgreSQL + Redis instances per tenant, namespace isolation |
| 3 | `dedicated-cluster` | Fully separate AKS cluster (Terraform/Pulumi provisioned) |

### Create Tenant Payload

```json
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "isolationTier": "namespace",
  "subscriptionPlan": "growth",
  "verticals": [
    { "name": "frontend", "type": "frontend", "agentCount": 2 }
  ]
}
```

---

## Dashboard

React + Vite application served via nginx. 10 pages:

| Route | Page | Description |
|-------|------|-------------|
| `/` | Value Dashboard | ROI metrics: work items delivered, PRs merged, cycle time vs human baseline, cost savings |
| `/agents` | Agent Status | Real-time agent table: ID, vertical, status, current work item, daily completions |
| `/audit` | Audit Trail | Immutable event log with category filtering |
| `/telemetry` | Telemetry | Real-time metrics: total records, unique agents, metric types, top agents |
| `/failures` | Failure Patterns | Pattern detection: signature, category, occurrence count, status, resolution |
| `/models` | Model Router | Provider cost analysis, priority-sorted route table with model IDs and costs |
| `/skills` | Skill Catalog | Skills grouped by category with version, description, enabled/disabled status |
| `/management` | Management Model | Org topology: model type, cadence config, group hierarchy, escalation paths |
| `/enhancements` | Enhancement Pipeline | Pipeline run history with status counts, stage details, scores |
| `/insurance` | Insurance | AI-Insurance & SLA compliance: policy summary, coverage, claims tracking |

---

## Model Router

Multi-provider LLM routing engine with cost/latency optimization, health monitoring, and fallback chains.

### Providers

| Provider | SDK | Models |
|----------|-----|--------|
| Anthropic | `@anthropic-ai/sdk` | Claude Opus, Sonnet, Haiku |
| OpenAI | `openai` | GPT-4o, o1 |
| Google | `@google/generative-ai` | Gemini Pro, Flash |
| Ollama | HTTP API | Local models (zero cost) |

### Routing Strategies

| Strategy | Description |
|----------|-------------|
| `cost-optimized` | Select cheapest model meeting capability requirements |
| `quality-optimized` | Select highest-quality model available |
| `latency-optimized` | Select fastest-responding model |
| `round-robin` | Distribute evenly across available models |

### Features

- **Fallback Chains** — automatic failover to secondary providers on error, configurable `maxRetries`
- **Rate Limiting** — token bucket per provider (default 60 RPM)
- **Health Monitoring** — auto-disable after 5 consecutive failures, 60s cooldown period
- **Cost Tracking** — per-request cost calculation with built-in pricing table for 15+ models

---

## Enhancement Pipeline

20-stage prompt enhancement pipeline organized in 4 categories. Stages run sequentially via a fluent `PipelineBuilder`.

### Amplifiers (boost quality)

| Stage | Purpose |
|-------|---------|
| RAG Injector | Retrieves relevant context chunks (max 5, threshold 0.7) |
| Chain of Verification | Verifies claims: factual, code-correctness, dependency, api-usage |
| Ensemble Router | Selects best model combination by task profile |
| Domain Expert Prompts | Injects domain expertise (fintech, healthcare, ecommerce, saas, devtools, iot) |
| Output Refinement Loop | Iterative refinement: lint, typecheck, test |

### Stabilizers (ensure consistency)

| Stage | Purpose |
|-------|---------|
| Schema Enforcer | JSON schema validation with auto-fix |
| Deterministic Validator | AST parsing and import checking |
| Confidence Scorer | 6 signals: length, code-structure, completeness, hedging, error-handling, documentation |
| Temperature Controller | Adjusts model temperature based on task requirements |
| Retry Escalator | Escalates to more capable models on repeated failures |

### Codecs (format transformation)

| Stage | Purpose |
|-------|---------|
| Prompt Compiler | Target-model compilation (Claude XML, GPT JSON, Gemini Markdown, LLaMA `[INST]`) |
| Context Compressor | Reduces context size while preserving meaning |
| Output Normalizer | Standardizes output format across providers |
| Code Formatter | Applies consistent code formatting |
| Semantic Deduplicator | Removes semantically duplicate content |

### Armours (safety & compliance)

| Stage | Purpose |
|-------|---------|
| Security Scanner | XSS, SQLi, command injection, secrets detection (70 patterns) |
| PII Detector | Personally identifiable information detection |
| License Checker | Open-source license compliance |
| Cost Limiter | Per-enhancement cost ceiling enforcement |
| Human Escalation Gate | Routes high-risk outputs to human review |

---

## Governance

### Audit Trail

Buffered event recording with periodic flush to PostgreSQL and real-time Redis pub/sub. Events are immutable with parent-child relationships for tracing.

**Categories:** `agent`, `task`, `model`, `enhancement`, `security`, `billing`, `governance`

### Telemetry Collector

Metrics buffered and flushed to `telemetryRecords` table. Tracks `metricName`, `metricValue`, and custom `dimensions`.

### Decision Provenance

Full traceability for AI decisions: `modelUsed`, `promptHash`, `contextSources`, `confidenceScore`. Query by tenant, work item, or agent.

### Failure Pattern Engine

Detects recurring failures by pattern hash. Publishes alert when occurrence count reaches threshold (default: 5). Statuses: `active`, `resolved`, `suppressed`.

### AI Insurance

Policy types: `sla-guarantee`, `quality-guarantee`, `uptime-guarantee`, `data-protection`. Supports `createPolicy`, `fileClaim`, `resolveClaim`, `checkSlaCompliance`.

---

## Agent Memory

PARA-based (Projects, Areas, Resources, Archive) knowledge persistence for agents.

### Categories

| Category | Purpose |
|----------|---------|
| `project` | Active project knowledge — current work context |
| `area` | Area of responsibility — ongoing domain knowledge |
| `resource` | Reference material — docs, patterns, examples |
| `archive` | Historical knowledge — lower relevance, retained |

### Components

- **VaultManager** — manages PARA-categorized entries: add, archive, promote, retrieve
- **ContextHydrator** — writes `MEMORY.md` to agent workspace, filters memories by task context, groups by category
- **MemoryStore** — CRUD with relevance scoring and search by key pattern
- **LearningRecorder** — captures new learnings from agent sessions
- **MemoryDecay** — TTL-based expiration and relevance decay

### Configuration

- `maxEntriesPerCategory` — cap per PARA category
- `defaultTtlMs` — memory expiration time
- Scoped by `tenantId` + `agentId`

---

## Skill Registry

### Categories

`frontend`, `backend`, `devops`, `security`, `testing`, `design`, `general`

### Builtin Skills

| Skill | Category | Description |
|-------|----------|-------------|
| `frontend-design` | frontend | Design tokens, atomic design, responsive, WCAG AA |
| `tdd-workflow` | testing | Test-first development, behavioral testing |
| `security-audit` | security | Input validation, auth, injection, XSS, secrets, CVEs |
| `api-design` | backend | RESTful conventions, HTTP methods, status codes, pagination, versioning |
| `devops-pipeline` | devops | 7-stage CI/CD: lint, typecheck, tests, build, integration, security, deploy |
| `code-review` | general | Code quality, edge cases, error handling, security, readability |

### MCP Connector

`McpConnector` manages external MCP (Model Context Protocol) servers: register, unregister, health check, build config for agent sessions.

### Skill Loader

Writes skill definitions to `.claude/skills/` in agent workspaces. Skills are loaded and activated per-agent via `agentSkills` table.

---

## Management Models

Organizational topology models for structuring AI agent teams.

### Spotify Model

- **Squads** — autonomous teams aligned to a mission (default size configurable)
- **Tribes** — collections of related squads
- **Chapters** — functional guilds spanning squads (e.g., all reviewers)
- **Guilds** — cross-squad communities of interest
- Round-robin work assignment within squads

### SAFe (Scaled Agile Framework)

- **Agile Release Train (ART)** — long-lived team-of-teams
- **PI Planning** — Program Increment planning for coordinated delivery

### Team Topologies

- **Stream-Aligned Teams** — aligned to a flow of work (primary value delivery)
- **Platform Teams** — provide internal services to stream-aligned teams
- **Enabling Teams** — help other teams adopt new capabilities

Selected per-tenant via `managementConfigs` table. Each model implements a common `ManagementModel` interface: `configureTopology`, `assignWork`, `getGroups`, `reportMetrics`.

---

## SCM Adapters

Unified interface for source control and project management across providers.

### Supported Providers

| Provider | SCM Adapter | PM Adapter | Auth |
|----------|------------|------------|------|
| Azure DevOps | `AdoScmAdapter` | `AdoPmAdapter` | PAT (Basic auth) |
| GitHub | `GitHubScmAdapter` | `GitHubPmAdapter` | Token (Octokit) |

### Unified Interface

Both adapters implement `ScmProvider`:

- `queryWorkItems(query)` — ADO uses WIQL, GitHub uses issue search
- `getWorkItem(id)` — fetch single work item
- `updateWorkItem(id, updates)` — update fields
- `createPr(options)` — create pull request
- `mergePr(id)` — merge pull request
- `getPr(id)` — get PR details

### Factory

```typescript
import { createScmAdapter, createProjectManagement } from '@agentcoders/scm-adapters';

const scm = createScmAdapter({ type: 'github', token, owner, repo });
const pm = createProjectManagement({ type: 'ado', orgUrl, project, pat });
```

---

## Agent Roles & Statuses

### Roles

| Role | Description |
|------|-------------|
| `coder` | Implements features, fixes bugs — claims work items and writes code |
| `reviewer` | Reviews PRs — checks code quality, correctness, security |
| `tester` | Runs and writes tests — validates agent output |
| `jarvis` | CEO/orchestrator — decomposes tasks, spawns agents, manages squads |

### Status Lifecycle

```
idle → polling → working → idle
                    ↓
               reviewing → idle
                    ↓
               blocked → idle (on unblock)
                    ↓
                error → idle (on recovery)
                    ↓
               offline (disconnected)
```

| Status | Description |
|--------|-------------|
| `idle` | Waiting for work |
| `polling` | Checking for new work items |
| `working` | Actively coding |
| `reviewing` | In code review |
| `blocked` | Waiting on dependency or approval |
| `offline` | Disconnected |
| `error` | Encountered an error |

---

## Billing (DWI)

**DWI = Delivered Work Item** — the billing unit. Only completed, quality-verified work items are billed.

### Complexity Tiers & Pricing

| Tier | Price | Timeout | Human Equivalent |
|------|-------|---------|-----------------|
| XS | $5 | 5 min | $50–100 |
| S | $15 | 15 min | $200–400 |
| M | $50 | 30 min | $800–2,000 |
| L | $150 | 45 min | $2,000–5,000 |
| XL | $500 | 60 min | $5,000–15,000 |

### Complexity Estimation

Heuristic keyword matching + fallback to Claude Haiku API:

- **XS:** typo, rename, label, color, text change, bump version
- **S:** add field, fix bug, validation, unit test, simple endpoint
- **M:** new endpoint, new component, refactor, migration, CRUD
- **L:** new service, authentication, database schema, workflow
- **XL:** architecture, microservice, real-time, event-driven, full redesign

### Quality Gates (6 criteria — all required)

1. Work item exists in ADO/GitHub
2. PR linked to work item
3. CI pipeline passes
4. PR approved by reviewer
5. PR merged to main
6. Work item closed

### Revert Protection

- **Window:** 30 minutes post-merge
- **Trigger:** CI failure within window
- **Action:** Auto-revert PR, mark DWI as `reverted` (non-billable)

### Budget Enforcement

- **Warning:** 80% of daily/monthly budget → `budget-alert` channel
- **Hard stop:** 100% → agent forced to `idle`
- Tracks DWI revenue + internal usage costs (tokens)

### DWI Status Lifecycle

```
in_progress → pending_review → approved → merged → completed (billable)
                                                  → reverted (non-billable)
           → failed
```

---

## Deployment

### Dockerfiles

| Service | File | Base Image | Notable Deps |
|---------|------|------------|-------------|
| Agent Runtime | `deploy/dockerfiles/Dockerfile.agent` | ubuntu:24.04 | Node 22, Azure CLI, Claude Code CLI, git |
| Jarvis CEO | `deploy/dockerfiles/Dockerfile.jarvis` | ubuntu:24.04 | Node 22, Azure CLI, Claude Code CLI, kubectl |
| Billing | `deploy/dockerfiles/Dockerfile.billing` | node:22-slim | — |
| Telegram Gateway | `deploy/dockerfiles/Dockerfile.gateway` | node:22-slim | — |
| Tenant Manager | `deploy/dockerfiles/Dockerfile.tenant-manager` | node:22-slim | kubectl |
| Dashboard | `deploy/dockerfiles/Dockerfile.dashboard` | node:22-slim → nginx:alpine | Vite build → static serve |

All Dockerfiles use multi-stage builds and run as non-root users.

### Kustomize Structure

```
deploy/kustomize/
├── base/
│   ├── kustomization.yaml
│   ├── namespace.yaml          # agent-shared namespace
│   ├── postgres.yaml           # PostgreSQL 15 StatefulSet
│   ├── redis.yaml              # Redis 7 StatefulSet
│   ├── billing-service.yaml
│   ├── telegram-gateway.yaml
│   ├── tenant-manager.yaml
│   ├── network-policies.yaml
│   └── rbac.yaml
├── overlays/
│   ├── dev/                    # Reduced resources (100m CPU, 256Mi RAM)
│   ├── staging/                # Base defaults
│   └── production/             # Scaled resources (2 CPU, 2Gi RAM limits)
└── tenant-templates/
    ├── namespace-only/         # Tier 1: NS + NetworkPolicy + RBAC + Quotas
    ├── namespace-dedicated-db/ # Tier 2: Tier 1 + dedicated PG + Redis
    └── dedicated-cluster/      # Tier 3: Separate AKS (Terraform/Pulumi)
```

### CI/CD Pipeline

Azure Pipelines (`deploy/ci/azure-pipelines.yml`) — 5 stages:

1. **Build & Test** — `pnpm build`, `typecheck`, `test:unit`, `test:integration`
2. **Docker** — Build and push 6 images to Azure Container Registry (main branch only)
3. **Deploy Dev** — `kubectl apply -k deploy/kustomize/overlays/dev/`
4. **Deploy Staging** — `kubectl apply -k deploy/kustomize/overlays/staging/`
5. **Deploy Production** — `kubectl apply -k deploy/kustomize/overlays/production/` (main branch only)

Triggers on `main` and `develop` branches, filtered to `packages/**` and `deploy/**`.

---

## Testing

Vitest with V8 coverage. Single root config for all packages.

### Test Files

| Test File | Tests |
|-----------|-------|
| `tests/unit/poll-loop.test.ts` | Poll loop: non-reentrant guard, jitter, work item queries, complexity pricing/timeouts |
| `tests/unit/dwi-tracker.test.ts` | DWI billing criteria: all 6 gates, failure scenarios |
| `tests/unit/redis-messages.test.ts` | Redis message serialization, tenant-scoped channel naming |
| `tests/unit/telegram-router.test.ts` | Prefix routing (Frontend:/Backend:/DevOps:/QA:), broadcast, defaults |
| `tests/unit/model-router/router.test.ts` | Route registration, provider routing, cost tracking |
| `tests/unit/model-router/fallback-chain.test.ts` | Fallback on primary failure, retry logic, all-fail error |
| `tests/unit/enhancement-layer/pipeline.test.ts` | Pass-through, timing, failure handling, builder pattern |
| `tests/unit/enhancement-layer/security-scanner.test.ts` | XSS, secrets, SQLi detection, selective checks |
| `tests/unit/governance/audit-trail.test.ts` | Buffer + Redis publish, timestamp addition, graceful failure |
| `tests/unit/governance/failure-pattern-engine.test.ts` | Pattern creation, count increment, threshold alerts |
| `tests/unit/agent-memory/context-hydrator.test.ts` | MEMORY.md generation, context filtering, category grouping |
| `tests/unit/agent-memory/memory-store.test.ts` | CRUD, relevance scoring, search, agent-scoped retrieval |
| `tests/unit/skill-registry/skill-loader.test.ts` | Workspace writing, builtin loading, skill structure |
| `tests/unit/scm-adapters/ado-adapter.test.ts` | WIQL queries, batch fetch, field mapping, auth header |
| `tests/unit/scm-adapters/github-adapter.test.ts` | Issue search, repo-scoped queries, PR creation |
| `tests/unit/management-models/spotify.test.ts` | Topology config, squad/tribe structure, work assignment, metrics |

### Running Tests

```bash
pnpm run test              # all tests
pnpm run test:unit         # unit tests only
pnpm run test:integration  # integration tests only
pnpm run test:watch        # watch mode
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm run build` | Build all packages via Turborepo |
| `pnpm run dev` | Start all packages in dev mode |
| `pnpm run lint` | Lint all packages |
| `pnpm run test` | Run all tests |
| `pnpm run test:unit` | Run unit tests only |
| `pnpm run test:integration` | Run integration tests only |
| `pnpm run test:watch` | Watch mode |
| `pnpm run typecheck` | Type-check all packages |
| `pnpm run clean` | Clean all build outputs |
| `pnpm run db:generate` | Generate Drizzle migrations |
| `pnpm run db:migrate` | Run database migrations |
| `pnpm run db:push` | Push schema to database |

---

## License

Proprietary. All rights reserved.
