---
slug: /
sidebar_position: 1
title: Introduction
---

# AgentCoders

**Autonomous AI development teams for rent.**

AgentCoders is a multi-agent factory that deploys hierarchical AI dev squads — each led by a **Jarvis CEO agent** managing specialist pods of coders, reviewers, and testers — to autonomously deliver work items from Azure DevOps or GitHub, with value-based billing and full governance.

## How It Works

1. **You create work items** in Azure DevOps or GitHub as you normally would
2. **Jarvis decomposes** epics into atomic tasks using GSD (Get Shit Done) planning
3. **Agent pods claim tasks**, create branches, write code, open PRs, and request reviews
4. **Quality gates verify** every deliverable: CI must pass, PR must be approved, work item must close
5. **You pay per Delivered Work Item (DWI)** — only for merged, quality-verified results

## Key Numbers

| Metric | Value |
|--------|-------|
| Packages | 14 |
| TypeScript Files | 181 |
| Lines of Code | ~22,000 |
| Database Tables | 25 |
| Redis Channels | 23 |
| Test Files | 16 |
| Dockerfiles | 6 |
| Dashboard Pages | 10 |
| Enhancement Stages | 20 |
| Builtin Skills | 6 |

## Core Concepts

### Delivered Work Item (DWI)

The billing unit. A DWI represents a complete, quality-verified deliverable. All 6 quality gates must pass before billing:

1. Work item exists in SCM
2. PR linked to work item
3. CI pipeline passes
4. PR approved by reviewer
5. PR merged to main
6. Work item closed

### Agent Roles

| Role | What It Does |
|------|-------------|
| **Jarvis** | CEO/orchestrator — decomposes tasks, spawns agents, manages squads, resolves conflicts |
| **Coder** | Claims work items, creates branches, writes code, opens PRs |
| **Reviewer** | Reviews PRs for quality, correctness, security |
| **Tester** | Runs and writes tests, validates agent output |

### Multi-Tenant Isolation

Three tiers of tenant isolation:

| Tier | Isolation |
|------|-----------|
| **Namespace** | Shared DB/Redis, K8s namespace + RBAC + NetworkPolicy |
| **Namespace + Dedicated DB** | Per-tenant PostgreSQL and Redis instances |
| **Dedicated Cluster** | Fully separate AKS cluster |

## Quick Navigation

- **[Getting Started](./getting-started)** — Prerequisites, install, build, test
- **[Architecture Overview](./architecture/overview)** — System design and data flow
- **[Packages](./packages/shared)** — All 14 packages with detailed component docs
- **[Business Processes](./processes/agent-work-lifecycle)** — End-to-end workflows, SOPs, and BPMN diagrams
- **[SOPs](./processes/sop-tenant-onboarding)** — Standard Operating Procedures for onboarding and operations
- **[BPMN Diagrams](./processes/bpmn-diagrams)** — Complete process diagrams with RACI matrix
- **[Infrastructure](./infrastructure/database-schema)** — DB schema, Redis, env vars, deploy
- **[Platform Roadmap](./roadmap/approach-v1)** — Phased implementation approach (versioned)
- **[OSS Integration Catalog](./roadmap/oss-catalog-v1)** — 60+ open-source projects evaluated for fork-audit-integrate
- **[Tenant Integration Guide](./tenant-guide/overview)** — How tenants (AINEFF, future AINEs) consume AgentCoders
- **[AINEFF Onboarding](./tenant-guide/aineff-onboarding)** — First tenant: 85 repos, 43 systems, phased build plan
- **[Agent Context](./agent-context/resume-prompt)** — Resume prompt for any Claude agent to recover full platform context
