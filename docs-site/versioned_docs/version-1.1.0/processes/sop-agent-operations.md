---
sidebar_position: 8
title: "SOP: Agent Operations"
---

# SOP: Agent Operations — v1

:::info Version History
- **v1 (2026-03-01):** Initial SOP covering agent deployment, monitoring, incident response, and capacity management.
:::

## Purpose

Standard Operating Procedure for day-to-day operation of AgentCoders agent pods including deployment, monitoring, scaling, and incident response.

---

## SOP-OPS-001: Agent Pod Deployment

### Pre-Deployment Checklist

| Check | Command | Expected |
|-------|---------|----------|
| Docker image builds | `docker build -f deploy/dockerfiles/Dockerfile.agent-runtime .` | Build succeeds |
| Image pushed to registry | `docker push registry/agentcoders/agent-runtime:tag` | Push succeeds |
| K8s namespace exists | `kubectl get ns tenant-{slug}` | Namespace found |
| Secrets created | `kubectl get secret -n tenant-{slug}` | ADO/GitHub PAT, Claude API key present |
| ConfigMap ready | `kubectl get configmap -n tenant-{slug}` | Agent config present |

### Deployment Steps

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Apply Kustomize overlay: `kubectl apply -k deploy/overlays/{tenant}` | Resources created |
| 2 | Wait for rollout: `kubectl rollout status deploy/agent-pod-{vertical} -n tenant-{slug}` | Rollout complete |
| 3 | Verify health endpoint: `curl agent-pod:8080/healthz` | Returns 200 |
| 4 | Verify readiness endpoint: `curl agent-pod:8080/readyz` | Returns 200 |
| 5 | Check Redis heartbeat: subscribe to `{tenantId}:agent:heartbeat` | Heartbeats received |
| 6 | Check agent status via `/status` Telegram command | Agent shows idle |

### Rollback

```bash
kubectl rollout undo deploy/agent-pod-{vertical} -n tenant-{slug}
```

---

## SOP-OPS-002: Agent Monitoring

### Health Checks (Continuous)

| Signal | Source | Healthy | Degraded | Critical |
|--------|--------|---------|----------|----------|
| Heartbeat age | Redis `{tenantId}:agent:heartbeat` | Under 60s | 60-120s | Over 120s (STALE) |
| Pod status | K8s pod phase | Running | Pending | CrashLoopBackOff |
| Memory usage | K8s metrics | Under 512MB | 512MB-1GB | Over 1GB (OOM risk) |
| CPU usage | K8s metrics | Under 50% | 50-80% | Over 80% |
| Error rate | Structured logs | Under 5% | 5-15% | Over 15% |
| DWI success rate | Billing DB | Over 60% | 40-60% | Under 40% |

### Daily Operations Checklist

| Time | Action | Tool |
|------|--------|------|
| 09:00 | Review overnight daily summary from Jarvis | Telegram |
| 09:15 | Check all agent pods are Running | `kubectl get pods -n tenant-{slug}` |
| 09:30 | Review escalation queue | Dashboard or `GET /api/tenants/{id}/audit` |
| 12:00 | Mid-day DWI throughput check | Dashboard Value page |
| 17:00 | End-of-day cost review | `GET /api/tenants/{id}/usage` |

### Alert Thresholds

| Alert | Condition | Action |
|-------|-----------|--------|
| Agent Stale | No heartbeat for over 120 seconds | Check pod logs, restart if needed |
| Budget Warning | 80% of daily budget consumed | Notify tenant, consider pausing low-priority work |
| Budget Exceeded | 100% of daily budget consumed | Agents auto-idle, notify tenant |
| High Error Rate | Over 15% of tasks failing | Investigate logs, check SCM connectivity |
| OOM Kill | Pod killed by K8s OOM | Increase memory limit, review for memory leaks |
| CrashLoop | Pod restarting repeatedly | Check logs for startup errors, verify secrets |

---

## SOP-OPS-003: Incident Response

### Severity Levels

| Severity | Definition | Response Time | Examples |
|----------|-----------|---------------|---------|
| **SEV-1** | All agents down, no DWIs being delivered | Under 15 minutes | K8s cluster issue, Redis down, Claude API outage |
| **SEV-2** | One vertical down or degraded | Under 1 hour | Single pod CrashLoop, SCM token expired |
| **SEV-3** | Individual agent issue | Under 4 hours | One agent stuck, merge conflict loop |
| **SEV-4** | Cosmetic or low-impact | Next business day | Dashboard rendering issue, stale metric |

### Incident Response Procedure

```text
1. DETECT
   ├── Automated: alert from monitoring/heartbeat
   └── Manual: human notices via Telegram or dashboard

2. TRIAGE
   ├── Determine severity (SEV-1 through SEV-4)
   ├── Identify affected tenants and verticals
   └── Assign incident owner

3. CONTAIN
   ├── SEV-1/2: Pause affected agent pods (kubectl scale --replicas=0)
   ├── Prevent cascading failures (budget enforcement active)
   └── Notify affected tenants via Telegram

4. DIAGNOSE
   ├── Check pod logs: kubectl logs deploy/agent-pod-{vertical} -n tenant-{slug}
   ├── Check Redis connectivity: redis-cli -h {host} ping
   ├── Check SCM connectivity: curl ADO/GitHub API with tenant PAT
   ├── Check Claude API: verify API key and rate limits
   └── Check resource usage: kubectl top pods -n tenant-{slug}

5. RESOLVE
   ├── Apply fix (restart pod, rotate secret, update config)
   ├── Verify fix: agent resumes heartbeat + picks up work
   └── Monitor for 30 minutes post-fix

6. POST-INCIDENT
   ├── Update escalation record in database
   ├── Write incident summary (what happened, root cause, fix, prevention)
   └── Update monitoring thresholds if gap identified
```

### Common Incidents and Resolutions

| Incident | Root Cause | Resolution |
|----------|-----------|-----------|
| Agent stuck in `working` forever | Claude process hung or OOM | Kill pod, K8s restarts automatically |
| SCM 401 errors | PAT expired | Rotate PAT, update K8s secret |
| Redis connection refused | Redis pod restarted | Agent auto-reconnects (ioredis retry) |
| Claude API 429 | Rate limited | Agent backoff is automatic (exponential retry) |
| Agent creates empty PRs | CLAUDE.md missing or wrong build commands | Fix CLAUDE.md, retry work item |
| Merge conflicts on every PR | Stale base branch | Agent does preflight rebase (built-in) |
| Budget exceeded mid-task | Large XL tasks consuming too much | Increase daily budget or reclassify task |

---

## SOP-OPS-004: Capacity Management

### Scaling Up

| Trigger | Action |
|---------|--------|
| Backlog depth over 20 items per vertical | Add 1-2 coder agents to vertical |
| DWI wait time over 4 hours | Add agents or increase concurrency quota |
| New vertical requested | Deploy new agent pod + Jarvis CEO |

### Scaling Down

| Trigger | Action |
|---------|--------|
| Backlog empty for over 24 hours | Scale vertical to 1 agent |
| Tenant requests reduced capacity | Reduce agent count via `PATCH /api/tenants/{id}` |
| Cost optimization | Merge low-traffic verticals |

### Agent Pod Resource Limits

| Resource | Request | Limit |
|----------|---------|-------|
| CPU | 250m | 1000m |
| Memory | 256Mi | 1Gi |
| Ephemeral storage | 1Gi | 5Gi |

---

## SOP-OPS-005: Secret Rotation

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| Claude API key | Every 90 days | Update K8s secret, rolling restart |
| SCM PAT (ADO/GitHub) | Every 90 days or on expiry | Tenant provides new PAT, update secret |
| AgentCoders API key | Every 90 days | Generate new key, update tenant config |
| Stripe API key | Every 90 days | Update K8s secret, verify webhook delivery |
| Redis password | Every 180 days | Update Redis config + all client secrets |
| Postgres password | Every 180 days | Update Postgres + Drizzle connection strings |

### Rotation Procedure

1. Generate new secret value
2. Update K8s secret: `kubectl create secret generic {name} --from-literal=key={value} -n tenant-{slug} --dry-run=client -o yaml | kubectl apply -f -`
3. Rolling restart affected deployments: `kubectl rollout restart deploy/{name} -n tenant-{slug}`
4. Verify connectivity post-rotation
5. Revoke old secret value
