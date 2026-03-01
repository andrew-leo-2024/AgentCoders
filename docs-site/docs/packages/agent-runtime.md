---
sidebar_position: 2
title: "@agentcoders/agent-runtime"
---

# @agentcoders/agent-runtime

Core agent pod runtime. Implements the full work item lifecycle: poll for tasks, claim, branch, code via Claude Code CLI, create PRs, and report progress.

**Entry point:** `dist/main.js`
**Source files:** 16

## Components

### AgentRuntime (`runtime.ts`)

Main orchestrator that wires all components together and manages the agent lifecycle:

1. Loads config via `loadConfig(agentConfigSchema)`
2. Initializes all sub-components (PollLoop, RedisBus, HealthServer, etc.)
3. Starts the poll loop
4. Handles graceful shutdown (SIGTERM/SIGINT)

### PollLoop (`poll-loop.ts`)

Core work loop that polls Azure DevOps for available work items.

**Config interface:**

```typescript
interface PollLoopConfig {
  agentId: string;
  tenantId: string;
  vertical: string;
  namespace: string;
  pollIntervalMs: number;      // default: 30000, min: 5000
  maxTurnsCoding: number;       // default: 25
  maxTurnsReview: number;       // default: 15
  claudeCodeTimeoutMs: number;  // default: 900000
  dailyBudgetUsd: number;       // default: 100
  monthlyBudgetUsd: number;     // default: 2000
  workDir: string;
  adoProject: string;
  repositoryId: string;
  triageModel: string;
  codingModel: string;
}
```

**Behavior:**

1. **Non-reentrant guard** — skips tick if previous iteration still running
2. **Jitter** — random 0–30000ms delay to prevent thundering herd
3. **Budget check** — skips polling if daily/monthly budget exceeded
4. **Query ADO** — WIQL query for unclaimed work items tagged for the agent's vertical
5. **Triage** — Claude Haiku evaluates work item, estimates complexity tier
6. **Claim** — updates work item state, tags with `agent-claimed`
7. **Branch** — creates feature branch via GitClient
8. **Fresh context** — writes `.claude/TASK.md` with task details
9. **Code** — spawns Claude Code CLI with timeout and turn limits
10. **PR** — creates pull request via PrManager
11. **Report** — publishes progress to Redis

### ClaudeCodeExecutor (`claude-code-executor.ts`)

Spawns `claude -p` as a child process with piped stdio.

```typescript
interface ClaudeCodeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  tokensUsed: number;
  costEstimate: number;
  timedOut: boolean;
}
```

**Key behaviors:**
- Uses `spawn('claude', ['-p', ...args], { stdio: 'pipe' })` with `type ChildProcess`
- Enforces timeout via `CLAUDE_CODE_TIMEOUT_MS`
- Supports different modes: `triage` (Haiku, fewer turns) and `coding` (Sonnet, more turns)
- Parses token usage from Claude's output

### FreshContextExecutor (`fresh-context.ts`)

Prepares task context for Claude Code sessions by writing `.claude/TASK.md`:

- Work item title, description, acceptance criteria
- Codebase notes and relevant file paths
- Complexity tier and timeout information
- Links back to ADO work item

### StateTracker (`state-tracker.ts`)

Persists task execution state to `.planning/task-*.json` files:

- Tracks task lifecycle: `pending` → `in-progress` → `completed` → `failed`
- Records file changes made during the session
- Enables resume after interruption
- Saves/loads state to disk

### PrManager (`pr-manager.ts`)

Creates and manages pull requests:

- Creates PR with work item link in description
- Sets reviewers if configured
- Links PR to ADO work item
- Handles PR status tracking

### RevertManager (`revert-manager.ts`)

Handles post-merge PR reverts within the 30-minute quality gate window:

- Monitors for revert requests from QualityGates service
- Creates revert commits
- Updates DWI status to `reverted`

### CostTracker (`cost-tracker.ts`)

Tracks per-agent token usage and cost:

- Accumulates daily/monthly spend from Claude sessions
- Checks against budget limits
- Reports cost via Redis progress updates

### Watchdog (`watchdog.ts`)

Enforces timeout on long-running tasks:

- Kills Claude Code processes that exceed `COMPLEXITY_TIMEOUTS_MS[tier]`
- Escalates to Jarvis on timeout

### Lifecycle (`lifecycle.ts`)

Manages agent pod lifecycle transitions:

- Startup initialization
- Graceful shutdown (drain current work, update status)
- Heartbeat publishing

### AdoClient (`ado-client.ts`)

Azure DevOps REST API client:

- `queryWorkItems(wiql)` — WIQL query execution
- `getWorkItem(id)` — fetch single work item
- `updateWorkItem(id, operations)` — JSON-patch updates
- `addComment(workItemId, text)` — add comment
- `addTag(workItemId, tag)` — tag management
- Uses `retry()` for 429/5xx error handling
- Basic auth via PAT token

### GitClient (`git-client.ts`)

Git operations via child process:

- `checkout(branch)` — switch branches
- `createBranch(name)` — create and checkout new branch
- `pull()` — pull latest changes
- `rebase(target)` — rebase onto target branch
- `commitAndPush(message)` — stage all, commit, push
- Preflight freshness checks before coding starts

### RedisBus (`redis-bus.ts`)

Redis pub/sub interface for the agent:

- `publishHeartbeat()` — periodic status broadcast
- `publishProgress(details)` — per-agent progress updates
- `publishEscalation(escalation)` — escalate issues to Jarvis
- `sendTelegramMessage(text)` — outbound notifications

### HealthServer (`health.ts`)

HTTP health/readiness endpoints:

- `GET /healthz` — liveness check
- `GET /readyz` — readiness check
- `GET /metrics` — Prometheus-compatible metrics
- Runs on `HEALTH_PORT` (default: 8080)
