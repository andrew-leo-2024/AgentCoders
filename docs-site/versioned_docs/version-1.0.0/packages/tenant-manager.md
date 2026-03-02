---
sidebar_position: 6
title: "@agentcoders/tenant-manager"
---

# @agentcoders/tenant-manager

Multi-tenant lifecycle manager. Handles tenant creation, Kubernetes infrastructure provisioning, quota management, isolation tier configuration, and REST API.

**Entry point:** `dist/tenant-api.js`
**Source files:** 5

## Components

### TenantApi (`tenant-api.ts`)

Raw Node.js `http.createServer` REST API (no Express). See [Tenant Management API](../processes/tenant-onboarding#api-endpoints) for the full endpoint list.

17 endpoints covering tenant CRUD, verticals, usage, provisioning status, and platform service queries (audit, telemetry, failure patterns, model routes, skills, management, enhancements, insurance).

Health endpoints: `GET /healthz`, `GET /readyz`.

### OnboardingService (`onboarding.ts`)

Two-phase tenant signup:

**Phase 1 — Synchronous (immediate response):**
1. Validates slug uniqueness and format (lowercase, alphanumeric, hyphens)
2. Inserts tenant record with `status='provisioning'`
3. Sets default quotas:
   - 5 agents max
   - 3 concurrent tasks
   - $100/day budget
4. Returns tenant ID immediately

**Phase 2 — Asynchronous (background):**
1. Triggers `TenantProvisioner` without blocking the response
2. Tracks provisioning status in-memory (MVP — will move to DB)
3. Status queryable via `GET /api/tenants/:id/provisioning-status`

**Additional methods:**
- `connectAdo(tenantId, adoConfig)` — validates and stores Azure DevOps configuration
- `connectTelegram(tenantId, telegramConfig)` — validates and stores Telegram bot configuration
- `getProvisioningStatus(tenantId)` — returns current provisioning progress

### TenantProvisioner (`tenant-provisioner.ts`)

Orchestrates Kubernetes infrastructure provisioning (408 lines):

Generates **inline YAML manifests** (no external template files):

| Resource | All Tiers | Tier 2+ |
|----------|-----------|---------|
| Namespace | with tenant labels | |
| ServiceAccount | tenant-scoped | |
| Role + RoleBinding | RBAC for tenant | |
| NetworkPolicy | pod-to-pod isolation | |
| ResourceQuota | CPU/memory limits | |
| PostgreSQL StatefulSet | | dedicated instance |
| Redis StatefulSet | | dedicated instance |

**Process:**
1. Generates YAML manifests based on isolation tier
2. Writes to temp directory
3. Runs `kubectl apply -k` via `spawn()`
4. Waits for Postgres/Redis readiness (`kubectl rollout status`)
5. Updates tenant `status='active'` in database
6. Cleans up temp directories

**Deprovisioning:** `deprovisionTenant(tenantId)` deletes the entire tenant namespace.

### QuotaManager (`quota-manager.ts`)

Per-tenant resource quota enforcement:

| Quota | Description |
|-------|-------------|
| `maxAgents` | Maximum concurrent agent pods |
| `maxConcurrentTasks` | Maximum parallel work items |
| `dailyBudgetUsd` | Daily spending cap |
| CPU | K8s ResourceQuota CPU limits |
| Memory | K8s ResourceQuota memory limits |

**Methods:**
- `setQuotas(tenantId, quotas)` — patches K8s namespace ResourceQuota and DB record
- `checkQuota(tenantId, resource)` — verifies usage against limits
- `getUsage(tenantId)` — queries K8s pods and ResourceQuota, returns usage snapshot

Uses `spawn('kubectl', ...)` for K8s API operations.

### IsolationTiers (`isolation-tiers.ts`)

Tier configuration and utility functions:

| Tier | CPU | Memory | Max Pods |
|------|-----|--------|----------|
| `namespace` | 250m | 256Mi | 20 |
| `namespace-dedicated-db` | 500m | 512Mi | 50 |
| `dedicated-cluster` | 500m–4000m | 512Mi–4Gi | 200 |

**Methods:**
- `getTierConfig(tier)` — returns tier specifications
- `generateKustomization(tenantId, tier)` — builds Kustomize YAML for tenant namespace
- `getDbConnectionString(tenantId, tier)` — returns PostgreSQL URL (shared or per-tenant)
- `getRedisPrefix(tenantId)` — returns channel prefix for tenant isolation
