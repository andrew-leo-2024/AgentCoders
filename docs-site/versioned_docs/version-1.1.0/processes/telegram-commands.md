---
sidebar_position: 5
title: Telegram Commands & Routing
---

# Telegram Commands & Routing

The Telegram Gateway provides the primary human interface for interacting with AgentCoders.

## Security

All messages are filtered by `TELEGRAM_OWNER_CHAT_ID`. Messages from any other chat ID are silently rejected.

## Slash Commands

| Command | Usage | Description |
|---------|-------|-------------|
| `/status` | `/status` | Shows all agents with status, current work item, and heartbeat age. Agents with heartbeat >120s are marked `[STALE]` |
| `/freerain` | `/freerain frontend` | Set a vertical to **autonomous** mode — agents work without requiring approval |
| `/leash` | `/leash backend` | Set a vertical to **supervised** mode — agents request human approval before proceeding |
| `/boards` | `/boards` | Request a boards summary from Jarvis — shows work item status across all verticals |
| `/quiet` | `/quiet devops` | Mute notifications from a vertical for **1 hour** |

**Valid verticals:** `frontend`, `backend`, `devops`, `qa`

## Message Routing

Non-command text messages are routed based on prefix:

| Prefix | Target | Example |
|--------|--------|---------|
| `Frontend:` | `jarvis-frontend` channel | `Frontend: Fix the login button alignment` |
| `Backend:` | `jarvis-backend` channel | `Backend: Add rate limiting to the API` |
| `DevOps:` | `jarvis-devops` channel | `DevOps: Update the CI pipeline` |
| `QA:` | `jarvis-qa` channel | `QA: Write tests for the auth module` |
| `All:` | **All 4 verticals** (broadcast) | `All: Freeze deployments until further notice` |
| *(no prefix)* | Default `jarvis` channel | `How many work items are in progress?` |

Each routed message includes: `type: 'telegram-inbound'`, `tenantId`, `chatId`, `text`, `targetVertical`, `timestamp`.

## Approval Flow

For supervised verticals, agents request human approval via inline keyboards:

```
┌─────────────────────────────────────┐
│ Agent requests approval for:        │
│ "Add JWT authentication to API"     │
│                                     │
│ [✅ Approve] [❌ Reject] [⏸ Defer] │
└─────────────────────────────────────┘
```

**Callback data format:** `action:<approve|reject|defer>:<itemId>`

**Flow:**
1. Agent or Jarvis sends outbound message with `inlineKeyboard` via Redis
2. RedisBridge forwards to Telegram with inline keyboard markup
3. Human taps a button
4. ApprovalHandler parses callback data
5. Publishes `TelegramDecisionMessage` to `{tenantId}:telegram:decision`
6. Inline keyboard removed, decision confirmation sent
7. Jarvis or agent receives decision and proceeds accordingly

## Outbound Notifications

Agents and Jarvis send notifications via `{tenantId}:telegram:outbound`:

- Progress updates on work items
- Escalation requests requiring human input
- Daily summary reports
- Budget warnings
- Error notifications

The RedisBridge subscribes to this channel and forwards messages to Telegram, supporting:
- Plain text and HTML parse mode
- Inline keyboards for interactive responses

## Vertical Muting

`/quiet <vertical>` mutes a vertical for 1 hour:

- Implemented via `RedisBridge.muteVertical(vertical, durationMs)`
- Mute state stored in-memory with unmute timestamp
- Auto-expires — checked on each incoming message
- Muted verticals' outbound messages are suppressed
