# Multi-Agent Coding Factory — Architecture Blueprint

## System Overview

A hierarchical multi-agent system running on Kubernetes where **N Jarvis pods** (vertical CEOs) each manage their own squads of specialist agent pods. All Jarvis pods report to **you** via Telegram. Azure DevOps serves as the central coordination and task management layer — the "mission control" dashboard.

```
                          ┌──────────────┐
                          │     YOU      │
                          │  (Telegram)  │
                          └──────┬───────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼             ▼
             ┌──────────┐ ┌──────────┐  ┌──────────┐
             │ Jarvis-1 │ │ Jarvis-2 │  │ Jarvis-N │
             │ Frontend │ │ Backend  │  │  DevOps  │
             │   CEO    │ │   CEO    │  │   CEO    │
             └────┬─────┘ └────┬─────┘  └────┬─────┘
                  │            │              │
          ┌───┬──┴──┐   ┌───┬─┴──┐    ┌───┬──┴──┐
          ▼   ▼     ▼   ▼   ▼    ▼    ▼   ▼     ▼
         [A] [B]   [C] [D] [E]  [F]  [G] [H]   [I]
         Agent Pods (Specialists per Vertical)
```

---

## Core Architecture

### Namespace Strategy

Each vertical gets its own Kubernetes namespace. This provides resource isolation, RBAC boundaries, and clean separation of concerns.

```
Namespace: jarvis-frontend
  - jarvis-frontend-ceo (StatefulSet, 1 replica)
  - agent-react-dev (Deployment)
  - agent-css-specialist (Deployment)
  - agent-component-lib (Deployment)
  - agent-a11y-reviewer (Deployment)
  - agent-ui-tester (Deployment)

Namespace: jarvis-backend
  - jarvis-backend-ceo (StatefulSet, 1 replica)
  - agent-api-dev (Deployment)
  - agent-db-architect (Deployment)
  - agent-auth-specialist (Deployment)
  - agent-perf-optimizer (Deployment)

Namespace: jarvis-devops
  - jarvis-devops-ceo (StatefulSet, 1 replica)
  - agent-ci-cd (Deployment)
  - agent-infra-terraform (Deployment)
  - agent-monitoring (Deployment)
  - agent-security-scanner (Deployment)

Namespace: jarvis-qa
  - jarvis-qa-ceo (StatefulSet, 1 replica)
  - agent-unit-tester (Deployment)
  - agent-integration-tester (Deployment)
  - agent-e2e-tester (Deployment)
  - agent-load-tester (Deployment)

Namespace: agent-shared
  - telegram-gateway (Deployment)
  - azure-devops-bridge (Deployment)
  - redis (StatefulSet) — message bus & state
  - postgres (StatefulSet) — agent memory & logs
```

### Pod Architecture

Every pod (Jarvis or agent) runs the same base container image with different configurations:

```
┌─────────────────────────────────────────┐
│  Agent Pod                              │
│  ┌───────────────────────────────────┐  │
│  │  Agent Runtime (Node.js / Python) │  │
│  │  ┌─────────────┐ ┌─────────────┐ │  │
│  │  │ Claude API  │ │ Azure DevOps│ │  │
│  │  │   Client    │ │   Client    │ │  │
│  │  └─────────────┘ └─────────────┘ │  │
│  │  ┌─────────────┐ ┌─────────────┐ │  │
│  │  │  Tool Layer │ │  Poll Loop  │ │  │
│  │  │ (code exec, │ │ (check ADO  │ │  │
│  │  │  git, shell)│ │  every N m) │ │  │
│  │  └─────────────┘ └─────────────┘ │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Sidecar: Claude Code Runtime     │  │
│  │  (sandboxed shell for code exec)  │  │
│  └───────────────────────────────────┘  │
│  ┌───────────────────────────────────┐  │
│  │  Volume Mounts:                   │  │
│  │  - /workspace (PVC — git repos)   │  │
│  │  - /agent-config (ConfigMap)      │  │
│  │  - /secrets (Secret — API keys)   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

---

## Coordination Layer — Azure DevOps as Mission Control

### Project Structure in Azure DevOps

```
Organization: your-org
├── Project: "Agent Factory"
│   ├── Area Path: Frontend (Jarvis-Frontend's board)
│   │   ├── Area: React Components
│   │   ├── Area: CSS/Styling
│   │   └── Area: Accessibility
│   ├── Area Path: Backend (Jarvis-Backend's board)
│   │   ├── Area: API Development
│   │   ├── Area: Database
│   │   └── Area: Auth/Security
│   ├── Area Path: DevOps (Jarvis-DevOps's board)
│   ├── Area Path: QA (Jarvis-QA's board)
│   └── Area Path: Cross-Vertical (inter-Jarvis coordination)
│
│   Work Item Types:
│   ├── Epic        → Vertical-level initiative (owned by Jarvis CEO)
│   ├── Feature     → Deliverable project (assigned to lead agent)
│   ├── User Story  → Specific task (assigned to specialist agent)
│   ├── Task        → Sub-task within a story
│   ├── Bug         → Discovered issues
│   └── Insight     → Agent-discovered observations (custom type)
│
│   Custom Fields:
│   ├── "Agent ID"           → Which pod owns this item
│   ├── "Vertical"           → Which namespace
│   ├── "Deliverable URL"    → Link to output artifact
│   ├── "Requires Human"     → Boolean flag for your attention
│   ├── "Confidence Score"   → Agent's self-assessed confidence (0-100)
│   └── "Dependencies"       → Cross-vertical work item links
```

### Agent Polling Pattern (The "15-Minute Check")

Every agent pod runs a poll loop that checks Azure DevOps for new/changed work items:

```
Every POLL_INTERVAL (configurable per agent, default 5 min):
  1. Query ADO: "Work items modified since my last check
     in my Area Path OR tagged with my specialization"
  2. For each new/changed item:
     a. Read the item + all comments
     b. Send to Claude API with agent's system prompt
     c. Claude decides: "Can I contribute?" / "Should I take this?" / "Ignore"
     d. If contributing: Add comment or create sub-task
     e. If taking: Assign to self, change state to "In Progress"
  3. For items I own that are "In Progress":
     a. Continue working (call Claude with full context)
     b. Execute code if needed (via sidecar)
     c. Update work item with progress
     d. When done: Attach deliverable, move to "Review"
  4. Log all activity to shared Postgres
```

### Inter-Jarvis Communication

Jarvis CEOs coordinate through a shared Azure DevOps area path ("Cross-Vertical") and Redis pub/sub:

```
Jarvis-Frontend needs an API endpoint:
  1. Creates work item in "Cross-Vertical" area path
  2. Tags: "needs-backend", "api-endpoint"
  3. Publishes to Redis channel: "cross-vertical:new-request"
  4. Jarvis-Backend picks it up on next poll
  5. Creates child work item in Backend area
  6. Links back to original
  7. When done, notifies via Redis: "cross-vertical:completed"
```

---

## Telegram Gateway

A single Telegram bot that multiplexes all Jarvis CEOs to your chat:

```
┌──────────────────────────────────────────────────┐
│  Telegram Gateway Pod (agent-shared namespace)   │
│                                                  │
│  Incoming from You:                              │
│  "Frontend: build me a dashboard component"      │
│    → Parse prefix "Frontend:"                    │
│    → Route to Jarvis-Frontend via Redis           │
│                                                  │
│  "All: we're pivoting to mobile-first"           │
│    → Broadcast to ALL Jarvis pods via Redis       │
│                                                  │
│  No prefix:                                      │
│    → Route to default Jarvis (configurable)       │
│                                                  │
│  Incoming from Jarvis pods:                      │
│  Jarvis-Backend: "Need your decision on DB       │
│    schema. See ADO #1234"                        │
│    → Format with vertical badge                   │
│    → Send to your Telegram chat                   │
│                                                  │
│  Features:                                       │
│  - Inline buttons: [Approve] [Reject] [Defer]   │
│  - /status → summary of all verticals            │
│  - /boards → links to each ADO board             │
│  - /quiet <vertical> → mute a Jarvis             │
│  - /freerain <vertical> → autonomous mode         │
│  - /broadcast <message> → message all agents      │
└──────────────────────────────────────────────────┘
```

---

## Agent Spawning — Jarvis Creates Its Own Team

Each Jarvis CEO has the ability to create new agent pods in its namespace via the Kubernetes API:

```
You: "Frontend, I need someone who specializes in animations"

Jarvis-Frontend:
  1. Checks current squad composition
  2. Generates agent config:
     - Name: agent-animation-specialist
     - System Prompt: "You are an animation specialist..."
     - Tools: CSS animations, Framer Motion, GSAP
     - Poll interval: 3 minutes
     - ADO area: Frontend/Animations
  3. Creates ConfigMap with agent definition
  4. Applies Deployment manifest via K8s API
  5. New pod starts, registers with ADO
  6. Jarvis creates onboarding work item for new agent
  7. Reports back: "Animation specialist is live and onboarded"
```

Jarvis needs a ServiceAccount with permissions scoped to its own namespace:

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: jarvis-agent-manager
  namespace: jarvis-frontend
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["create", "delete", "get", "list", "patch"]
  - apiGroups: [""]
    resources: ["configmaps", "pods"]
    verbs: ["create", "delete", "get", "list"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
```

---

## System Prompt Hierarchy

### Jarvis CEO System Prompt (Template)

```
You are Jarvis-{VERTICAL_NAME}, the CEO of the {VERTICAL_NAME} vertical
in a multi-agent coding factory.

MISSION: {VERTICAL_MISSION}

YOUR TEAM: You manage specialist agent pods that check Azure DevOps
every {POLL_INTERVAL} minutes. You can create new agents when needed.

COORDINATION:
- You communicate with the human operator via Telegram (through the gateway)
- You coordinate with other Jarvis CEOs via the Cross-Vertical board in ADO
- Your agents communicate via work item comments in your Area Path
- Flag items as "Requires Human" when you need operator approval

RULES:
1. Every task must produce a deliverable (code, doc, report, design)
2. Never publish/deploy without explicit human approval (unless in freerain mode)
3. Create detailed work items so any agent can pick them up
4. When an insight is discovered, post it to the squad chat (Redis)
5. Prioritize tasks by impact on the overall mission
6. Ask the human clarifying questions via Telegram when ambiguous
7. Send daily summary to Telegram at end of day

CURRENT SQUAD:
{DYNAMIC_SQUAD_LIST — populated from K8s namespace}

FREERAIN MODE: {true/false — set by human via Telegram}
```

### Specialist Agent System Prompt (Template)

```
You are {AGENT_NAME}, a specialist in {SPECIALIZATION} working under
Jarvis-{VERTICAL_NAME}.

YOUR ROLE: {ROLE_DESCRIPTION}

TOOLS AVAILABLE: {TOOL_LIST}

WORKFLOW:
1. Check Azure DevOps every {POLL_INTERVAL} minutes for work in your area
2. Pick up unassigned items matching your specialization
3. Work on items by executing code in your workspace
4. Add detailed comments on work items showing progress
5. Create deliverables and attach them when done
6. If you discover insights, share them in squad chat
7. If blocked, escalate to Jarvis-{VERTICAL_NAME} via ADO comment

NEVER:
- Deploy or publish anything
- Communicate with the human directly (go through Jarvis)
- Work outside your specialization (flag for correct agent)
- Close a work item without a deliverable attached
```

---

## Key Implementation Components

### 1. Agent Runtime (Core Loop)

```javascript
// agent-runtime.js — the heart of every pod
const Anthropic = require("@anthropic-ai/sdk");
const { WebApi } = require("azure-devops-node-api");
const Redis = require("ioredis");

class AgentRuntime {
  constructor(config) {
    this.agentId = config.agentId;
    this.vertical = config.vertical;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.pollInterval = config.pollInterval || 5 * 60 * 1000;
    this.isJarvis = config.isJarvis || false;

    this.claude = new Anthropic();
    this.redis = new Redis(process.env.REDIS_URL);
    this.adoConnection = null; // initialized in start()
    this.conversationHistory = [];
    this.lastChecked = new Date();
  }

  async start() {
    // Connect to Azure DevOps
    const authHandler = azdev.getPersonalAccessTokenHandler(
      process.env.ADO_PAT
    );
    this.adoConnection = new WebApi(process.env.ADO_ORG_URL, authHandler);
    this.witApi = await this.adoConnection.getWorkItemTrackingApi();
    this.gitApi = await this.adoConnection.getGitApi();

    // Subscribe to Redis channels
    await this.subscribeToChannels();

    // Start poll loop
    console.log(`[${this.agentId}] Agent started. Polling every ${this.pollInterval / 1000}s`);
    this.poll();
    setInterval(() => this.poll(), this.pollInterval);
  }

  async poll() {
    try {
      // 1. Check ADO for new/changed work items
      const items = await this.getRelevantWorkItems();

      for (const item of items) {
        const decision = await this.evaluateWorkItem(item);

        switch (decision.action) {
          case "contribute":
            await this.addComment(item.id, decision.comment);
            break;
          case "claim":
            await this.claimAndWork(item);
            break;
          case "escalate":
            await this.escalate(item, decision.reason);
            break;
          case "ignore":
            break;
        }
      }

      // 2. Continue work on owned items
      const myItems = await this.getMyActiveItems();
      for (const item of myItems) {
        await this.continueWork(item);
      }

      this.lastChecked = new Date();
    } catch (err) {
      console.error(`[${this.agentId}] Poll error:`, err);
    }
  }

  async evaluateWorkItem(item) {
    const response = await this.claude.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: this.systemPrompt,
      messages: [
        {
          role: "user",
          content: `New work item in Azure DevOps:
Title: ${item.fields["System.Title"]}
Description: ${item.fields["System.Description"]}
State: ${item.fields["System.State"]}
Assigned To: ${item.fields["System.AssignedTo"]?.displayName || "Unassigned"}
Comments: ${JSON.stringify(item.comments || [])}

Decide: Should you CONTRIBUTE (add insight), CLAIM (take ownership and work),
ESCALATE (flag for Jarvis/human), or IGNORE?
Respond as JSON: { "action": "...", "reason": "...", "comment": "..." }`
        }
      ]
    });

    return JSON.parse(
      response.content[0].text.replace(/```json|```/g, "").trim()
    );
  }

  async claimAndWork(item) {
    // Assign to self
    await this.witApi.updateWorkItem(
      {},
      [
        { op: "replace", path: "/fields/System.AssignedTo", value: this.agentId },
        { op: "replace", path: "/fields/System.State", value: "Active" }
      ],
      item.id,
      process.env.ADO_PROJECT
    );

    // Execute work via Claude with tools
    const result = await this.executeTask(item);

    // Attach deliverable
    if (result.deliverable) {
      await this.attachDeliverable(item.id, result.deliverable);
      await this.witApi.updateWorkItem(
        {},
        [{ op: "replace", path: "/fields/System.State", value: "Resolved" }],
        item.id,
        process.env.ADO_PROJECT
      );
    }
  }

  async executeTask(item) {
    // Multi-turn Claude conversation with tool use for code execution
    const messages = [
      {
        role: "user",
        content: `Execute this task:
Title: ${item.fields["System.Title"]}
Description: ${item.fields["System.Description"]}
Acceptance Criteria: ${item.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || "Produce a deliverable"}

Work in /workspace. Commit results to git when done.`
      }
    ];

    // Agentic loop — Claude calls tools, we execute, repeat
    let response;
    do {
      response = await this.claude.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: this.systemPrompt,
        messages,
        tools: this.getToolDefinitions()
      });

      // Process tool calls
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const result = await this.executeTool(block.name, block.input);
          messages.push({ role: "assistant", content: response.content });
          messages.push({
            role: "user",
            content: [
              { type: "tool_result", tool_use_id: block.id, content: result }
            ]
          });
        }
      }
    } while (response.stop_reason === "tool_use");

    const finalText = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return { deliverable: finalText, success: true };
  }

  // Jarvis-only: spawn a new agent pod
  async spawnAgent(agentConfig) {
    if (!this.isJarvis) throw new Error("Only Jarvis can spawn agents");

    const k8s = require("@kubernetes/client-node");
    const kc = new k8s.KubeConfig();
    kc.loadFromCluster();
    const appsApi = kc.makeApiClient(k8s.AppsV1Api);
    const coreApi = kc.makeApiClient(k8s.CoreV1Api);

    // Create ConfigMap with agent's system prompt and config
    await coreApi.createNamespacedConfigMap(this.vertical, {
      metadata: { name: `${agentConfig.name}-config` },
      data: {
        "agent-config.json": JSON.stringify({
          agentId: agentConfig.name,
          vertical: this.vertical,
          role: agentConfig.role,
          systemPrompt: agentConfig.systemPrompt,
          pollInterval: agentConfig.pollInterval || 300000,
          isJarvis: false
        })
      }
    });

    // Create Deployment
    await appsApi.createNamespacedDeployment(this.vertical, {
      metadata: { name: agentConfig.name },
      spec: {
        replicas: 1,
        selector: { matchLabels: { agent: agentConfig.name } },
        template: {
          metadata: { labels: { agent: agentConfig.name, vertical: this.vertical } },
          spec: {
            serviceAccountName: "agent-runner",
            containers: [
              {
                name: "agent",
                image: process.env.AGENT_IMAGE,
                envFrom: [{ secretRef: { name: "agent-secrets" } }],
                volumeMounts: [
                  { name: "config", mountPath: "/agent-config" },
                  { name: "workspace", mountPath: "/workspace" }
                ]
              }
            ],
            volumes: [
              { name: "config", configMap: { name: `${agentConfig.name}-config` } },
              {
                name: "workspace",
                persistentVolumeClaim: { claimName: `${agentConfig.name}-pvc` }
              }
            ]
          }
        }
      }
    });

    console.log(`[${this.agentId}] Spawned new agent: ${agentConfig.name}`);
  }

  async subscribeToChannels() {
    const sub = this.redis.duplicate();

    // All agents listen to their vertical channel
    await sub.subscribe(`vertical:${this.vertical}`);

    // Jarvis CEOs also listen to cross-vertical and telegram channels
    if (this.isJarvis) {
      await sub.subscribe("cross-vertical:new-request");
      await sub.subscribe("cross-vertical:completed");
      await sub.subscribe(`telegram:${this.vertical}`);
      await sub.subscribe("telegram:broadcast");
    }

    sub.on("message", (channel, message) => {
      this.handleRedisMessage(channel, JSON.parse(message));
    });
  }

  async handleRedisMessage(channel, message) {
    if (channel.startsWith("telegram:")) {
      // Human sent a message — process it
      const response = await this.processHumanMessage(message.text);
      await this.redis.publish("telegram:outbound", JSON.stringify({
        vertical: this.vertical,
        text: response,
        replyTo: message.messageId
      }));
    }
  }

  getToolDefinitions() {
    return [
      {
        name: "execute_shell",
        description: "Execute a shell command in the agent's workspace",
        input_schema: {
          type: "object",
          properties: {
            command: { type: "string", description: "Shell command to execute" }
          },
          required: ["command"]
        }
      },
      {
        name: "read_file",
        description: "Read a file from the workspace",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" }
          },
          required: ["path"]
        }
      },
      {
        name: "write_file",
        description: "Write content to a file",
        input_schema: {
          type: "object",
          properties: {
            path: { type: "string" },
            content: { type: "string" }
          },
          required: ["path", "content"]
        }
      },
      {
        name: "create_work_item",
        description: "Create a new Azure DevOps work item",
        input_schema: {
          type: "object",
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            type: { type: "string", enum: ["Task", "User Story", "Bug", "Insight"] },
            assignTo: { type: "string" },
            tags: { type: "string" }
          },
          required: ["title", "type"]
        }
      },
      {
        name: "squad_chat",
        description: "Send a message to the squad chat for your vertical",
        input_schema: {
          type: "object",
          properties: {
            message: { type: "string" }
          },
          required: ["message"]
        }
      }
    ];
  }

  async executeTool(name, input) {
    switch (name) {
      case "execute_shell": {
        const { execSync } = require("child_process");
        try {
          const output = execSync(input.command, {
            cwd: "/workspace",
            timeout: 60000,
            encoding: "utf-8"
          });
          return output;
        } catch (e) {
          return `Error: ${e.message}\n${e.stderr || ""}`;
        }
      }
      case "read_file":
        return require("fs").readFileSync(`/workspace/${input.path}`, "utf-8");
      case "write_file":
        require("fs").writeFileSync(`/workspace/${input.path}`, input.content);
        return `Written to ${input.path}`;
      case "create_work_item":
        return await this.createWorkItem(input);
      case "squad_chat":
        await this.redis.publish(
          `vertical:${this.vertical}`,
          JSON.stringify({ from: this.agentId, message: input.message })
        );
        return "Sent to squad chat";
      default:
        return `Unknown tool: ${name}`;
    }
  }
}

module.exports = { AgentRuntime };
```

### 2. Telegram Gateway

```javascript
// telegram-gateway.js
const TelegramBot = require("node-telegram-bot-api");
const Redis = require("ioredis");

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, { polling: true });
const redis = new Redis(process.env.REDIS_URL);
const sub = redis.duplicate();

const OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID;

// Route incoming messages to correct Jarvis
bot.on("message", async (msg) => {
  if (msg.chat.id.toString() !== OWNER_CHAT_ID) return;

  const text = msg.text;

  // Command handling
  if (text.startsWith("/status")) {
    const statuses = await getAllVerticalStatuses();
    return bot.sendMessage(msg.chat.id, statuses, { parse_mode: "Markdown" });
  }
  if (text.startsWith("/freerain")) {
    const vertical = text.split(" ")[1];
    await redis.set(`freerain:${vertical}`, "true");
    return bot.sendMessage(msg.chat.id, `🟢 ${vertical} is now in freerain mode.`);
  }
  if (text.startsWith("/leash")) {
    const vertical = text.split(" ")[1];
    await redis.del(`freerain:${vertical}`);
    return bot.sendMessage(msg.chat.id, `🔴 ${vertical} freerain disabled.`);
  }
  if (text.startsWith("/boards")) {
    return bot.sendMessage(msg.chat.id, formatBoardLinks());
  }

  // Route by prefix: "Frontend: build a dashboard" → jarvis-frontend
  const prefixMatch = text.match(/^(\w+):\s*(.+)/s);
  if (prefixMatch) {
    const vertical = prefixMatch[1].toLowerCase();
    const message = prefixMatch[2];
    await redis.publish(`telegram:jarvis-${vertical}`, JSON.stringify({
      text: message,
      messageId: msg.message_id,
      timestamp: new Date().toISOString()
    }));
    bot.sendMessage(msg.chat.id, `📨 Routed to Jarvis-${vertical}`);
    return;
  }

  // "All:" prefix → broadcast
  if (text.toLowerCase().startsWith("all:")) {
    await redis.publish("telegram:broadcast", JSON.stringify({
      text: text.slice(4).trim(),
      messageId: msg.message_id
    }));
    bot.sendMessage(msg.chat.id, "📢 Broadcast sent to all verticals");
    return;
  }

  // No prefix → default Jarvis
  await redis.publish("telegram:jarvis-default", JSON.stringify({
    text,
    messageId: msg.message_id
  }));
});

// Listen for outbound messages from Jarvis pods
sub.subscribe("telegram:outbound");
sub.on("message", (channel, data) => {
  const msg = JSON.parse(data);
  const badge = `[${msg.vertical.toUpperCase()}]`;
  bot.sendMessage(OWNER_CHAT_ID, `${badge} ${msg.text}`, {
    parse_mode: "Markdown",
    reply_markup: msg.needsApproval
      ? {
          inline_keyboard: [
            [
              { text: "✅ Approve", callback_data: `approve:${msg.itemId}` },
              { text: "❌ Reject", callback_data: `reject:${msg.itemId}` },
              { text: "⏳ Defer", callback_data: `defer:${msg.itemId}` }
            ]
          ]
        }
      : undefined
  });
});

// Handle inline button callbacks
bot.on("callback_query", async (query) => {
  const [action, itemId] = query.data.split(":");
  await redis.publish("telegram:decision", JSON.stringify({
    action,
    itemId,
    timestamp: new Date().toISOString()
  }));
  bot.answerCallbackQuery(query.id, { text: `${action} sent!` });
});
```

### 3. Kubernetes Manifests

```yaml
# base-namespace.yaml — apply once per vertical
apiVersion: v1
kind: Namespace
metadata:
  name: jarvis-frontend
  labels:
    vertical: frontend
    managed-by: agent-factory
---
apiVersion: v1
kind: Secret
metadata:
  name: agent-secrets
  namespace: jarvis-frontend
type: Opaque
stringData:
  ANTHROPIC_API_KEY: "sk-ant-..."
  ADO_PAT: "your-ado-pat"
  ADO_ORG_URL: "https://dev.azure.com/your-org"
  ADO_PROJECT: "Agent Factory"
  REDIS_URL: "redis://redis.agent-shared.svc.cluster.local:6379"
---
apiVersion: v1
kind: ServiceAccount
metadata:
  name: jarvis-manager
  namespace: jarvis-frontend
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: jarvis-agent-manager
  namespace: jarvis-frontend
rules:
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["create", "delete", "get", "list", "patch", "update"]
  - apiGroups: [""]
    resources: ["configmaps", "pods", "persistentvolumeclaims"]
    verbs: ["create", "delete", "get", "list"]
  - apiGroups: [""]
    resources: ["pods/log"]
    verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: jarvis-can-manage-agents
  namespace: jarvis-frontend
subjects:
  - kind: ServiceAccount
    name: jarvis-manager
roleRef:
  kind: Role
  name: jarvis-agent-manager
  apiGroup: rbac.authorization.k8s.io
---
# Jarvis CEO StatefulSet
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: jarvis-frontend-ceo
  namespace: jarvis-frontend
spec:
  serviceName: jarvis-frontend-ceo
  replicas: 1
  selector:
    matchLabels:
      role: jarvis-ceo
      vertical: frontend
  template:
    metadata:
      labels:
        role: jarvis-ceo
        vertical: frontend
    spec:
      serviceAccountName: jarvis-manager
      containers:
        - name: jarvis
          image: your-registry/agent-runtime:latest
          envFrom:
            - secretRef:
                name: agent-secrets
          env:
            - name: AGENT_CONFIG_PATH
              value: /agent-config/agent-config.json
            - name: AGENT_IMAGE
              value: your-registry/agent-runtime:latest
          volumeMounts:
            - name: config
              mountPath: /agent-config
            - name: workspace
              mountPath: /workspace
          resources:
            requests:
              cpu: "250m"
              memory: "512Mi"
            limits:
              cpu: "1"
              memory: "2Gi"
      volumes:
        - name: config
          configMap:
            name: jarvis-frontend-config
  volumeClaimTemplates:
    - metadata:
        name: workspace
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: jarvis-frontend-config
  namespace: jarvis-frontend
data:
  agent-config.json: |
    {
      "agentId": "jarvis-frontend-ceo",
      "vertical": "jarvis-frontend",
      "role": "CEO - Frontend Vertical",
      "isJarvis": true,
      "pollInterval": 180000,
      "systemPrompt": "You are Jarvis-Frontend, the CEO of the Frontend vertical..."
    }
```

---

## Scaling Considerations

### Cost Management at 100 Pods

Each pod makes Claude API calls on every poll cycle. At 100 pods polling every 5 minutes:

```
100 pods × 12 polls/hour × ~2000 tokens/poll = ~2.4M tokens/hour
At Claude Sonnet pricing (~$3/M input, $15/M output):
  Rough estimate: $50-150/hour depending on workload
  Monthly: $36K-108K if running 24/7

OPTIMIZATIONS:
1. Variable poll intervals: Idle agents → 15 min, active → 2 min
2. "Sleep mode": Agents with no relevant work items go dormant
3. Batch polling: One ADO query per namespace, distribute results
4. Context caching: Reuse system prompts across calls (prompt caching)
5. Tiered models: Sonnet for decisions, Haiku for simple polling checks
6. Work-hours only: Scale down pods outside business hours via CronJob
```

### Pod Autoscaling

```yaml
# Scale agent pods based on ADO queue depth
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-pool-scaler
  namespace: jarvis-frontend
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-react-dev
  minReplicas: 1
  maxReplicas: 5
  metrics:
    - type: External
      external:
        metric:
          name: ado_queue_depth
          selector:
            matchLabels:
              vertical: frontend
              specialization: react
        target:
          type: AverageValue
          averageValue: "3"  # Scale up when >3 items queued per pod
```

---

## Deployment Checklist

1. **Prerequisites**
   - [ ] Kubernetes cluster (AKS recommended for Azure DevOps integration)
   - [ ] Azure DevOps organization + project created
   - [ ] Anthropic API key with sufficient quota
   - [ ] Telegram Bot created via @BotFather
   - [ ] Container registry (ACR, Docker Hub, etc.)

2. **Infrastructure**
   - [ ] Deploy `agent-shared` namespace (Redis, Postgres, Telegram Gateway)
   - [ ] Build and push the `agent-runtime` container image
   - [ ] Configure Azure DevOps: area paths, work item types, custom fields

3. **First Vertical**
   - [ ] Create namespace + secrets + RBAC
   - [ ] Deploy Jarvis CEO pod
   - [ ] Test: send Telegram message, verify Jarvis responds
   - [ ] Have Jarvis spawn its first agent pod
   - [ ] Test end-to-end: create work item → agent picks up → delivers

4. **Scale**
   - [ ] Deploy remaining vertical namespaces
   - [ ] Configure inter-Jarvis communication
   - [ ] Set up monitoring dashboards (Grafana + Prometheus)
   - [ ] Implement cost controls and sleep schedules

5. **Operational**
   - [ ] Daily summary cron (each Jarvis sends Telegram digest)
   - [ ] Alert on: pod crashes, API rate limits, stuck work items
   - [ ] Weekly review: identify and prune low-value agents
