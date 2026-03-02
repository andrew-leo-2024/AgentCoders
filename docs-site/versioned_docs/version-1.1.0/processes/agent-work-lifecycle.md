---
sidebar_position: 1
title: Agent Work Item Lifecycle
---

# Agent Work Item Lifecycle

The complete flow from an unclaimed work item to a billed Delivered Work Item (DWI).

## Full Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│                    POLL PHASE                           │
├─────────────────────────────────────────────────────────┤
│ 1. PollLoop waits pollIntervalMs + random jitter (0-30s)│
│ 2. Non-reentrant guard (skip if previous tick running)  │
│ 3. CostTracker checks daily/monthly budget              │
│    └── If exceeded → skip tick, publish budget-exceeded  │
│ 4. AdoClient queries unclaimed work items via WIQL      │
│    └── Filter: vertical tag, state=New, not claimed     │
│ 5. If no items → back to step 1                        │
└──────────────────────┬──────────────────────────────────┘
                       │ work item found
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   TRIAGE PHASE                          │
├─────────────────────────────────────────────────────────┤
│ 6. ClaudeCodeExecutor runs triage (Claude Haiku)       │
│    └── Mode: 'triage', fewer turns, fast model          │
│ 7. ComplexityEstimator determines tier (XS/S/M/L/XL)   │
│    └── Keyword heuristics → Haiku fallback if ambiguous │
│ 8. Set timeout from COMPLEXITY_TIMEOUTS_MS[tier]        │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                    CLAIM PHASE                          │
├─────────────────────────────────────────────────────────┤
│ 9.  AdoClient updates work item:                       │
│     ├── State → 'Active'                                │
│     ├── AssignedTo → agentId                            │
│     └── Tag → 'agent-claimed', 'agent-in-progress'     │
│ 10. StateTracker saves state to .planning/task-*.json  │
│ 11. RedisBus publishes heartbeat (status: 'working')   │
│ 12. workItemLog record created in database              │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  PREPARE PHASE                          │
├─────────────────────────────────────────────────────────┤
│ 13. GitClient creates feature branch                   │
│     └── Branch name: feature/{workItemId}-{slug}       │
│ 14. GitClient pulls latest and rebases (preflight      │
│     freshness check)                                    │
│ 15. FreshContextExecutor writes .claude/TASK.md:       │
│     ├── Work item title and description                 │
│     ├── Acceptance criteria                             │
│     ├── Codebase notes and relevant files               │
│     ├── Complexity tier and timeout                     │
│     └── ADO work item link                              │
│ 16. ContextHydrator writes .claude/MEMORY.md from      │
│     agent memory vault                                  │
│ 17. SkillLoader writes skill files to .claude/skills/  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   CODING PHASE                          │
├─────────────────────────────────────────────────────────┤
│ 18. Watchdog starts with tier-specific timeout          │
│ 19. ClaudeCodeExecutor spawns `claude -p`:             │
│     ├── Mode: 'coding'                                  │
│     ├── Model: CLAUDE_MODEL_CODING (Sonnet by default) │
│     ├── Max turns: MAX_TURNS_CODING (25)               │
│     └── stdio: 'pipe' (captures output)                │
│ 20. Agent codes the solution autonomously              │
│ 21. On completion:                                      │
│     ├── CostTracker records tokens and cost             │
│     ├── StateTracker updates file changes               │
│     └── RedisBus publishes progress update              │
│ 22. On timeout:                                         │
│     ├── Watchdog kills Claude process                   │
│     └── Escalation: timeout → Jarvis                    │
└──────────────────────┬──────────────────────────────────┘
                       │ success
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  PR & REVIEW PHASE                      │
├─────────────────────────────────────────────────────────┤
│ 23. GitClient commits and pushes changes               │
│ 24. PrManager creates pull request:                    │
│     ├── Title: work item title                          │
│     ├── Description: work item link + changes summary   │
│     └── Target: main branch                             │
│ 25. DWI Tracker receives 'pr:linked' event             │
│ 26. Reviewer agent picks up PR for review              │
│ 27. If review passes → 'pr:approved' event             │
│ 28. PR merged → 'pr:merged' event                      │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                QUALITY GATE PHASE                       │
├─────────────────────────────────────────────────────────┤
│ 29. CI pipeline runs on merged code                    │
│ 30. QualityGates monitors for 30 minutes post-merge    │
│ 31. If CI passes:                                       │
│     ├── Work item closed → 'dwi:work-item-closed'      │
│     ├── All 6 gates pass → DWI status: 'completed'     │
│     └── DWI marked billable → Stripe invoice            │
│ 32. If CI fails within 30 minutes:                     │
│     ├── RevertManager creates revert commit             │
│     ├── DWI status: 'reverted' (non-billable)          │
│     └── Notification sent via Telegram                  │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  COMPLETION                             │
├─────────────────────────────────────────────────────────┤
│ 33. Agent status → 'idle'                              │
│ 34. StateTracker marks task 'completed'                │
│ 35. Back to step 1 (next poll cycle)                   │
└─────────────────────────────────────────────────────────┘
```

## Error Handling

At any point in the lifecycle, failures are handled via escalation:

| Failure | Handler | Resolution |
|---------|---------|------------|
| Budget exceeded | BudgetEnforcer | Agent goes idle, notification sent |
| Coding timeout | Watchdog | Escalate to Jarvis, upgrade complexity tier |
| Test failures | ClaudeCodeExecutor | Retry with test output as context |
| Merge conflict | GitClient | Escalate to Jarvis, reassign to different agent |
| CI failure post-merge | QualityGates | Auto-revert within 30-min window |

## State Persistence

Task state is saved to `.planning/task-{workItemId}.json`:

```json
{
  "workItemId": 1234,
  "status": "in-progress",
  "complexity": "M",
  "branchName": "feature/1234-add-login",
  "filesChanged": ["src/auth.ts", "src/login.tsx"],
  "startedAt": "2025-01-15T10:00:00Z"
}
```

This enables resume after agent restarts or interruptions.
