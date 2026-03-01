---
sidebar_position: 3
title: Tech Stack
---

# Tech Stack

## Core

| Technology | Version | Purpose |
|-----------|---------|---------|
| TypeScript | 5.7+ | Language (ESM, Node16 module resolution) |
| Node.js | 22+ | Runtime |
| Turborepo | 2.4+ | Monorepo build orchestration |
| pnpm | 9+ | Package manager (workspaces) |

## Database & Cache

| Technology | Version | Purpose |
|-----------|---------|---------|
| PostgreSQL | 15+ | Primary data store (25 tables, 18 enums) |
| Drizzle ORM | — | Type-safe SQL queries, schema definition, migrations |
| Redis | 7+ | Pub/sub messaging (23 channels), caching |
| ioredis | — | Redis client (named export: `import { Redis } from 'ioredis'`) |

## AI & LLM

| Technology | Purpose |
|-----------|---------|
| Claude Code CLI (`claude -p`) | Headless coding engine — agents spawn Claude as child processes |
| Anthropic SDK | Model router provider for direct API access |
| OpenAI SDK | Model router provider |
| Google Generative AI SDK | Model router provider |
| Ollama (HTTP API) | Local model provider (zero cost) |

## Frontend

| Technology | Purpose |
|-----------|---------|
| React | Dashboard UI framework |
| Vite | Build tool and dev server |
| nginx | Production static file server |

## Infrastructure

| Technology | Purpose |
|-----------|---------|
| Kubernetes | Container orchestration |
| Kustomize | K8s manifest management (base + overlays + tenant templates) |
| Docker | Container images (6 multi-stage Dockerfiles) |
| Azure Pipelines | CI/CD (5-stage pipeline) |
| Azure Container Registry | Docker image registry |
| kubectl | K8s API access (used by Jarvis, Tenant Manager) |

## External Services

| Service | Purpose |
|---------|---------|
| Azure DevOps | Work item tracking, git hosting, CI pipelines |
| GitHub | Alternative SCM via Octokit |
| Stripe | Subscription billing, metered usage, invoicing |
| Telegram (Telegraf) | Human interface — commands, notifications, approvals |

## Shared Utilities

| Utility | Source | Purpose |
|---------|--------|---------|
| `createLogger(name)` | `@agentcoders/shared` | Structured logging via pino |
| `loadConfig(schema)` | `@agentcoders/shared` | Zod-validated env var loading |
| `retry(fn, opts)` | `@agentcoders/shared` | Exponential backoff with jitter |
| `getDb()` | `@agentcoders/shared` | Drizzle database client singleton |
| `RedisChannels` | `@agentcoders/shared` | Tenant-scoped channel name constructors |

## Testing

| Technology | Purpose |
|-----------|---------|
| Vitest | Test runner (V8 coverage) |
| Single root config | `vitest.config.ts` at repo root, all packages use it |
