---
sidebar_position: 1
title: Tenant Integration Guide
---

# Tenant Integration Guide — v1

:::info Version History
- **v1 (2026-03-01):** Initial guide. Written for AINEFF as first tenant, structured for any AINE targeting entropy domains across NAICS/SIC industries.
:::

## What AgentCoders Offers Your Project

AgentCoders is an **autonomous AI development factory** — you give it work items, it delivers merged, quality-verified code. Your project keeps its own architecture, repository structure, and release process. AgentCoders plugs in as your development workforce.

### The Contract

| You Provide | AgentCoders Delivers |
|-------------|---------------------|
| Work items in Azure DevOps or GitHub (title, description, acceptance criteria) | Feature branches, code, PRs, reviews |
| Repository access (PAT or OAuth) | Merged PRs that pass your CI pipeline |
| Complexity classification (or let AgentCoders estimate) | DWI invoices — you pay only for merged, quality-verified work |

### The 6 Quality Gates

Every deliverable passes all 6 gates before you're billed:

1. Work item exists in your SCM
2. PR linked to the work item
3. Your CI pipeline passes
4. PR approved by reviewer (agent or human)
5. PR merged to main
6. Work item marked closed

If any gate fails within 30 minutes of merge, AgentCoders **auto-reverts** and you pay nothing.

### What You Don't Pay For

- Failed attempts, retries, agent idle time
- Tokens consumed, API calls, compute hours
- Internal agent orchestration overhead

You see one line item per DWI on your invoice: work item title, complexity tier, and price.

---

## Onboarding Steps

### Step 1: Tenant Creation

AgentCoders provisions your isolated environment:

```
POST /api/tenants
{
  "name": "AINEFF",
  "slug": "aineff",
  "isolationTier": "namespace-dedicated-db",
  "subscriptionPlan": "enterprise",
  "resourceQuotas": {
    "maxAgents": 10,
    "maxConcurrentTasks": 20,
    "dailyBudgetUsd": 500
  }
}
```

### Step 2: SCM Configuration

Connect your Azure DevOps organization or GitHub repositories:

```
PATCH /api/tenants/{id}
{
  "adoConfig": {
    "orgUrl": "https://dev.azure.com/your-org",
    "project": "your-project",
    "pat": "your-personal-access-token"
  }
}
```

Or for GitHub:
```json
{
  "githubConfig": {
    "owner": "your-org",
    "repo": "your-repo",
    "token": "ghp_..."
  }
}
```

### Step 3: Vertical Configuration

Define what types of work AgentCoders handles:

```
POST /api/tenants/{id}/verticals
{
  "name": "Core Systems",
  "type": "backend",
  "agentCount": 3
}
```

Each vertical gets its own agent pod (coders + reviewer + tester) managed by Jarvis.

### Step 4: Work Item Tagging

Tag work items in your backlog for AgentCoders to pick up:
- **Azure DevOps:** Add tag `agent-ready` to work items
- **GitHub:** Add label `agent-ready` to issues

AgentCoders polls for items matching your vertical tags and `New`/`Open` state.

---

## Complexity Tiers & Pricing

| Tier | Description | Example | Price Range |
|------|-------------|---------|-------------|
| **XS** | Typo fix, config change, one-liner | Fix README typo | $15-25 |
| **S** | Single function, small bug fix | Add validation to input field | $35-50 |
| **M** | Feature spanning 2-5 files | Add REST endpoint with tests | $75-120 |
| **L** | Cross-cutting feature, 5-15 files | Implement auth middleware | $150-250 |
| **XL** | Architectural change, 15+ files | Add multi-tenant support | $300-500 |

AgentCoders estimates complexity automatically using keyword heuristics + Claude triage. You can override by adding `complexity:M` (or XS/S/L/XL) to the work item tags.

---

## What Your Repositories Need

### Minimum Requirements

1. **A CI pipeline** that runs on PR creation (GitHub Actions, Azure Pipelines, etc.)
2. **A main/develop branch** that agents target for PRs
3. **Work items with clear descriptions** — the better the acceptance criteria, the higher the DWI success rate

### Recommended Setup

- **CLAUDE.md at repo root** — project-specific instructions for the coding agent (build commands, test commands, style conventions)
- **Test suite** — agents verify their own work before opening PRs
- **Linting/formatting** — agents respect `.eslintrc`, `prettier`, etc.
- **Branch protection** — require PR reviews and CI pass before merge

### What AgentCoders Writes to Your Repo

During execution, agents create these temporary files (cleaned up after PR):

| Path | Purpose |
|------|---------|
| `.claude/TASK.md` | Current work item context, acceptance criteria |
| `.claude/MEMORY.md` | Agent's accumulated codebase knowledge |
| `.claude/skills/*.md` | Active skill definitions |
| `.planning/task-*.json` | State tracking for recovery |

---

## Monitoring Your Agents

### Dashboard

Access your tenant dashboard at the AgentCoders dashboard URL. Key pages:

- **Value Dashboard** — ROI metrics: DWIs delivered, cost savings vs. human baseline
- **Agent Status** — Real-time view of agent activity, current assignments
- **Audit Trail** — Immutable log of every agent action

### Telegram

Connect Telegram for real-time notifications and approvals:

```
/status         — Agent status with stale detection
/boards         — Work summary across verticals
/freerain web   — Autonomous mode for web vertical
/leash web      — Supervised mode (approval required for merges)
```

### API

All data is available via REST:

```bash
# Get tenant usage
GET /api/tenants/{id}/usage

# Get provisioning status
GET /api/tenants/{id}/provisioning-status

# Get audit events
GET /api/tenants/{id}/audit

# Get telemetry
GET /api/tenants/{id}/telemetry
```

All API calls require `Authorization: Bearer {apiKey}` header.

---

## For AINEFF Specifically

:::tip First Tenant Reference
For the complete AINEFF onboarding plan including phased build schedule, cost estimates, agent skills, and ORF integration details, see **[AINEFF Onboarding](./aineff-onboarding)**.
:::

### Scale Considerations

AINEFF has **85 repositories** across 6 system clusters and 7 platforms. AgentCoders handles this through:

- **Multiple verticals** — one per cluster (Enterprise Birth, Governance, Policy, Audit, Safeguards, Intelligence)
- **Multiple agents per vertical** — scale coder count based on backlog depth
- **Jarvis decomposition** — epics like "Implement RAMS system" get broken into atomic work items

### Recommended Vertical Mapping

| AINEFF Cluster | AgentCoders Vertical | Suggested Agents |
|----------------|---------------------|------------------|
| Enterprise Birth (EMS, EGMS, GCS, IGS, TIS, FBS, PDES, GAAGR) | `enterprise-birth` | 3 coders + 1 reviewer |
| Governance (RAMS, GBL, OGCRS, HOES, HCDI, HCL, COIE, ADS, NDAR) | `governance` | 3 coders + 1 reviewer |
| Policy & Semantics (PIES, JAL, CVSS, MIDC, SCS) | `policy` | 2 coders + 1 reviewer |
| Audit & Death (ACTS, FMS, TDES, NPOS, ECS, RPS, MES) | `audit` | 2 coders + 1 reviewer |
| Safeguards (SHFS, NLO-R, SSDT, CEFP, SEI, RRLS) | `safeguards` | 2 coders + 1 reviewer |
| Intelligence & Revenue (BPMN, Role Engine, Industry Intel, Protocol Router, Audit Chain, ACOS, Telemetry, Revenue Intel) | `intelligence` | 3 coders + 1 reviewer |
| Platforms (ORF, AINE Runtime, AINEG, WGE, LevelupMax, Frankmax, LPI) | `platforms` | 2 coders + 1 reviewer |

### Work Item Structure for AINEFF

Each AINEFF system is a standalone deployable service. Recommended work item decomposition:

```
Epic: "Implement RAMS — Role & Authority Management System"
├── Story: "RAMS: Drizzle schema + migrations"
│   └── Tags: agent-ready, governance, complexity:M
├── Story: "RAMS: REST API endpoints (CRUD)"
│   └── Tags: agent-ready, governance, complexity:M
├── Story: "RAMS: Authority grant/revoke logic"
│   └── Tags: agent-ready, governance, complexity:L
├── Story: "RAMS: Time-based authority decay"
│   └── Tags: agent-ready, governance, complexity:M
├── Story: "RAMS: Unit tests"
│   └── Tags: agent-ready, governance, complexity:S
└── Story: "RAMS: Dockerfile + Helm chart"
    └── Tags: agent-ready, governance, complexity:S
```

---

## For Future AINE Tenants

### What is an AINE?

An AI-Native Enterprise — a self-governing digital entity with its own governance, compliance, agent teams, and operational procedures. AINEs are manufactured (not built incrementally) and operate under protocol governance.

### How AgentCoders Serves AINEs

Each AINE targeting an **entropy domain** (a systemic force that degrades enterprise operations across industries) can use AgentCoders as its development workforce:

| Entropy Domain | Example AINE Focus | AgentCoders Role |
|---------------|-------------------|-----------------|
| Governance decay | Authority, compliance, audit systems | Ship governance microservices as DWIs |
| Operational entropy | Process automation, workflow orchestration | Ship BPMN engines, agent orchestrators |
| Knowledge entropy | Institutional knowledge loss, context drift | Ship memory systems, knowledge graphs |
| Security entropy | Credential sprawl, vulnerability accumulation | Ship security scanners, policy enforcers |
| Financial entropy | Budget drift, cost opacity, billing complexity | Ship billing systems, cost trackers |
| Communication entropy | Cross-team misalignment, information silos | Ship messaging systems, protocol routers |

### AINE Onboarding Pattern

Every AINE follows the same integration pattern regardless of its entropy domain:

1. **Create tenant** with appropriate isolation tier
2. **Map systems to verticals** — group related repos by domain cluster
3. **Structure work items** — decompose each system into schema + API + logic + tests + infra
4. **Tag and release** — AgentCoders picks up, delivers, and bills per DWI
5. **Monitor via dashboard** — track DWI success rate, cost efficiency, delivery velocity

### Cross-Industry Applicability

AgentCoders serves AINEs across all NAICS/SIC classifications because the integration is **work-item-agnostic**. Whether the AINE targets:

- **Healthcare (NAICS 62)** — compliance systems, patient data governance
- **Financial Services (NAICS 52)** — audit trails, regulatory reporting
- **Manufacturing (NAICS 31-33)** — supply chain orchestration, quality systems
- **Technology (NAICS 54)** — platform engineering, DevOps automation
- **Government (NAICS 92)** — transparency systems, public accountability

The contract is the same: you describe the work, AgentCoders delivers merged code, you pay per DWI.

### Shared Infrastructure Benefits

AINEs on AgentCoders share platform improvements:
- **Agent memory** — patterns learned on one project inform future work
- **Skill registry** — domain-specific skills (security-audit, api-design, etc.) improve over time
- **Enhancement pipeline** — security scanning, confidence scoring applied to all deliverables
- **Governance** — audit trails, telemetry, failure pattern detection available to all tenants
