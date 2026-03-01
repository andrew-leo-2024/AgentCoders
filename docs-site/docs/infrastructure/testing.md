---
sidebar_position: 5
title: Testing
---

# Testing

## Framework

- **Test runner:** Vitest 3.x
- **Coverage provider:** V8
- **Coverage reporters:** text, json, html
- **Config:** single root `vitest.config.ts` (no per-package configs)

### Configuration — v2

:::info Version History
- **v1:** Defaults only (globals, node environment, coverage).
- **v2 (2026-03-01):** Added `testTimeout: 30s`, `hookTimeout: 120s`, `pool: 'forks'`, `fileParallelism: false` for testcontainers integration tests. Added `drizzle-orm`, `pg`, `ioredis`, `testcontainers`, `@testcontainers/postgresql` as root devDeps.
:::

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    pool: 'forks',
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts'],
      exclude: ['**/*.test.ts', '**/index.ts', '**/main.ts'],
    },
  },
});
```

## Test Files

16 test files covering all major packages:

### Agent Runtime

| Test File | Tests |
|-----------|-------|
| `tests/unit/poll-loop.test.ts` | Non-reentrant guard, jitter calculation (0-30000ms), work item queries (empty/found), complexity pricing (XS-XL tiers), timeout mappings |

### Billing Service

| Test File | Tests |
|-----------|-------|
| `tests/unit/dwi-tracker.test.ts` | All 6 quality gates pass → billable, CI fail → not billable, PR not merged → not billable, work item not closed → not billable, no criteria → not billable |

### Redis & Telegram

| Test File | Tests |
|-----------|-------|
| `tests/unit/redis-messages.test.ts` | Heartbeat/escalation/progress-update message serialization, tenant-scoped channel naming (`{tenantId}:vertical:{namespace}`) |
| `tests/unit/telegram-router.test.ts` | Prefix routing (Frontend:/Backend:/DevOps:/QA:), broadcast routing (All:), default routing (no prefix) |

### Model Router

| Test File | Tests |
|-----------|-------|
| `tests/unit/model-router/router.test.ts` | Throws when no routes registered, routes to correct provider, tracks cost data (inputTokens, outputTokens, costUsd) |
| `tests/unit/model-router/fallback-chain.test.ts` | Falls back to secondary on primary failure, errors when all providers fail, respects maxRetries, uses primary when successful |

### Enhancement Layer

| Test File | Tests |
|-----------|-------|
| `tests/unit/enhancement-layer/pipeline.test.ts` | Pass-through with no stages, timing and stage result tracking, graceful failure handling, builder pattern configuration, security scanner instantiation |
| `tests/unit/enhancement-layer/security-scanner.test.ts` | XSS detection (innerHTML, script tags), hardcoded secrets (API keys, AWS keys), clean code pass-through, SQL injection detection, selective check configuration |

### Governance

| Test File | Tests |
|-----------|-------|
| `tests/unit/governance/audit-trail.test.ts` | Events buffered + published to Redis, timestamps added, graceful Redis failure handling |
| `tests/unit/governance/failure-pattern-engine.test.ts` | New pattern creation on first failure, count increment on repeat, alert published at threshold (count >= 5), Redis disconnect handling |

### Agent Memory

| Test File | Tests |
|-----------|-------|
| `tests/unit/agent-memory/context-hydrator.test.ts` | MEMORY.md written to .claude/ directory, memories filtered by task context, no-op when no memories, grouping by PARA category |
| `tests/unit/agent-memory/memory-store.test.ts` | Creating entries with relevance scoring, null on non-existent, search by key pattern, retrieval ordered by relevance |

### Skill Registry

| Test File | Tests |
|-----------|-------|
| `tests/unit/skill-registry/skill-loader.test.ts` | Skills written to .claude/skills/ workspace, builtin skills loaded correctly (name, category, version, description, content), well-known builtins present, empty skills array handling |

### SCM Adapters

| Test File | Tests |
|-----------|-------|
| `tests/unit/scm-adapters/ado-adapter.test.ts` | WIQL API query execution, batch fetch by IDs, field mapping to ScmWorkItem, empty results, HTTP error throwing, Authorization header with base64 PAT |
| `tests/unit/scm-adapters/github-adapter.test.ts` | Issue search mapping to ScmWorkItem, repo-scoped queries, PR creation via octokit.pulls.create, empty search results |

### Management Models

| Test File | Tests |
|-----------|-------|
| `tests/unit/management-models/spotify.test.ts` | Topology configuration, squad/tribe structure, round-robin work assignment, metrics reporting, squad size defaults, role assignment (product-owner, developer) |

### Tenant Manager Auth — v2

:::info Added 2026-03-01
:::

| Test File | Tests |
|-----------|-------|
| `tests/unit/auth.test.ts` | API key generation (`keyId.hmac` format, uniqueness), HMAC-SHA256 validation (valid key, wrong secret, tampered HMAC, missing dot, empty string, empty keyId, empty HMAC), Bearer token extraction (valid header, case-insensitive, missing header, empty string, wrong scheme, no token after Bearer) |

## Integration Tests — v2

:::info Added 2026-03-01
Uses `testcontainers` + `@testcontainers/postgresql` to spin up real Postgres 16 and Redis 7 containers. Requires Docker. Shared setup in `tests/integration/setup.ts`.
:::

| Test File | Tests | What It Validates |
|-----------|-------|-------------------|
| `tests/integration/db-schema.test.ts` | 4 | Migrations create all 25+ tables, all 16 enums, Drizzle ORM insert/select, unique slug constraint |
| `tests/integration/redis-pubsub.test.ts` | 3 | Tenant-scoped channel delivery, cross-tenant isolation (no leakage), multi-subscriber broadcast |
| `tests/integration/dwi-lifecycle.test.ts` | 4 | DWI creation in `in_progress`, 6-gate progression to `completed`+`isBillable`, incomplete gates = not billable, duration tracking on failure |
| `tests/integration/tenant-crud.test.ts` | 5 | Tenant defaults (namespace tier, starter plan, provisioning status), unique slug enforcement, name/plan updates, status lifecycle (provisioning→active→suspended→deprovisioning), JSONB verticals storage |

## Running Tests

```bash
# All tests
pnpm run test

# Unit tests only (87 tests, ~2s)
pnpm run test:unit

# Integration tests only (16 tests, ~56s, requires Docker)
pnpm run test:integration

# Watch mode (re-runs on file changes)
pnpm run test:watch

# With coverage
pnpm run test -- --coverage
```
