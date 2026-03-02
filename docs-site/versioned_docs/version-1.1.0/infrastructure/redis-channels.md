---
sidebar_position: 2
title: Redis Channels
---

# Redis Channels

All 23 Redis pub/sub channels, prefixed with `{tenantId}:` for multi-tenant isolation.

## Channel Definitions

Defined in `packages/shared/src/constants/redis-channels.ts`:

```typescript
const RedisChannels = {
  // Core agent channels
  vertical:               (tenantId, namespace) => `${tenantId}:vertical:${namespace}`,
  crossVerticalNew:       (tenantId) => `${tenantId}:cross-vertical:new-request`,
  crossVerticalCompleted: (tenantId) => `${tenantId}:cross-vertical:completed`,

  // Telegram channels
  telegramInbound:        (tenantId, vertical) => `${tenantId}:telegram:${vertical}`,
  telegramOutbound:       (tenantId) => `${tenantId}:telegram:outbound`,
  telegramDecision:       (tenantId) => `${tenantId}:telegram:decision`,

  // Agent communication
  agentProgress:          (tenantId, agentId) => `${tenantId}:agent:${agentId}:progress`,
  agentHeartbeat:         (tenantId) => `${tenantId}:agent:heartbeat`,

  // Platform channels
  audit:                  (tenantId) => `${tenantId}:governance:audit`,
  telemetry:              (tenantId) => `${tenantId}:governance:telemetry`,
  modelRoute:             (tenantId) => `${tenantId}:model-router:route`,
  enhancement:            (tenantId, agentId) => `${tenantId}:enhancement:${agentId}`,
  memorySync:             (tenantId) => `${tenantId}:memory:sync`,
  failureAlert:           (tenantId) => `${tenantId}:governance:failure-alert`,
};
```

## Additional Hardcoded Channels

Defined directly in service code (not in RedisChannels):

### DWI Lifecycle (billing-service)

| Channel | Publisher | Subscriber |
|---------|-----------|------------|
| `{tenantId}:dwi:work-item-created` | Agent Runtime | DWI Tracker |
| `{tenantId}:pr:linked` | Agent Runtime | DWI Tracker |
| `{tenantId}:ci:completed` | CI Pipeline | DWI Tracker, Quality Gates |
| `{tenantId}:pr:approved` | Reviewer Agent | DWI Tracker |
| `{tenantId}:pr:merged` | SCM | DWI Tracker, Quality Gates |
| `{tenantId}:dwi:work-item-closed` | Agent Runtime | DWI Tracker |
| `{tenantId}:dwi:completed` | DWI Tracker | Stripe Integration |
| `{tenantId}:billing:budget-exceeded` | DWI Tracker | Agent Runtime |
| `{tenantId}:billing:budget-alert` | Budget Enforcer | Jarvis |

## Full Channel Map

| Channel | Publisher | Subscriber | Purpose |
|---------|-----------|------------|---------|
| `vertical:{namespace}` | Jarvis | Agent Pods | Work distribution per vertical |
| `cross-vertical:new-request` | Agent | Jarvis | Cross-vertical work request |
| `cross-vertical:completed` | Agent | Jarvis | Cross-vertical completion |
| `telegram:{vertical}` | Telegram Gateway | Jarvis | Inbound user commands |
| `telegram:outbound` | Agents, Jarvis | Telegram Gateway | Outbound notifications |
| `telegram:decision` | Approval Handler | Jarvis | Approval decisions |
| `agent:{agentId}:progress` | Agent Runtime | Usage Recorder, Quality Gates | Progress updates |
| `agent:heartbeat` | Agent Runtime | Telegram Gateway, Jarvis | Agent heartbeats |
| `dwi:work-item-created` | Agent | DWI Tracker | Lifecycle start |
| `pr:linked` | Agent | DWI Tracker | PR linked to work item |
| `ci:completed` | CI Pipeline | DWI Tracker, Quality Gates | CI result |
| `pr:approved` | Reviewer | DWI Tracker | PR approved |
| `pr:merged` | SCM | DWI Tracker, Quality Gates | PR merged |
| `dwi:work-item-closed` | Agent | DWI Tracker | Work item closed |
| `dwi:completed` | DWI Tracker | Stripe | DWI finalized |
| `billing:budget-exceeded` | DWI Tracker | Agent Runtime | Hard budget stop |
| `billing:budget-alert` | Budget Enforcer | Jarvis | 80% budget warning |
| `governance:audit` | Audit Trail | Governance Bus | Audit events |
| `governance:telemetry` | Telemetry Collector | Dashboard | Metrics stream |
| `governance:failure-alert` | Failure Pattern Engine | Jarvis | Threshold reached |
| `model-router:route` | Model Router | Governance | Routing decisions |
| `enhancement:{agentId}` | Enhancement Pipeline | Agent Runtime | Enhancement results |
| `memory:sync` | Memory Store | Agent Pods | Memory synchronization |

## Pattern Subscriptions

The Usage Recorder uses `psubscribe` for pattern-based subscriptions:

```
{tenantId}:agent:*:progress
```

This matches all agent progress channels without subscribing to each individually.
