---
sidebar_position: 7
title: "SOP: Tenant Onboarding"
---

# SOP: Tenant Onboarding — v1

:::info Version History
- **v1 (2026-03-01):** Initial SOP. Derived from AINEFF first-tenant onboarding experience.
:::

## Purpose

Standard Operating Procedure for onboarding a new tenant to the AgentCoders platform. This SOP covers every step from initial contact to first DWI delivery.

## Scope

Applies to all tenant types: individual projects, AINE frameworks (like AINEFF), and enterprise customers.

## Prerequisites

- Tenant has a GitHub or Azure DevOps organization
- Tenant has at least one repository with CI configured
- Tenant has work items (issues/stories) with descriptions
- AgentCoders platform is running (tenant-manager, agent-runtime, jarvis-runtime deployed)
- Docker + K8s cluster available for agent pods

---

## Procedure

### SOP-ONB-001: Pre-Qualification

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 1.1 | Confirm tenant's SCM provider (GitHub or Azure DevOps) | Sales | SCM URL accessible |
| 1.2 | Verify at least 1 repo has CI pipeline configured | Sales | CI badge or recent run visible |
| 1.3 | Confirm work item backlog exists with descriptions | Sales | At least 5 items with acceptance criteria |
| 1.4 | Agree on isolation tier (namespace / namespace+dedicated-db / dedicated-cluster) | Sales + Tenant | Signed agreement |
| 1.5 | Agree on subscription plan (starter / growth / enterprise) | Sales + Tenant | Plan selected |
| 1.6 | Agree on initial resource quotas (max agents, daily budget) | Sales + Tenant | Quotas confirmed |

### SOP-ONB-002: Tenant Provisioning

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 2.1 | Generate API key for tenant via `generateApiKey()` | Platform | Key generated in `keyId.hmac` format |
| 2.2 | Create tenant record via `POST /api/tenants` | Platform | HTTP 201, tenant ID returned |
| 2.3 | Wait for provisioning to complete | Platform | `GET /provisioning-status` returns `active` |
| 2.4 | Verify K8s namespace created | Platform | `kubectl get ns tenant-{slug}` succeeds |
| 2.5 | Verify RBAC and NetworkPolicy applied | Platform | `kubectl get role,rolebinding,netpol -n tenant-{slug}` |
| 2.6 | For dedicated-db tiers: verify Postgres and Redis pods running | Platform | `kubectl get pods -n tenant-{slug}` shows Ready |
| 2.7 | For dedicated-db tiers: verify migrations ran | Platform | `GET /provisioning-status` shows migration success |

### SOP-ONB-003: SCM Connection

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 3.1 | Obtain PAT or OAuth token from tenant | Tenant | Token with repo + work item permissions |
| 3.2 | Configure SCM via `PATCH /api/tenants/{id}` | Platform | HTTP 200, config saved |
| 3.3 | Verify SCM connectivity by listing work items | Platform | `GET /api/tenants/{id}/usage` shows work item count |
| 3.4 | Confirm branch protection rules on target repos | Tenant | PR required, CI must pass before merge |

### SOP-ONB-004: Vertical Configuration

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 4.1 | Map tenant's repos/domains to verticals | Platform + Tenant | Vertical list agreed |
| 4.2 | Create verticals via `POST /api/tenants/{id}/verticals` | Platform | Verticals created |
| 4.3 | Configure agent count per vertical | Platform | Matches agreed quotas |
| 4.4 | Deploy agent pods to tenant namespace | Platform | Pods running in K8s |
| 4.5 | Deploy Jarvis CEO per vertical | Platform | Jarvis pods running |
| 4.6 | Verify agents register heartbeats | Platform | Redis heartbeat messages observed |

### SOP-ONB-005: CLAUDE.md Setup

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 5.1 | Create CLAUDE.md template for tenant repos | Platform | Template reviewed by tenant |
| 5.2 | Add build/test/lint commands | Tenant | Commands verified to work locally |
| 5.3 | Add architectural constraints and conventions | Tenant | Conventions documented |
| 5.4 | Commit CLAUDE.md to repo root | Tenant | File visible in repo |

### SOP-ONB-006: Smoke Test

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 6.1 | Tag one simple work item (XS or S complexity) with `agent-ready` | Platform | Tag visible in SCM |
| 6.2 | Wait for agent to pick up the work item | Platform | Agent heartbeat shows `working` |
| 6.3 | Verify agent creates feature branch | Platform | Branch visible in SCM |
| 6.4 | Verify agent opens PR | Platform | PR created with correct target |
| 6.5 | Verify CI runs on PR | Platform | CI pipeline triggered |
| 6.6 | Merge PR and verify DWI completion | Platform | DWI record shows `completed`, `isBillable: true` |
| 6.7 | Verify Stripe metered usage reported | Platform | Stripe dashboard shows usage event |

### SOP-ONB-007: Telegram Connection (Optional)

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 7.1 | Create Telegram bot via BotFather | Tenant | Bot token obtained |
| 7.2 | Configure Telegram via `PATCH /api/tenants/{id}` | Platform | Config saved |
| 7.3 | Send `/status` in Telegram | Tenant | Bot responds with agent status |
| 7.4 | Test `/freerain` and `/leash` commands | Tenant | Mode changes confirmed |

### SOP-ONB-008: Handover

| Step | Action | Owner | Verification |
|------|--------|-------|-------------|
| 8.1 | Share dashboard URL with tenant | Platform | Tenant can access dashboard |
| 8.2 | Share API key securely | Platform | Key stored in tenant's secret manager |
| 8.3 | Provide REST API documentation | Platform | Tenant confirms access |
| 8.4 | Schedule weekly check-in for first month | Platform | Calendar invite sent |
| 8.5 | Tag remaining backlog items as `agent-ready` | Tenant | Agents begin processing |

---

## Rollback Procedure

If onboarding fails at any step:

| Failure Point | Rollback Action |
|--------------|----------------|
| Provisioning fails | `DELETE /api/tenants/{id}` to trigger deprovisioning |
| SCM connection fails | Remove SCM config, re-verify token permissions |
| Agent pods crash | Check logs, verify Docker image, rebuild if needed |
| Smoke test DWI fails | Review agent logs, adjust CLAUDE.md, retry |

---

## AINEFF-Specific Addendum

For AINEFF onboarding, additional steps apply:

| Step | Action |
|------|--------|
| A.1 | Load `orf-specialist` skill on all agent pods |
| A.2 | Configure 7 verticals (one per cluster + platforms) |
| A.3 | Verify `@aineff/shared-types` repo has CLAUDE.md with ORF constraint |
| A.4 | Smoke test includes ORF envelope wrapping verification |
| A.5 | Connect 85 repos via GitHub App installation (not individual PATs) |

See [AINEFF Onboarding](../tenant-guide/aineff-onboarding) for the complete AINEFF-specific plan.
