---
sidebar_position: 2
title: Multi-Tenant Model
---

# Multi-Tenant Model

AgentCoders supports three tiers of tenant isolation, each increasing in security and resource dedication.

## Isolation Tiers

### Tier 1: Namespace Isolation

**Best for:** Starter and Growth plans

- Shared PostgreSQL and Redis instances
- Row-level isolation via `tenantId` foreign key on every table
- Kubernetes namespace per tenant with:
  - NetworkPolicy for pod-to-pod isolation
  - RBAC (ServiceAccount, Role, RoleBinding)
  - ResourceQuota (CPU/memory limits)
- Redis channels prefixed with `{tenantId}:`

**Default resource limits:**
- CPU: 250m
- Memory: 256Mi
- Max pods: 20

### Tier 2: Namespace + Dedicated Database

**Best for:** Enterprise plans

- Everything in Tier 1, plus:
- Dedicated PostgreSQL StatefulSet per tenant
- Dedicated Redis StatefulSet per tenant
- Separate connection strings per tenant

**Default resource limits:**
- CPU: 500m
- Memory: 512Mi
- Max pods: 50

### Tier 3: Dedicated Cluster

**Best for:** Custom/regulated plans

- Fully separate AKS cluster provisioned via Terraform/Pulumi
- Complete infrastructure isolation
- Custom networking, compliance, and security controls

**Default resource limits:**
- CPU: 500m–4000m
- Memory: 512Mi–4Gi
- Max pods: 200

## Provisioning Flow

Tenant provisioning is a two-phase process:

```
POST /api/tenants
    │
    ▼
Phase 1: Database Record (synchronous)
    ├── Validate slug uniqueness and format
    ├── Insert tenant record with status='provisioning'
    ├── Set default quotas (5 agents, 3 concurrent tasks, $100/day)
    └── Return tenant ID immediately
    │
    ▼
Phase 2: K8s Infrastructure (asynchronous)
    ├── TenantProvisioner generates inline YAML manifests:
    │   ├── Namespace with labels
    │   ├── RBAC (ServiceAccount, Role, RoleBinding)
    │   ├── NetworkPolicy for pod isolation
    │   ├── ResourceQuota for CPU/memory limits
    │   ├── [Tier 2] Dedicated PostgreSQL StatefulSet
    │   └── [Tier 2] Dedicated Redis StatefulSet
    ├── kubectl apply -k (Kustomize)
    ├── Wait for resource readiness (rollout status)
    ├── Update tenant status='active'
    └── Clean up temp directories
```

## Data Isolation

### Database

- Every table has a `tenantId` column (UUID, foreign key to `tenants`)
- All queries filter by `tenantId`
- Drizzle ORM enforces tenant scoping at the query level

### Redis

- All channels prefixed: `{tenantId}:channel:name`
- Channel constructors in `RedisChannels` enforce this pattern
- No cross-tenant message leakage possible

### Kubernetes

- NetworkPolicy restricts pod communication to same namespace
- RBAC limits API access to tenant's own namespace
- ResourceQuota prevents resource exhaustion

## Quota Management

The `QuotaManager` class enforces per-tenant resource quotas:

- `maxAgents` — maximum concurrent agent pods
- `maxConcurrentTasks` — maximum parallel work items
- `dailyBudgetUsd` — daily spending cap
- CPU and memory limits via K8s ResourceQuota

Quotas are stored in the `tenants.resourceQuotas` JSONB column and enforced both at the K8s level (ResourceQuota objects) and application level (budget enforcement).
