---
sidebar_position: 2
title: "AINEFF Onboarding — v1"
---

# AINEFF Onboarding — v1

:::info Version History
- **v1 (2026-03-01):** Initial onboarding plan. Based on full AINEFF docs site analysis (35 pages, 85 repos, 43 systems, 7 platforms). AINEFF is AgentCoders' first paying tenant — this is the reference onboarding that proves the platform works.
:::

## Executive Summary

**AINEFF** (AI-Native Enterprise Factory Framework) is a civilization-scale invisible infrastructure project with **85 repositories, 43 core systems, 7 platforms, and zero production code**. Their docs site is their complete specification. AgentCoders reads those docs and turns them into working software — billed per Delivered Work Item.

**The deal:** AINEFF writes specs in their docs site. AgentCoders agents read those specs, write TypeScript, open PRs, pass CI, and deliver. AINEFF pays per merged PR.

---

## What AINEFF Has Today

| Asset | Status |
|-------|--------|
| 85 repositories scaffolded | Stub `index.ts` files only |
| 43 system specifications | Documented in docs site |
| 7 platform specifications | Documented in docs site |
| Monorepo wired | Turborepo + pnpm + 70 git submodules |
| Chokepoint Intelligence app | Only functional product (Next.js 16) |
| Docs site | Deployed, 35+ pages, canonical source of truth |
| CI/CD pipeline | GitHub Actions configured |
| K8s manifests | Kustomize templates |
| Revenue model | Projected $772K-$19.4M over 3 years |
| Production code | None (except Chokepoint) |

## What AINEFF Needs From AgentCoders

Fill all 85 repos with production TypeScript that implements the specs in their docs site. Specifically:

1. **6 shared packages** first (`@aineff/shared-types`, `orf-sdk`, `audit-logger`, `governance-sdk`, `ui`, `jurisdiction-engine`)
2. **43 core systems** as standalone deployable services
3. **7 platform packages** with protocol integration
4. **Apps** (Chokepoint Intelligence already exists, more coming)

---

## The ORF Constraint

:::warning Critical Architecture Constraint
All AINEFF code operates under the **ORF Protocol** (Obligation and Responsibility Finality). Every action must be ORF-wrapped. This means:
- Every API call produces an `ORFEnvelope`
- The ORF Triple: Obligor + Responsible Party + Finality Point
- States: Proposed, Accepted, Executing, Final (irreversible)
- **Fail-closed by default** — if ORF is unreachable, all actions halt
- Enforced via K8s sidecar containers and NetworkPolicy (PEP layer)
:::

AgentCoders agents must understand ORF before writing AINEFF code. This means:
- Every agent pod working on AINEFF verticals gets the `orf-specialist` skill loaded
- The `@aineff/orf-sdk` package is a Phase 1 dependency — built first, used everywhere
- Agent CLAUDE.md files include: "All service endpoints must wrap operations in ORFEnvelope. Import createORFEnvelope from @aineff/orf-sdk."

---

## Tenant Configuration

### Step 1: Create Tenant

```json
{
  "name": "AINEFF",
  "slug": "aineff",
  "isolationTier": "namespace-dedicated-db",
  "subscriptionPlan": "enterprise",
  "scmProvider": "github",
  "resourceQuotas": {
    "maxAgents": 25,
    "maxConcurrentTasks": 40,
    "dailyBudgetUsd": 1000
  }
}
```

### Step 2: Connect GitHub

```json
{
  "githubConfig": {
    "owner": "frankmax-com",
    "installationId": "...",
    "defaultBranch": "main",
    "labelFilter": "agent-ready"
  }
}
```

### Step 3: Configure 7 Verticals

One Jarvis CEO per AINEFF cluster, plus one for platforms:

| Vertical Slug | AINEFF Cluster | Systems | Agent Squad |
|---------------|---------------|---------|-------------|
| `enterprise-birth` | Cluster 1: Enterprise Birth | EMS, EGMS, PDES, GCS, IGS, TIS, FBS, GAAGR (8) | 3 coders + 1 reviewer + 1 tester |
| `governance` | Cluster 2: Governance and Authority | RAMS, GBL, OGCRS, HOES, HCDI, HCL, COIE, ADS, NDAR (9) | 3 coders + 1 reviewer + 1 tester |
| `policy` | Cluster 3: Policy and Semantics | PIES, JAL, CVSS, MIDC, SCS (5) | 2 coders + 1 reviewer + 1 tester |
| `audit` | Cluster 4: Audit and Death | ACTS, FMS, TDES, NPOS, ECS, RPS, MES (7) | 2 coders + 1 reviewer + 1 tester |
| `safeguards` | Cluster 5: Safeguards | SHFS, NLO-R, SSDT, CEFP, SEI, RRLS (6) | 2 coders + 1 reviewer + 1 tester |
| `intelligence` | Cluster 6: Intelligence and Revenue | BPMN, Role Engine, Industry Intel, Protocol Router, Audit Chain, ACOS, Telemetry, Revenue Intel (8) | 3 coders + 1 reviewer + 1 tester |
| `platforms` | Cross-cutting Platforms | ORF, AINE Runtime, AINEG, WGE, LevelupMax, Frankmax, LPI (7) | 2 coders + 1 reviewer + 1 tester |

**Total: 7 Jarvis CEOs managing 25 agents across 50 systems/platforms.**

---

## Phased Build Plan

Aligned with AINEFF's own 4-phase plan (Weeks 1-52):

### Phase 0 — Foundation (Weeks 1-4)

**AgentCoders' role:** Not yet involved in code. Humans handle Chokepoint Intelligence and Frankmax engagements.

**What AgentCoders prepares:** Configure tenant, connect repos, load skills, test one agent pod against a single AINEFF repo.

### Phase 1 — Shared Packages (Weeks 5-12)

**Goal:** Deliver the 4 foundational packages that every system depends on.

| Work Item | Repo | Complexity | Estimated DWIs |
|-----------|------|-----------|----------------|
| `@aineff/shared-types` — core TypeScript types, enums, interfaces | aineff-shared-types | L | 5-8 |
| `@aineff/orf-sdk` — createORFEnvelope, evaluateConstraint, generateFinalityHash | aineff-orf-sdk | XL | 8-12 |
| `@aineff/audit-logger` — hash-chained append-only event log | aineff-audit-logger | M | 3-5 |
| `@aineff/governance-sdk` — authority checks, mandate validation | aineff-governance-sdk | L | 5-8 |

**Estimated cost at M/L pricing:** 21-33 DWIs at $75-250 each = ~$3,000-$6,000

### Phase 2 — One Working AINE (Weeks 13-24)

**Goal:** 7 core systems functional, producing the first full AINE lifecycle.

Priority systems (from AINEFF's Phase 2):

| System | Cluster | What It Does | DWIs (est.) |
|--------|---------|-------------|-------------|
| EMS | Enterprise Birth | Enterprise manufacturing — create AINEs | 10-15 |
| GCS | Enterprise Birth | Governance Configuration — assign rules to new AINEs | 8-12 |
| IGS | Enterprise Birth | Identity Granting — issue cryptographic identities | 6-8 |
| RAMS | Governance | Role and Authority Management | 10-15 |
| ACTS | Audit | Audit and Causal Trace — immutable event chain | 8-12 |
| BPMN | Intelligence | Process engine for workflow orchestration | 10-15 |
| Agent Runtime | Platform | AgentCoders' own agent-runtime strengthened | 8-12 |

**Estimated cost:** 60-89 DWIs = ~$8,000-$18,000

### Phase 3 — Revenue Flywheel (Weeks 25-40)

**Goal:** Revenue-generating products live.

| System | DWIs (est.) |
|--------|-------------|
| LevelupMax Training Platform | 15-20 |
| WGE (Work Genesis Engine) templates | 10-15 |
| Telemetry and Observability | 8-12 |
| AINEG Coordinator | 10-15 |
| Operator Dashboard | 12-18 |

**Estimated cost:** 55-80 DWIs = ~$8,000-$16,000

### Phase 4 — Governance Moat (Weeks 41-52)

**Goal:** Differentiating governance systems that create AINEFF's competitive moat.

| System | DWIs (est.) |
|--------|-------------|
| Authority Decay (ADS) | 8-12 |
| NLO-R (Natural Language Obligations) | 10-15 |
| Jurisdiction Engine | 10-15 |
| Enterprise Mortality (TDES, MES) | 12-18 |
| Systemic Harm Forecasting (SHFS) | 10-15 |
| Remaining Cluster 3-5 systems | 30-45 |

**Estimated cost:** 80-120 DWIs = ~$12,000-$24,000

### Total Estimated Engagement

| Phase | Weeks | DWIs | Cost Range |
|-------|-------|------|-----------|
| Phase 1 | 5-12 | 21-33 | $3,000-$6,000 |
| Phase 2 | 13-24 | 60-89 | $8,000-$18,000 |
| Phase 3 | 25-40 | 55-80 | $8,000-$16,000 |
| Phase 4 | 41-52 | 80-120 | $12,000-$24,000 |
| **Total** | **52 weeks** | **216-322 DWIs** | **$31,000-$64,000** |

This is AgentCoders' cost to build the entire AINEFF platform. For comparison, a human dev team of 5 engineers for 52 weeks at $150K avg salary = $750K+. AgentCoders delivers at **4-8% of the human cost**.

---

## Agent Skills for AINEFF

Each agent pod working on AINEFF verticals gets these loaded skills:

| Skill | Purpose |
|-------|---------|
| `orf-specialist` | Understand ORF protocol, wrap all operations in ORFEnvelope |
| `aineff-architecture` | 6-cluster system map, 5-layer protocol stack, dependency graph |
| `drizzle-schema` | Schema patterns from `@aineff/shared-types` |
| `k8s-deploy` | Dockerfile + Kustomize + Helm patterns matching AINEFF's infra |
| `audit-logging` | Hash-chained event logging using `@aineff/audit-logger` |
| `governance-checks` | Authority validation before state mutations |

### CLAUDE.md Template for AINEFF Repos

Every AINEFF repo should include this at root:

```markdown
# AINEFF Agent Instructions

## Architecture
- This is part of the AINEFF platform (AI-Native Enterprise Factory Framework)
- Read the full architecture: https://frankmax-com.github.io/aineff-docs/
- This system belongs to Cluster {N}: {ClusterName}

## Constraints
- ALL operations must be wrapped in ORFEnvelope (import from @aineff/orf-sdk)
- ALL state mutations must emit audit events (import from @aineff/audit-logger)
- ALL authority checks use @aineff/governance-sdk before granting access
- Fail-closed: if ORF or governance SDK is unreachable, return 503

## Tech Stack
- TypeScript ESM (Node16 module resolution)
- Drizzle ORM for PostgreSQL
- ioredis for Redis pub/sub
- Vitest for testing
- Kustomize for K8s manifests

## Commands
- pnpm install
- pnpm build
- pnpm test
- pnpm lint
```

---

## How Agents Read AINEFF Docs

AINEFF's principle: **"Documentation as Source of Truth"** — if docs and code conflict, docs win.

AgentCoders agents consume AINEFF specs through:

1. **Context hydration** — before starting a task, the agent's memory is hydrated with the relevant docs page (fetched from the docs site or cached in agent memory)
2. **System contracts** — `@aineff/shared-types` contains the canonical interfaces (`AINEFFEvent`, `ORFEnvelope`, `GovernanceDecision`, etc.) that agents code against
3. **Work item linking** — each work item references the docs page that specifies the system being built (e.g., "Implement RAMS per /docs/systems/cluster-2/rams")
4. **Feedback loop** — if an agent's PR is rejected, the review comments feed back into the next attempt, teaching the agent AINEFF-specific patterns

---

## Success Metrics

| Metric | Phase 1 Target | Phase 4 Target |
|--------|---------------|----------------|
| DWI success rate | Above 50% | Above 80% |
| Mean time to DWI | Under 6 hours | Under 3 hours |
| Agent uptime | Above 90% | Above 99% |
| CI-pass rate on agent PRs | Above 60% | Above 90% |
| Cost per DWI (internal) | Under $20 | Under $10 |
| ORF compliance rate | 100% | 100% |

---

## Dogfooding Strategy

AINEFF's building overview states: *"AgentCoders builds AINEFF using the same platform that AINEFF creates."*

This means:
- AgentCoders improves itself while building AINEFF
- Patterns learned on AINEFF systems feed back into AgentCoders' own packages
- AINEFF's governance, audit, and memory systems become inputs to AgentCoders' own governance, audit, and memory packages
- Both platforms co-evolve — AgentCoders gets better at building AINEs, and AINEFF's patterns get validated through real agent execution

This is the **recursive improvement loop** that makes AINEFF the ideal first tenant: every DWI delivered makes the next DWI cheaper, faster, and higher quality.
