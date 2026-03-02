---
sidebar_position: 10
title: "@agentcoders/governance"
---

# @agentcoders/governance

Governance framework providing audit trails, telemetry collection, decision provenance, AI insurance, failure pattern detection, authority decay, and a governance message bus.

**Entry point:** `dist/audit-trail.js`
**Source files:** 8

## Components

### AuditTrail (`audit-trail.ts`)

Immutable event recording with buffered writes:

- Events buffered in memory, flushed to `auditEvents` table periodically
- Flush interval controlled by `AUDIT_FLUSH_INTERVAL_MS` (default: 5000ms)
- Simultaneously publishes to `{tenantId}:governance:audit` Redis channel
- Events are immutable — no update/delete operations
- Supports parent-child event relationships via `parentEventId`

**Event categories:** `agent`, `task`, `model`, `enhancement`, `security`, `billing`, `governance`

**Methods:**
- `record(event)` — add event to buffer + publish to Redis
- `query(tenantId, filters)` — query events with optional category/time filtering
- `start()` / `stop()` — manage flush timer

### TelemetryCollector (`telemetry-collector.ts`)

Metrics collection with buffered persistence:

- Buffers metrics, flushes to `telemetryRecords` table
- Flush interval: `TELEMETRY_FLUSH_INTERVAL_MS` (default: 10000ms)
- Publishes to `{tenantId}:governance:telemetry` Redis channel

**Methods:**
- `record(tenantId, agentId, metricName, value, dimensions)` — buffer metric
- `flush()` — write buffered metrics to database
- `query(tenantId, filters)` — retrieve metrics

### DecisionProvenanceTracker (`decision-provenance.ts`)

Full traceability for AI decisions:

```typescript
interface DecisionProvenance {
  id: string;
  tenantId: string;
  agentId: string;
  workItemId?: number;
  decisionType: string;
  modelUsed: string;
  promptHash: string;
  contextSources: string[];
  confidenceScore: number;
}
```

**Methods:**
- `record(provenance)` — store decision record
- `trace(tenantId, workItemId)` — retrieve all decisions for a work item (ordered by time)
- `getByAgent(tenantId, agentId, limit?)` — retrieve decisions by agent (default limit: 50)

### FailurePatternEngine (`failure-pattern-engine.ts`)

Detects recurring failures via SHA256 pattern hashing:

**Behavior:**
1. On failure, compute SHA256 hash of `"${error.name}: ${error.message}"`
2. Check for existing pattern with same hash
3. If exists: increment `occurrenceCount`, update `lastSeenAt`
4. If new: create pattern record
5. **Alert threshold:** `HIGH_FREQUENCY_THRESHOLD = 5` occurrences
6. Publish alert to `{tenantId}:governance:failure-alert`

**Pattern statuses:** `active`, `resolved`, `suppressed`

**Methods:**
- `recordFailure(tenantId, error, category)` — record and detect patterns
- `getPatterns(tenantId, status?)` — list patterns, ordered by `lastSeenAt`
- `resolvePattern(patternId, resolution)` — mark as resolved with resolution text
- `predictFailure(tenantId, context)` — checks if context matches known active patterns (50% word-match threshold)

**Failure categories:** `model-error`, `timeout`, `validation`, `infrastructure`, `logic`, `unknown`

### AIInsurance (`ai-insurance.ts`)

SLA/quality guarantee system:

**Policy types:**
- `sla-guarantee` — service level agreement compliance
- `quality-guarantee` — code quality standards
- `uptime-guarantee` — availability targets
- `data-protection` — data handling compliance

**Methods:**
- `createPolicy(tenantId, type, coverage, slaTargets, expiresAt)` — create policy
- `fileClaim(tenantId, policyId, incidentDetails)` — file claim (marks policy as `claimed`)
- `resolveClaim(claimId, resolution)` — resolve with resolution text
- `checkSlaCompliance(tenantId)` — returns `{ compliant: boolean, violations: string[] }`
- `getActivePolicies(tenantId)` — list active policies

**Policy lifecycle:** `active` → `expired` (auto on expiry check) or `claimed` (on claim filed) → `suspended`

### AuthorityDecay (`authority-decay.ts`)

Time-based authority grant management:

```typescript
interface AuthorityGrant {
  agentId: string;
  scope: string;
  expiresAt: Date;
  grantedBy: string;
}
```

- Agents receive scoped authority grants (e.g., "deploy-to-staging")
- Grants expire automatically after `expiresAt`
- Periodic check interval: `AUTHORITY_DECAY_CHECK_INTERVAL_MS` (default: 60000ms)
- Auto-revokes expired grants

**Methods:**
- `grant(grant)` — issue authority grant
- `checkAuthority(agentId, scope)` — verify agent has valid grant for scope
- `revokeExpired()` — remove expired grants (called automatically on timer)
- `start()` / `stop()` — manage decay timer

### GovernanceBus (`governance-bus.ts`)

Central Redis pub/sub bus for governance events:

**Published channel types:**
- `{tenantId}:governance:audit` — audit events
- `{tenantId}:governance:telemetry` — telemetry records
- `{tenantId}:governance:failure-alert` — failure pattern alerts

**Methods:**
- `publishAudit(tenantId, event)` — publish audit event
- `publishTelemetry(tenantId, record)` — publish telemetry record
- `publishFailureAlert(tenantId, pattern)` — publish failure alert
- `subscribe(tenantId, channel, handler)` — subscribe to governance channel
- `stop()` — disconnect and clean up
