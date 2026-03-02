---
sidebar_position: 4
title: "@agentcoders/telegram-gateway"
---

# @agentcoders/telegram-gateway

Telegram bot gateway. Provides the human interface for commanding agents, receiving notifications, and approving/rejecting work via inline keyboards.

**Entry point:** `dist/bot.js`
**Source files:** 5

## Components

### Bot (`bot.ts`)

Main entry point using Telegraf:

1. Loads config via `loadConfig(telegramConfigSchema)`
2. Uses `TELEGRAM_OWNER_CHAT_ID` as tenant isolation key
3. **Security middleware** — rejects all messages from non-owner chats
4. Registers slash commands, approval handler, and message router
5. Starts Redis bridge for outbound notifications
6. Handles graceful shutdown

### Router (`router.ts`)

Prefix-based message routing to vertical-specific Jarvis channels:

| Prefix | Target Channel |
|--------|---------------|
| `Frontend:` | `{tenantId}:telegram:jarvis-frontend` |
| `Backend:` | `{tenantId}:telegram:jarvis-backend` |
| `DevOps:` | `{tenantId}:telegram:jarvis-devops` |
| `QA:` | `{tenantId}:telegram:jarvis-qa` |
| `All:` | Broadcast to all 4 vertical channels |
| *(no prefix)* | `{tenantId}:telegram:jarvis` (default) |

Each routed message includes: `type`, `tenantId`, `chatId`, `text`, `targetVertical`, `timestamp`.

### Commands (`commands.ts`)

5 registered slash commands:

| Command | Usage | Description |
|---------|-------|-------------|
| `/status` | `/status` | Agent status report — shows all agents with status, current work item, heartbeat age. Marks agents as `[STALE]` if heartbeat >120 seconds old |
| `/freerain` | `/freerain <vertical>` | Set vertical to **autonomous** mode — agents work without approval |
| `/leash` | `/leash <vertical>` | Set vertical to **supervised** mode — agents request approval |
| `/boards` | `/boards` | Request board summary from Jarvis — shows work item status across verticals |
| `/quiet` | `/quiet <vertical>` | Mute notifications from a vertical for 1 hour |

Valid verticals: `frontend`, `backend`, `devops`, `qa`

### ApprovalHandler (`approval-handler.ts`)

Handles inline keyboard callback queries for approval workflows:

**Callback data format:** `action:<approve|reject|defer>:<itemId>`

Workflow:
1. Agent requests approval → Jarvis sends Telegram message with inline keyboard buttons
2. Human taps Approve/Reject/Defer
3. ApprovalHandler parses callback data
4. Publishes `TelegramDecisionMessage` to `{tenantId}:telegram:decision` channel
5. Updates Telegram message to show decision result
6. Removes inline keyboard after decision

### RedisBridge (`redis-bridge.ts`)

Bidirectional Redis pub/sub bridge between Telegram and the agent system:

**Subscribed channels:**
- `{tenantId}:telegram:outbound` — outbound messages to send to Telegram
- `{tenantId}:agent:heartbeat` — agent status updates

**Features:**
- **Agent status cache** — in-memory `Map<string, AgentStatusEntry>` updated from heartbeats
- **Outbound message handling** — sends messages to Telegram with optional:
  - Parse mode (HTML/Markdown)
  - Inline keyboards (for approval flows)
- **Vertical muting** — `muteVertical(vertical, durationMs)` suppresses notifications
- **Auto-unmute** — expired mutes cleared on next check

```typescript
interface AgentStatusEntry {
  agentId: string;
  status: string;
  currentWorkItemId?: number;
  timestamp: string;
}
```
