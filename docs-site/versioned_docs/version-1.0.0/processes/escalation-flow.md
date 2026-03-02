---
sidebar_position: 6
title: Escalation Flow
---

# Escalation Flow

When an agent encounters a problem it cannot resolve autonomously, it escalates to Jarvis. Jarvis applies automatic resolution strategies where possible and escalates to humans when necessary.

## Escalation Types & Resolutions

### merge-conflict

**Trigger:** Agent encounters merge conflict during rebase or push.

**Resolution:** `reassigned`
1. Jarvis pulls the conflicting work item from the stuck agent
2. Assigns to a different idle agent in the same vertical
3. New agent starts fresh on a clean branch

### test-failure

**Trigger:** Tests fail during the coding phase.

**Resolution:** `retried`
1. Jarvis captures test failure output
2. Sends test output as additional context to the agent
3. Agent retries with test failure feedback
4. If retry also fails → escalate to human

### timeout

**Trigger:** Watchdog kills Claude process after tier timeout exceeded.

**Resolution:** `reclassified`
1. Jarvis upgrades the complexity tier: XS → S → M → L → XL
2. Work item gets higher timeout and budget allocation
3. Agent retries with the upgraded tier
4. If already at XL → escalate to human

### budget-exceeded

**Trigger:** Agent's daily or monthly budget limit hit.

**Resolution:** `escalated-to-human`
1. Immediately notifies human via Telegram
2. Agent goes to `idle` status
3. Human decides: increase budget or defer work

### blocked

**Trigger:** Agent detects environment or dependency issue.

**Resolution:** `escalated-to-human` or `deferred`
1. Jarvis checks for common issues:
   - Missing environment variables
   - Package dependency conflicts
   - Infrastructure availability
2. If auto-resolvable → fix and retry
3. If not → escalate to human via Telegram

### quality-issue

**Trigger:** Code quality below threshold (from enhancement pipeline or review).

**Resolution:** `escalated-to-human`
1. Jarvis sends quality report to Telegram
2. Human reviews and decides: retry, reassign, or accept

## Escalation Message Flow

```
Agent encounters problem
    │
    ▼
RedisBus.publishEscalation({
  type: 'escalation',
  tenantId, agentId, workItemId,
  subType: 'merge-conflict',
  details: { error, context }
})
    │
    ▼
Published to {tenantId}:vertical:escalations
    │
    ▼
Jarvis.handleEscalation()
    │
    ├── EscalationHandler determines resolution
    │
    ├── If auto-resolved:
    │   ├── Execute resolution (reassign/retry/reclassify)
    │   ├── Write to escalations table
    │   └── Log resolution
    │
    └── If needs human:
        ├── Send Telegram message with details
        ├── Include inline keyboard if applicable
        ├── Write to escalations table (unresolved)
        └── Wait for human decision via telegram:decision channel
```

## Escalation Database Record

```typescript
{
  id: string;
  tenantId: string;
  agentId: string;
  workItemId: number;
  subType: 'merge-conflict' | 'test-failure' | 'timeout' | 'budget-exceeded' | 'blocked' | 'quality-issue';
  details: Record<string, unknown>;
  resolution?: string;
  resolvedBy?: string;    // 'jarvis' or 'human'
  resolvedAt?: Date;
  createdAt: Date;
}
```

## Resolution Priority

Jarvis attempts automatic resolution in this order:

1. **Reassign** — move work to another agent (merge-conflict)
2. **Retry** — try again with additional context (test-failure)
3. **Reclassify** — upgrade complexity tier (timeout)
4. **Escalate** — notify human (budget, blocked, quality)
