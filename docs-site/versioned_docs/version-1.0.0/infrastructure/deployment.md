---
sidebar_position: 4
title: Deployment
---

# Deployment

## Dockerfiles

6 multi-stage Dockerfiles in `deploy/dockerfiles/`. All run as non-root users.

| Service | Dockerfile | Base Image | Notable Dependencies |
|---------|-----------|-----------|---------------------|
| Agent Runtime | `Dockerfile.agent` | ubuntu:24.04 | Node 22, pnpm 9, Azure CLI, Claude Code CLI, git |
| Jarvis CEO | `Dockerfile.jarvis` | ubuntu:24.04 | Node 22, pnpm 9, Azure CLI, Claude Code CLI, kubectl |
| Billing Service | `Dockerfile.billing` | node:22-slim | — |
| Telegram Gateway | `Dockerfile.gateway` | node:22-slim | — |
| Tenant Manager | `Dockerfile.tenant-manager` | node:22-slim | kubectl v1.30.0 |
| Dashboard | `Dockerfile.dashboard` | node:22-slim → nginx:alpine | Vite build → nginx static serve |

### Build Examples

```bash
# Agent Runtime
docker build -f deploy/dockerfiles/Dockerfile.agent -t agentcoders/agent-runtime:latest .

# Dashboard
docker build -f deploy/dockerfiles/Dockerfile.dashboard -t agentcoders/dashboard:latest .

# All images
for svc in agent jarvis billing gateway tenant-manager dashboard; do
  docker build -f deploy/dockerfiles/Dockerfile.$svc -t agentcoders/$svc:latest .
done
```

## Kustomize Structure

```
deploy/kustomize/
├── base/
│   ├── kustomization.yaml         # Composes all base resources
│   ├── namespace.yaml             # agent-shared namespace
│   ├── postgres.yaml              # PostgreSQL 15 StatefulSet + Service
│   ├── redis.yaml                 # Redis 7 StatefulSet + Service
│   ├── billing-service.yaml       # Billing Deployment + Service
│   ├── telegram-gateway.yaml      # Gateway Deployment
│   ├── tenant-manager.yaml        # Tenant Manager Deployment + Service
│   ├── network-policies.yaml      # K8s NetworkPolicy resources
│   └── rbac.yaml                  # Role, RoleBinding, ServiceAccount
│
├── overlays/
│   ├── dev/
│   │   └── kustomization.yaml    # Reduced resources
│   ├── staging/
│   │   └── kustomization.yaml    # Base defaults
│   └── production/
│       └── kustomization.yaml    # Scaled resources
│
└── tenant-templates/
    ├── namespace-only/            # Tier 1
    │   ├── kustomization.yaml
    │   ├── namespace.yaml
    │   ├── network-policy.yaml
    │   ├── resource-quota.yaml
    │   └── rbac.yaml
    ├── namespace-dedicated-db/    # Tier 2
    │   ├── kustomization.yaml
    │   ├── dedicated-postgres.yaml
    │   └── dedicated-redis.yaml
    └── dedicated-cluster/         # Tier 3
        └── README.md             # Terraform/Pulumi (Phase 5)
```

### Resource Allocation by Environment

| Resource | Dev | Staging | Production |
|----------|-----|---------|------------|
| PostgreSQL CPU | 100m | (base) | 500m req / 2 CPU limit |
| PostgreSQL Memory | 256Mi | (base) | 512Mi req / 1Gi limit |
| PostgreSQL Storage | 5Gi | (base) | 50Gi |
| Redis CPU | 50m | (base) | 250m |
| Redis Memory | 128Mi | (base) | 512Mi |
| Redis Storage | 1Gi | (base) | 10Gi |

### Deploy Commands

```bash
# Development
kubectl apply -k deploy/kustomize/overlays/dev/

# Staging
kubectl apply -k deploy/kustomize/overlays/staging/

# Production
kubectl apply -k deploy/kustomize/overlays/production/
```

## CI/CD Pipeline

Azure Pipelines configuration: `deploy/ci/azure-pipelines.yml`

**Triggers:** `main` and `develop` branches, filtered to `packages/**` and `deploy/**` paths.

### Pipeline Stages

```
Stage 1: Build & Test
    ├── Install Node 22 + pnpm 9
    ├── pnpm install --frozen-lockfile
    ├── pnpm run build
    ├── pnpm run typecheck
    ├── pnpm run test:unit          (blocking)
    └── pnpm run test:integration   (non-blocking)
         │
         ▼
Stage 2: Build Docker Images (main branch only)
    ├── Login to Azure Container Registry (ACR: agentcoders)
    └── For each service (agent, jarvis, gateway, billing, tenant-manager, dashboard):
        ├── docker build -f deploy/dockerfiles/Dockerfile.$service
        └── docker push (tagged :$BUILD_ID and :latest)
         │
         ▼
Stage 3: Deploy to Dev
    └── kubectl apply -k deploy/kustomize/overlays/dev/
         │
         ▼
Stage 4: Deploy to Staging
    └── kubectl apply -k deploy/kustomize/overlays/staging/
         │
         ▼
Stage 5: Deploy to Production (main branch only)
    └── kubectl apply -k deploy/kustomize/overlays/production/
```

### Pipeline Variables

| Variable | Value |
|----------|-------|
| `ACR_NAME` | `agentcoders` |
| `IMAGE_TAG` | `$(Build.BuildId)` |
| `NODE_VERSION` | `22.x` |

## Tenant Provisioning

When a new tenant is created, the `TenantProvisioner` generates and applies Kubernetes manifests dynamically. See [Tenant Onboarding](../processes/tenant-onboarding) for the full flow.

### Tier 1: Namespace Only

Generates:
- Namespace with tenant labels
- RBAC (ServiceAccount, Role, RoleBinding)
- NetworkPolicy
- ResourceQuota (250m CPU, 256Mi memory, 20 pods max)

### Tier 2: Namespace + Dedicated DB

Everything in Tier 1, plus:
- Dedicated PostgreSQL StatefulSet
- Dedicated Redis StatefulSet
- Waits for rollout readiness

### Tier 3: Dedicated Cluster

Full AKS cluster provisioned via Terraform/Pulumi (Phase 5 — placeholder).
