---
sidebar_position: 2
title: Getting Started
---

# Getting Started

## Prerequisites

- **Node.js** 22+
- **pnpm** 9+
- **PostgreSQL** 15+
- **Redis** 7+
- **kubectl** (for tenant provisioning)
- **Anthropic API key** (for Claude Code CLI)

## Install

```bash
git clone https://github.com/agentcoders/agentcoders.git
cd agentcoders
pnpm install
```

## Build

```bash
pnpm run build          # build all 14 packages via Turborepo
pnpm run typecheck      # type-check all packages
```

## Test

```bash
pnpm run test           # all tests (Vitest)
pnpm run test:unit      # unit tests only
pnpm run test:integration  # integration tests only
pnpm run test:watch     # watch mode
```

## Development

```bash
pnpm run dev            # all packages in dev mode (hot reload)
```

## Database Setup

```bash
# Set DATABASE_URL in your environment first
export DATABASE_URL="postgresql://user:pass@localhost:5432/agentcoders"

pnpm run db:generate    # generate Drizzle migrations from schema
pnpm run db:migrate     # run migrations
pnpm run db:push        # push schema directly (dev only)
```

## Minimum Environment

To run a single agent locally, you need at minimum:

```bash
# Core infrastructure
DATABASE_URL=postgresql://user:pass@localhost:5432/agentcoders
REDIS_URL=redis://localhost:6379

# Agent identity
AGENT_ID=agent-local-01
TENANT_ID=<uuid>
AGENT_VERTICAL=fullstack
AGENT_NAMESPACE=dev

# Azure DevOps
ADO_ORG_URL=https://dev.azure.com/your-org
ADO_PROJECT=your-project
ADO_PAT=<your-pat>

# AI
ANTHROPIC_API_KEY=<your-key>
```

See [Environment Variables](./infrastructure/environment-variables) for the complete list per service.

## All Scripts

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
