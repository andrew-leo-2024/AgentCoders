---
sidebar_position: 2
title: Jarvis Orchestration
---

# Jarvis Orchestration

Jarvis is the CEO agent that orchestrates all specialist agent pods. This document covers the complete orchestration flow.

## Startup

1. Load config via `loadConfig(jarvisConfigSchema)`
2. Initialize Redis pub/sub connections
3. Subscribe to channels:
   - `{tenantId}:agent:heartbeat` — monitor agent health
   - `{tenantId}:vertical:escalations` — handle escalations
   - `{tenantId}:cross-vertical:new-request` — cross-vertical work
   - `{tenantId}:telegram:jarvis` — direct human commands
   - `{tenantId}:telegram:jarvis-{vertical}` — per-vertical commands
4. Initialize sub-components: SquadManager, EscalationHandler, TaskDecomposer, GsdPlanner, ConflictResolver, DailySummary, ContextManager, AgentSpawner
5. Schedule daily summary generation
6. Begin polling for new epics/features

## GSD (Get Shit Done) Planning

When a new epic or feature arrives, Jarvis decomposes it using the GSD pattern:

```
Epic Description
    │
    ▼
GsdPlanner.analyzeProject()
    │
    ├── extractSections() — parse markdown headers (##, #)
    │
    ├── For each section:
    │   └── decomposeMilestone() — break into bullet-point tasks
    │
    └── For each task:
        └── estimateComplexity() — heuristic tier estimation
    │
    ▼
GsdSpec {
  milestones: [
    {
      title: "Authentication System",
      tasks: [
        { title: "Add login form", complexity: "S" },
        { title: "JWT middleware", complexity: "M" },
        { title: "Password reset flow", complexity: "L" }
      ]
    }
  ]
}
```

## Task Decomposition

The TaskDecomposer converts GSD plans into ADO work items:

1. Call Claude Haiku CLI with decomposition prompt
2. Parse JSON response for sub-tasks
3. For each sub-task:
   - Estimate complexity tier
   - Map complexity to priority
   - Create child work item in ADO
   - Link parent-child relationship
4. Return list of created work item IDs

## Squad Management

### Heartbeat Monitoring

- SquadManager maintains in-memory map of agent states
- Updates on every heartbeat message
- Stale detection: no heartbeat for >2x `POLL_INTERVAL_MS`

### Work Assignment

```
New work item arrives
    │
    ▼
SquadManager.assignWorkItem(workItemId, vertical)
    │
    ├── getIdleAgents() — filter by vertical and status='idle'
    │
    ├── If idle agents available:
    │   └── Publish to {tenantId}:vertical:{namespace}
    │       (load-balanced selection)
    │
    └── If no idle agents:
        ├── Check for stuck agents → reassignWork()
        └── If none available → queue for next available
```

### Stuck Agent Recovery

```
getStuckAgents() — heartbeat age > 2x poll interval
    │
    ▼
reassignWork()
    ├── Move work item from stuck agent
    ├── Reset work item state in ADO
    └── Assign to healthy idle agent
```

## Conflict Resolution

When multiple agents work on overlapping files:

```
Agent A registers files: [src/auth.ts, src/types.ts]
Agent B registers files: [src/types.ts, src/api.ts]
    │
    ▼
ConflictResolver detects overlap on src/types.ts
    │
    ▼
resolveConflicts()
    ├── Priority-based winner selection
    │   (higher complexity task wins)
    │
    ├── notifyBackOff(losingAgent)
    │   └── Redis message to losing agent
    │
    └── releaseFiles(losingAgent)
        └── Agent backs off, retries later
```

## Escalation Handling

| Escalation Type | Resolution |
|----------------|------------|
| `merge-conflict` | Reassign to different agent |
| `test-failure` | Retry with test output feedback |
| `timeout` | Upgrade complexity tier (XS→S→M→L→XL) |
| `budget-exceeded` | Notify human immediately via Telegram |
| `blocked` | Check env/dependency issues, escalate to human |
| `quality-issue` | Escalate to human via Telegram |

**Resolution types:** `reassigned`, `retried`, `reclassified`, `escalated-to-human`, `deferred`

## Context Rot Detection

Jarvis monitors its own context quality:

1. `ContextManager.loadPlanningConfig()` — read `.planning/config.json`
2. Track completed vs pending task ratio
3. If completion ratio exceeds threshold → context is exhausted
4. Trigger context rotation:
   - Archive current planning context
   - Re-initialize with fresh context
   - Resume from last completed milestone

## Daily Summary

Generated automatically at `DAILY_SUMMARY_INTERVAL_MS` (default: 24h):

```
Daily Summary Report

Work Items:
  ✅ Completed: 12
  🔄 In Progress: 3
  ❌ Failed: 1

Pull Requests:
  📝 Created: 14
  ✅ Merged: 11

Escalations:
  📊 Total: 5
  ✅ Resolved: 4

Cost:
  💰 API Spend: $45.23
  🔢 Sessions: 28
  📊 Tokens: 1.2M

Revenue:
  💵 Billable DWIs: 10
  💰 Revenue: $450
  📈 Margin: 89.9%

Agents:
  👥 Total: 6
  ⏳ Idle: 2
  🔨 Working: 3
  🚫 Stuck: 0
  📴 Offline: 1
```

Sent as HTML-formatted message via Telegram outbound channel.
