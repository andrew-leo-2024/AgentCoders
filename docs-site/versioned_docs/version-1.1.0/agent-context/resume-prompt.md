---
sidebar_position: 1
title: Agent Resume Prompt
---

# Agent Resume Prompt — v1

:::info Version History
- **v1 (2026-03-01):** Initial resume prompt. Covers full platform understanding, codebase state, and active decisions.
:::

This page exists so that **any Claude agent** — in any conversation, any workspace, any session — can recover full operational context for the AgentCoders platform by reading this single document plus its linked references.

---

## Who You Are

You are a development agent working on **AgentCoders** — a multi-tenant AI development factory that deploys autonomous coding teams as a service. Your codebase lives at the root of a Turborepo monorepo. You ship TypeScript (ESM, Node 22), PostgreSQL (Drizzle ORM), Redis (ioredis pub/sub), and Kubernetes-native infrastructure.

## What AgentCoders Does

Customers create work items in Azure DevOps or GitHub. AgentCoders autonomously:
1. **Jarvis CEO** decomposes epics → atomic tasks
2. **Agent pods** (coder/reviewer/tester) poll for tasks, create branches, write code via Claude Code CLI, open PRs, review, merge
3. **Quality gates** (6 gates) verify every deliverable before billing
4. **DWI billing** — customers pay per Delivered Work Item (merged, verified code), never per token or hour

## Codebase Map

| Package | Purpose | Entry Point |
|---------|---------|-------------|
| `@agentcoders/shared` | Types, DB schema (Drizzle, 25 tables), utils (pino, zod, retry), constants | `dist/index.js` |
| `@agentcoders/agent-runtime` | Core agent pod: poll loop → triage → claim → code → PR → review | `dist/main.js` |
| `@agentcoders/jarvis-runtime` | CEO agent: task decomposer, squad manager, escalation handler, conflict resolver | `dist/jarvis.js` |
| `@agentcoders/telegram-gateway` | Telegraf bot: prefix routing, approval flow, Redis bridge | `dist/bot.js` |
| `@agentcoders/billing-service` | DWI tracker, Stripe integration, budget enforcement, quality gates | `dist/billing.js` |
| `@agentcoders/tenant-manager` | REST API (raw Node http), tenant CRUD, K8s provisioning, HMAC auth | `dist/tenant-api.js` |
| `@agentcoders/dashboard` | React + Vite: 10 pages (value, agents, audit, telemetry, failures, models, skills, management, enhancements, insurance) | `dist/index.html` |
| `@agentcoders/model-router` | Multi-provider LLM routing (Anthropic/OpenAI/Google/Ollama), fallback chains, rate limiting | `dist/router.js` |
| `@agentcoders/enhancement-layer` | 20-stage prompt pipeline: amplifiers, stabilizers, codecs, armours | `dist/pipeline.js` |
| `@agentcoders/governance` | Audit trails, telemetry, decision provenance, AI insurance, failure patterns, authority decay | `dist/governance.js` |
| `@agentcoders/agent-memory` | PARA-based knowledge persistence, context hydration, learning capture, relevance decay | `dist/main.js` |
| `@agentcoders/skill-registry` | 6 built-in skills, MCP connector, skill scoring, workspace deployment | `dist/registry.js` |
| `@agentcoders/management-models` | Org topology: Spotify squads, SAFe, Scrum@Scale, Team Topologies | `dist/selector.js` |
| `@agentcoders/scm-adapters` | Unified SCM interface: Azure DevOps (WIQL/PAT) + GitHub (Octokit) | `dist/adapter-factory.js` |

## Key Technical Decisions

- `import { Redis } from 'ioredis'` (named export)
- `spawn` with `stdio: 'pipe'` and `type ChildProcess` for Claude Code CLI
- Redis channels prefixed `{tenantId}:` for multi-tenant isolation
- Config via `loadConfig(zodSchema)` from shared — validates `process.env` at boot
- No tsconfig project references — workspace deps only
- `@types/node@22` in root devDeps
- HMAC-SHA256 bearer tokens for API auth (`{keyId}.{hmac}`, timing-safe comparison)
- `drizzle-orm/node-postgres/migrator` for runtime migrations on dedicated-tier DBs
- Vitest with `pool: 'forks'`, `fileParallelism: false` for integration tests (testcontainers)

## Database

25 tables in `packages/shared/src/db/schema.ts`. Key tables: `tenants`, `agents`, `dwiRecords`, `workItemLog`, `prLog`, `claudeSessions`, `usageRecords`, `subscriptions`, `invoices`. All use UUID PKs, all have `tenantId` for row-level isolation.

Migration SQL lives in `packages/shared/drizzle/`. Generated via `pnpm db:generate`, applied via `runMigrations()` from `@agentcoders/shared`.

## Current State (as of v1)

- **Build:** 15/15 packages compile clean (`pnpm build`)
- **Tests:** 87 unit tests + 16 integration tests passing
- **Production blockers resolved:** API auth (HMAC-SHA256), DB migrations (drizzle migrator), integration tests (testcontainers with Postgres 16 + Redis 7)
- **Deployment:** 6 Dockerfiles, Kustomize base/overlays, Azure Pipelines CI/CD
- **What works:** Full type system, DB schema, Redis pub/sub, billing logic, tenant provisioning, SCM adapters, governance, enhancement pipeline structure
- **What needs battle-testing:** The core agent poll-loop against real ADO/GitHub projects, Stripe end-to-end billing, Jarvis task decomposition, multi-agent conflict resolution

## First Tenant: AINEFF

AINEFF (AI-Native Enterprise Factory Framework) is AgentCoders' first customer. It has 85 repos across 6 system clusters (Enterprise Birth, Governance, Policy, Audit, Safeguards, Intelligence) + 7 platforms. Each repo is a standalone deployable service. AgentCoders will ship AINEFF's systems as DWIs — the first real proof that autonomous AI dev teams can deliver production software.

See [Tenant Integration Guide](/tenant-guide/overview) for how AINEFF and future tenants consume AgentCoders.

## How to Resume Work

1. Read this page for full context
2. Check `git log --oneline -10` for recent changes
3. Run `pnpm build && pnpm test:unit` to verify current state
4. Check the [Platform Roadmap](/roadmap/approach-v1) for what's next
5. Check the [Tenant Integration Guide](/tenant-guide/overview) for tenant requirements
6. Consult package-specific docs under [Packages](/packages/shared) for implementation details

## Commands Reference

```bash
pnpm build                  # Build all 15 packages via Turborepo
pnpm test:unit              # 87 unit tests
pnpm test:integration       # 16 integration tests (requires Docker)
pnpm test                   # All tests
pnpm db:generate            # Generate Drizzle migration SQL
pnpm db:migrate             # Apply migrations
pnpm typecheck              # Type-check all packages
```
