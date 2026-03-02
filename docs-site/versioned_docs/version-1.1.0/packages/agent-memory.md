---
sidebar_position: 11
title: "@agentcoders/agent-memory"
---

# @agentcoders/agent-memory

PARA-based (Projects, Areas, Resources, Archive) knowledge persistence layer for agents. Manages context hydration, learning capture, memory search, and relevance decay.

**Entry point:** `dist/main.js`
**Source files:** 7

## Components

### VaultManager (`vault-manager.ts`)

Manages PARA-categorized memory entries:

**Categories:**

| Category | Purpose | Typical Content |
|----------|---------|----------------|
| `project` | Active project knowledge | Current sprint context, work item patterns, codebase specifics |
| `area` | Area of responsibility | Domain expertise, ongoing processes, team conventions |
| `resource` | Reference material | Documentation, patterns, code examples, API specs |
| `archive` | Historical knowledge | Past decisions, resolved issues, deprecated patterns |

**Configuration (`VaultConfig`):**
```typescript
interface VaultConfig {
  tenantId: string;
  agentId: string;
  maxEntriesPerCategory: number;
  defaultTtlMs: number;
}
```

**Methods:**
- `getVaultContents(category?)` — retrieve entries, optionally filtered by category
- `addToVault(category, key, content)` — add new memory entry
- `archiveEntry(entryId)` — move entry from any category to `archive`
- `promoteEntry(entryId, targetCategory)` — move entry to a higher-priority category

### ContextHydrator (`context-hydrator.ts`)

Injects relevant memories into agent workspaces:

**Process:**
1. Query agent's memories from database
2. Filter by relevance to current task context
3. Group memories by PARA category
4. Write `MEMORY.md` to `.claude/` directory in agent workspace
5. Claude Code CLI reads this file as context for coding sessions

**Methods:**
- `hydrate(tenantId, agentId, workspacePath, taskContext)` — full hydration flow
- `buildClaudeMd(memories)` — formats memories into markdown
- `filterRelevant(memories, taskContext)` — selects memories relevant to the current task

### MemoryStore (`memory-store.ts`)

CRUD layer for `agentMemories` database table:

**Methods:**
- `create(entry)` — insert with relevance scoring
- `get(id)` — fetch by ID (returns `null` if not found)
- `getByAgent(tenantId, agentId, category?)` — fetch all agent memories, ordered by relevance score
- `update(id, updates)` — partial update
- `delete(id)` — remove entry
- `search(tenantId, keyPattern)` — search by key pattern (SQL LIKE)
- `deleteExpired()` — remove entries past their `expiresAt` timestamp

### LearningRecorder (`learning-recorder.ts`)

Captures new learnings from agent coding sessions:

- Extracts patterns and insights from completed tasks
- Creates memory entries with appropriate PARA category
- Sets initial relevance scores based on learning type
- Links learnings to work items for traceability

### MemorySearch (`memory-search.ts`)

Advanced memory retrieval:

- Key-pattern search (SQL LIKE matching)
- Category-filtered queries
- Relevance-sorted results
- Cross-agent knowledge sharing (within tenant scope)

### MemoryDecay (`memory-decay.ts`)

TTL-based expiration and relevance decay:

- Entries have `expiresAt` timestamp based on `defaultTtlMs`
- Relevance scores decay over time for unused memories
- Periodic cleanup removes expired entries
- Archive category has slower decay rate
