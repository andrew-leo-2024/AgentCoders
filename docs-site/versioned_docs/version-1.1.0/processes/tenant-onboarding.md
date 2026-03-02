---
sidebar_position: 3
title: Tenant Onboarding
---

# Tenant Onboarding

## Signup Flow

### Phase 1: Create Tenant (Synchronous)

**Endpoint:** `POST /api/tenants`

**Request:**
```json
{
  "name": "Acme Corp",
  "slug": "acme-corp",
  "isolationTier": "namespace",
  "subscriptionPlan": "growth",
  "verticals": [
    { "name": "frontend", "type": "frontend", "agentCount": 2 },
    { "name": "backend", "type": "backend", "agentCount": 3 }
  ]
}
```

**What happens:**
1. Validate slug: lowercase, alphanumeric + hyphens, unique
2. Insert tenant record with `status='provisioning'`
3. Set default quotas:
   - `maxAgents`: 5
   - `maxConcurrentTasks`: 3
   - `dailyBudgetUsd`: $100
4. Return tenant ID immediately (non-blocking)

**Response:**
```json
{
  "id": "uuid",
  "status": "provisioning"
}
```

### Phase 2: Infrastructure Provisioning (Asynchronous)

Runs in background after response is sent:

```
TenantProvisioner generates YAML manifests
    │
    ├── Namespace (with tenant labels)
    ├── ServiceAccount
    ├── Role + RoleBinding (RBAC)
    ├── NetworkPolicy (pod isolation)
    ├── ResourceQuota (CPU/memory)
    │
    ├── [Tier 2 only]
    │   ├── Dedicated PostgreSQL StatefulSet
    │   └── Dedicated Redis StatefulSet
    │
    ▼
kubectl apply -k (temp directory)
    │
    ▼
Wait for readiness
    ├── kubectl rollout status (Postgres)
    └── kubectl rollout status (Redis)
    │
    ▼
Update tenant status → 'active'
Clean up temp directory
```

**Check status:** `GET /api/tenants/:id/provisioning-status`

### Phase 3: Connect Services

**Connect Azure DevOps:**
```
POST /api/tenants/:id — PATCH with adoConfig
{
  "adoConfig": {
    "orgUrl": "https://dev.azure.com/acme",
    "project": "main-project",
    "pat": "<personal-access-token>"
  }
}
```

**Connect Telegram:**
```
POST /api/tenants/:id — PATCH with telegramConfig
{
  "telegramConfig": {
    "botToken": "<telegram-bot-token>",
    "ownerChatId": "<chat-id>"
  }
}
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/healthz` | Health check |
| `GET` | `/readyz` | Readiness check |
| `POST` | `/api/tenants` | Create new tenant |
| `GET` | `/api/tenants/:id` | Get tenant by ID |
| `PATCH` | `/api/tenants/:id` | Update tenant (name, plan, quotas) |
| `DELETE` | `/api/tenants/:id` | Deactivate tenant (→ `deprovisioning`) |
| `POST` | `/api/tenants/:id/verticals` | Add vertical to tenant |
| `GET` | `/api/tenants/:id/usage` | Get resource usage snapshot |
| `GET` | `/api/tenants/:id/provisioning-status` | Get onboarding progress |
| `GET` | `/api/tenants/:id/audit` | Get audit events |
| `GET` | `/api/tenants/:id/telemetry` | Get telemetry records |
| `GET` | `/api/tenants/:id/failure-patterns` | Get failure patterns |
| `GET` | `/api/tenants/:id/model-routes` | Get model routes |
| `GET` | `/api/tenants/:id/management` | Get management config |
| `GET` | `/api/tenants/:id/enhancements` | Get enhancement runs |
| `GET` | `/api/tenants/:id/insurance` | Get insurance policies |
| `GET` | `/api/skills` | List all skills (global) |

## Deprovisioning

**Endpoint:** `DELETE /api/tenants/:id`

1. Sets tenant `status='deprovisioning'`
2. `TenantProvisioner.deprovisionTenant()` deletes the entire tenant namespace
3. All pods, services, and resources in the namespace are removed
4. Database records are retained for billing/audit purposes
