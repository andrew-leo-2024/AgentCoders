---
sidebar_position: 7
title: "@agentcoders/dashboard"
---

# @agentcoders/dashboard

React + Vite web dashboard for monitoring AgentCoders operations. Served via nginx in production.

**Source files:** 14

## Pages

10 pages accessible via React Router:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `ValueDashboard` | ROI metrics: work items delivered, PRs merged, cycle time vs human baseline, cost vs human equivalent, savings percentage |
| `/agents` | `AgentStatus` | Real-time agent table: agent ID, vertical, status badge (working/idle/blocked/error/offline), current work item, daily completions |
| `/audit` | `AuditTrail` | Immutable event log with category filtering (agent, task, model, enhancement, security, billing, governance). Shows timestamp, agent ID, event type, category, details |
| `/telemetry` | `TelemetryDashboard` | Real-time metrics: total records, unique agents, metric types, top agents by record count, recent metrics table (name, value, unit, tags) |
| `/failures` | `FailurePatterns` | Pattern detection: signature, category (model-error, timeout, validation, infrastructure, logic, unknown), occurrence count, status (active/resolved/suppressed), first/last seen, resolution, affected agents |
| `/models` | `ModelRouter` | Model routing & cost analysis: provider cost summary (avg input/output costs per 1k tokens), priority-sorted route table with model IDs, pricing, max tokens, capability tags |
| `/skills` | `SkillCatalog` | Skills grouped by category (frontend, backend, devops, security, testing, design, general): skill name, version, description, enabled/disabled toggle, creation date |
| `/management` | `ManagementModel` | Org topology visualization: model type banner (Spotify/SAFe/Team Topologies), cadence config (standup/review/planning cron expressions), group hierarchy tree with escalation paths and timeout policies |
| `/enhancements` | `EnhancementPipeline` | Pipeline run history: status counts (queued/running/passed/failed), run cards showing agent/work item ID, overall score, duration. Expandable stage details (name, status, score, duration per stage) |
| `/insurance` | `InsuranceDashboard` | AI-Insurance & SLA compliance: policy summary cards (count, coverage amount, premium), policy table (type, coverage limits, SLA target/actual, compliance status), claims table (reason, amount requested, status, filed/resolved dates) |

## Data Fetching

All pages fetch data from the Tenant Manager REST API:

- `GET /api/tenants/:id/audit` → Audit Trail page
- `GET /api/tenants/:id/telemetry` → Telemetry Dashboard
- `GET /api/tenants/:id/failure-patterns` → Failure Patterns page
- `GET /api/tenants/:id/model-routes` → Model Router page
- `GET /api/skills` → Skill Catalog page
- `GET /api/tenants/:id/management` → Management Model page
- `GET /api/tenants/:id/enhancements` → Enhancement Pipeline page
- `GET /api/tenants/:id/insurance` → Insurance Dashboard page

## Build & Deploy

```bash
# Development
pnpm --filter @agentcoders/dashboard dev

# Production build
pnpm --filter @agentcoders/dashboard build
# Output: packages/dashboard/dist/
```

Production deployment uses `Dockerfile.dashboard`:
- Build stage: `node:22-slim` with Vite build
- Serve stage: `nginx:alpine` serving static files
- Custom nginx config: `deploy/dockerfiles/nginx-dashboard.conf`
