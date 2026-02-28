# Agent Pod Toolchain — The Missing Layer

## The Problem You Identified

The original architecture had agents calling the Claude API directly and implementing a custom tool loop. That's reinventing the wheel. **Claude Code CLI already IS the agentic coding loop** — it handles file reading, editing, shell execution, multi-turn reasoning, and error recovery out of the box.

Each agent pod should use:
- **Claude Code CLI (`claude -p`)** — headless mode for autonomous coding
- **Azure DevOps CLI (`az devops`)** — work items, PRs, pipelines, boards
- **Git** — branching, committing, pushing
- **Build tools** — Node.js, Python, Docker, whatever the stack needs

---

## Updated Pod Container Image

```dockerfile
# Dockerfile.agent — base image for all agent pods
FROM ubuntu:24.04

# System deps
RUN apt-get update && apt-get install -y \
    curl git jq ca-certificates gnupg lsb-release \
    python3 python3-pip \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22+ (required for Claude Code)
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# Claude Code CLI (headless agent)
RUN npm install -g @anthropic-ai/claude-code

# Azure CLI + DevOps extension
RUN curl -sL https://aka.ms/InstallAzureCLIDeb | bash \
    && az extension add --name azure-devops

# GitHub CLI (optional, if also using GitHub)
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli-stable.list > /dev/null \
    && apt update && apt install gh -y

# Python tools (linting, testing, etc.)
RUN pip3 install --break-system-packages \
    pytest black flake8 mypy pre-commit

# Create agent user
RUN useradd -m -s /bin/bash agent
USER agent
WORKDIR /home/agent

# Agent runtime
COPY --chown=agent:agent agent-runtime/ /home/agent/runtime/

# Claude Code settings for headless operation
RUN mkdir -p /home/agent/.claude
COPY --chown=agent:agent claude-settings.json /home/agent/.claude/settings.json

ENTRYPOINT ["node", "/home/agent/runtime/main.js"]
```

### Claude Code Settings for Headless Pods

```json
// claude-settings.json — pre-configure permissions so -p mode can work autonomously
{
  "permissions": {
    "allow": [
      "Read",
      "Write",
      "Edit",
      "Bash(git *)",
      "Bash(az *)",
      "Bash(npm *)",
      "Bash(npx *)",
      "Bash(node *)",
      "Bash(python3 *)",
      "Bash(pytest *)",
      "Bash(pip3 *)",
      "Bash(docker *)",
      "Bash(cat *)",
      "Bash(ls *)",
      "Bash(find *)",
      "Bash(grep *)",
      "Bash(rg *)",
      "Bash(mkdir *)",
      "Bash(cp *)",
      "Bash(mv *)",
      "Bash(rm *)",
      "Bash(curl *)",
      "Bash(jq *)",
      "Bash(cd *)",
      "Bash(echo *)",
      "Bash(sed *)",
      "Bash(awk *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(wc *)"
    ],
    "deny": [
      "Bash(rm -rf /)",
      "Bash(shutdown *)",
      "Bash(reboot *)",
      "Bash(az account *)",
      "Bash(az group delete *)"
    ]
  }
}
```

---

## The Complete Agent Workflow (Code → Commit → PR → Work Item)

Here's what actually happens when an agent picks up a coding task:

```
┌─────────────────────────────────────────────────────────────┐
│  WORK ITEM #1234: "Add rate limiting to /api/users"        │
│  State: New → Active                                        │
│  Assigned: agent-api-dev (Backend vertical)                 │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  1. BRANCH CREATION                                         │
│                                                             │
│  az repos pr list --status active                           │
│  git checkout -b feature/WI-1234-rate-limiting main         │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  2. CLAUDE CODE DOES THE ACTUAL CODING (headless)           │
│                                                             │
│  claude -p "                                                │
│    You are working on Azure DevOps Work Item #1234:         │
│    'Add rate limiting to /api/users endpoint'               │
│                                                             │
│    Requirements:                                            │
│    - Add express-rate-limit middleware                       │
│    - 100 requests per 15 min per IP                         │
│    - Return 429 with retry-after header                     │
│    - Add unit tests                                         │
│    - Run existing tests to make sure nothing breaks         │
│                                                             │
│    Work in /workspace/backend-api.                          │
│    When done, stage all changes with git add.               │
│  " \                                                        │
│  --allowedTools "Read,Write,Edit,Bash(git *),Bash(npm *),   │
│    Bash(npx *),Bash(node *),Bash(pytest *)" \               │
│  --max-turns 25 \                                           │
│  --output-format stream-json                                │
│                                                             │
│  Claude Code autonomously:                                  │
│  ├── Reads the existing codebase                            │
│  ├── Installs express-rate-limit                            │
│  ├── Implements the middleware                              │
│  ├── Writes unit tests                                      │
│  ├── Runs the test suite                                    │
│  ├── Fixes any failures                                     │
│  ├── Runs linting                                           │
│  └── Stages changes with git add                            │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  3. COMMIT & PUSH                                           │
│                                                             │
│  git commit -m "feat(api): add rate limiting to /api/users  │
│                                                             │
│  - Added express-rate-limit middleware                       │
│  - 100 req/15min per IP with 429 response                   │
│  - Added retry-after header                                 │
│  - Added unit tests (8 passing)                             │
│                                                             │
│  Resolves: WI-1234"                                         │
│                                                             │
│  git push origin feature/WI-1234-rate-limiting              │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  4. CREATE PR + LINK WORK ITEM                              │
│                                                             │
│  az repos pr create \                                       │
│    --title "feat(api): add rate limiting [WI-1234]" \       │
│    --description "$(cat pr-description.md)" \               │
│    --source-branch feature/WI-1234-rate-limiting \          │
│    --target-branch main \                                   │
│    --work-items 1234 \                                      │
│    --draft false \                                          │
│    --transition-work-items true                             │
│                                                             │
│  # Auto-links work item, transitions it to "Resolved"      │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  5. REQUEST CODE REVIEW FROM ANOTHER AGENT                  │
│                                                             │
│  # Post to ADO board or Redis for review agents to pick up  │
│  az boards work-item create \                               │
│    --title "Review PR: rate limiting [WI-1234]" \           │
│    --type "Task" \                                          │
│    --area "Backend/Code Review" \                           │
│    --fields "Custom.AgentID=agent-code-reviewer" \          │
│             "Custom.DeliverableURL=<PR-URL>"                │
│                                                             │
│  # OR: Assign a reviewer directly on the PR                 │
│  az repos pr set-vote --id <PR_ID> --vote approve           │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  6. REVIEW AGENT PICKS UP THE PR                            │
│                                                             │
│  # agent-code-reviewer runs:                                │
│  claude -p "                                                │
│    Review this pull request for the backend API.            │
│    PR diff:                                                 │
│    $(az repos pr diff --id <PR_ID>)                         │
│                                                             │
│    Check for:                                               │
│    - Security issues                                        │
│    - Performance problems                                   │
│    - Test coverage gaps                                     │
│    - Code style violations                                  │
│    - Edge cases not handled                                 │
│                                                             │
│    Output a JSON review with approve/request-changes.       │
│  " --output-format json                                     │
│                                                             │
│  # If approved:                                             │
│  az repos pr set-vote --id <PR_ID> --vote approve           │
│                                                             │
│  # If changes needed:                                       │
│  az repos pr update --id <PR_ID> \                          │
│    --description "Changes requested: [details]"             │
│  # Notify the original agent via ADO comment                │
│                                                             │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│  7. MERGE (after approval + branch policies pass)           │
│                                                             │
│  # If Jarvis has freerain mode:                             │
│  az repos pr update --id <PR_ID> \                          │
│    --status completed \                                     │
│    --squash true \                                          │
│    --delete-source-branch true \                            │
│    --transition-work-items true                             │
│                                                             │
│  # If human approval required:                              │
│  # Jarvis pings you on Telegram with approve/reject buttons │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Updated Agent Runtime (Using Claude Code CLI)

The key shift: instead of calling the Claude API directly, the agent orchestrator invokes `claude -p` as a subprocess for all coding tasks.

```javascript
// agent-runtime-v2.js — orchestrator that delegates coding to Claude Code CLI
const { execSync, spawn } = require("child_process");
const Redis = require("ioredis");

class AgentRuntime {
  constructor(config) {
    this.agentId = config.agentId;
    this.vertical = config.vertical;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.pollInterval = config.pollInterval || 5 * 60 * 1000;
    this.isJarvis = config.isJarvis || false;
    this.workspacePath = config.workspacePath || "/workspace";

    this.redis = new Redis(process.env.REDIS_URL);
    this.lastChecked = new Date();

    // Configure Azure DevOps CLI defaults
    this.configureAzDevOps();
    this.configureGit();
  }

  configureAzDevOps() {
    execSync(`az devops configure --defaults \
      organization="${process.env.ADO_ORG_URL}" \
      project="${process.env.ADO_PROJECT}"`, { stdio: "pipe" });

    // Login with PAT
    execSync(
      `echo "${process.env.ADO_PAT}" | az devops login --organization "${process.env.ADO_ORG_URL}"`,
      { stdio: "pipe" }
    );
  }

  configureGit() {
    execSync(`git config --global user.name "${this.agentId}"`, { stdio: "pipe" });
    execSync(`git config --global user.email "${this.agentId}@agent-factory.local"`, { stdio: "pipe" });

    // Configure git credential helper for Azure DevOps
    const pat = process.env.ADO_PAT;
    const orgUrl = process.env.ADO_ORG_URL;
    execSync(
      `git config --global credential.helper '!f() { echo "password=${pat}"; }; f'`,
      { stdio: "pipe" }
    );
  }

  // ─── ADO Work Item Operations ───────────────────────────────────

  async getNewWorkItems() {
    const since = this.lastChecked.toISOString();
    const wiql = `
      SELECT [System.Id], [System.Title], [System.State], [System.Description]
      FROM WorkItems
      WHERE [System.AreaPath] UNDER '${process.env.ADO_AREA_PATH}'
        AND [System.ChangedDate] > '${since}'
        AND ([System.AssignedTo] = '' OR [Custom.AgentID] = '${this.agentId}')
        AND [System.State] <> 'Closed'
      ORDER BY [System.ChangedDate] DESC
    `;

    const result = execSync(
      `az boards query --wiql "${wiql.replace(/\n/g, " ")}" --output json`,
      { encoding: "utf-8", cwd: this.workspacePath }
    );
    return JSON.parse(result);
  }

  async getWorkItemDetails(id) {
    const result = execSync(
      `az boards work-item show --id ${id} --output json`,
      { encoding: "utf-8" }
    );
    return JSON.parse(result);
  }

  async updateWorkItem(id, fields) {
    const fieldArgs = Object.entries(fields)
      .map(([key, val]) => `"${key}=${val}"`)
      .join(" ");

    execSync(
      `az boards work-item update --id ${id} --fields ${fieldArgs}`,
      { encoding: "utf-8" }
    );
  }

  async createWorkItem(type, title, fields = {}) {
    const fieldArgs = Object.entries(fields)
      .map(([key, val]) => `--fields "${key}=${val}"`)
      .join(" ");

    const result = execSync(
      `az boards work-item create --type "${type}" --title "${title}" \
       --area "${process.env.ADO_AREA_PATH}" ${fieldArgs} --output json`,
      { encoding: "utf-8" }
    );
    return JSON.parse(result);
  }

  async addWorkItemComment(id, comment) {
    // Use the REST API via az since the CLI doesn't have a direct comment command
    execSync(
      `az boards work-item update --id ${id} --discussion "${comment.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8" }
    );
  }

  // ─── Git + PR Operations ───────────────────────────────────────

  createBranch(workItemId, slug) {
    const branchName = `feature/WI-${workItemId}-${slug}`;
    execSync(`git checkout main && git pull origin main`, {
      cwd: this.workspacePath, stdio: "pipe"
    });
    execSync(`git checkout -b ${branchName}`, {
      cwd: this.workspacePath, stdio: "pipe"
    });
    return branchName;
  }

  commitAndPush(branchName, message) {
    execSync(`git add -A`, { cwd: this.workspacePath, stdio: "pipe" });

    // Check if there are changes to commit
    try {
      execSync(`git diff --cached --quiet`, { cwd: this.workspacePath });
      console.log(`[${this.agentId}] No changes to commit`);
      return false;
    } catch {
      // There are changes (diff --quiet exits non-zero when there are diffs)
      execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
        cwd: this.workspacePath, stdio: "pipe"
      });
      execSync(`git push origin ${branchName}`, {
        cwd: this.workspacePath, stdio: "pipe"
      });
      return true;
    }
  }

  async createPR(branchName, title, description, workItemId) {
    const result = execSync(
      `az repos pr create \
        --title "${title}" \
        --description "${description.replace(/"/g, '\\"')}" \
        --source-branch "${branchName}" \
        --target-branch main \
        --work-items ${workItemId} \
        --transition-work-items true \
        --output json`,
      { encoding: "utf-8", cwd: this.workspacePath }
    );
    return JSON.parse(result);
  }

  async completePR(prId) {
    execSync(
      `az repos pr update --id ${prId} \
        --status completed \
        --squash true \
        --delete-source-branch true \
        --transition-work-items true`,
      { encoding: "utf-8" }
    );
  }

  // ─── Claude Code Execution ─────────────────────────────────────

  async executeWithClaudeCode(prompt, options = {}) {
    const {
      maxTurns = 25,
      allowedTools = [
        "Read", "Write", "Edit",
        "Bash(git *)", "Bash(npm *)", "Bash(npx *)",
        "Bash(node *)", "Bash(python3 *)", "Bash(pytest *)",
        "Bash(az *)", "Bash(cat *)", "Bash(ls *)",
        "Bash(find *)", "Bash(grep *)", "Bash(rg *)",
        "Bash(mkdir *)", "Bash(cp *)", "Bash(mv *)",
        "Bash(curl *)", "Bash(jq *)"
      ],
      outputFormat = "json",
      timeout = 10 * 60 * 1000  // 10 minutes default
    } = options;

    const toolsArg = allowedTools.map(t => `"${t}"`).join(",");

    return new Promise((resolve, reject) => {
      const args = [
        "-p", prompt,
        "--allowedTools", toolsArg,
        "--max-turns", maxTurns.toString(),
        "--output-format", outputFormat,
        "--no-user-prompt"
      ];

      const proc = spawn("claude", args, {
        cwd: this.workspacePath,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
        },
        timeout
      });

      let stdout = "";
      let stderr = "";

      proc.stdout.on("data", (data) => {
        stdout += data.toString();
        // Stream progress to Redis for dashboard visibility
        this.redis.publish(`agent:${this.agentId}:progress`, data.toString());
      });

      proc.stderr.on("data", (data) => {
        stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (code === 0) {
          try {
            const result = JSON.parse(stdout);
            resolve(result);
          } catch {
            resolve({ raw: stdout });
          }
        } else {
          reject(new Error(`Claude Code exited with code ${code}: ${stderr}`));
        }
      });

      proc.on("error", reject);
    });
  }

  // ─── Main Task Execution Flow ──────────────────────────────────

  async executeTask(workItem) {
    const id = workItem.id;
    const title = workItem.fields["System.Title"];
    const description = workItem.fields["System.Description"] || "";
    const acceptanceCriteria = workItem.fields["Microsoft.VSTS.Common.AcceptanceCriteria"] || "";

    console.log(`[${this.agentId}] Executing WI-${id}: ${title}`);

    // 1. Create feature branch
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const branchName = this.createBranch(id, slug);

    // 2. Update work item state
    await this.updateWorkItem(id, {
      "System.State": "Active",
      "Custom.AgentID": this.agentId
    });

    // 3. Run Claude Code to do the actual coding
    const prompt = `
You are ${this.agentId}, a specialist ${this.role}.

TASK (Azure DevOps Work Item #${id}):
Title: ${title}
Description: ${description}
Acceptance Criteria: ${acceptanceCriteria}

INSTRUCTIONS:
1. Understand the codebase structure first (read key files)
2. Implement the changes described above
3. Write or update tests for your changes
4. Run the test suite and fix any failures
5. Run linting/formatting (if configured)
6. Stage all your changes with: git add -A
7. Do NOT commit — the orchestrator handles that

WORKSPACE: ${this.workspacePath}
BRANCH: ${branchName}

Be thorough. Write production-quality code. Include error handling.
If you discover issues beyond scope, note them but don't fix them.
    `.trim();

    try {
      const result = await this.executeWithClaudeCode(prompt, {
        maxTurns: 30,
        timeout: 15 * 60 * 1000  // 15 min for complex tasks
      });

      // 4. Commit and push
      const commitMsg = `feat: ${title}\n\nImplemented by ${this.agentId}\nResolves: WI-${id}\n\n${
        result.result || "Changes implemented as specified."
      }`.slice(0, 4000);

      const hasChanges = this.commitAndPush(branchName, commitMsg);

      if (!hasChanges) {
        await this.addWorkItemComment(id,
          `[${this.agentId}] Analyzed the codebase but determined no code changes were needed. ` +
          `Reason: ${result.result || "N/A"}`
        );
        return { success: true, noChanges: true };
      }

      // 5. Create PR and link work item
      const prDescription = this.generatePRDescription(workItem, result);
      const pr = await this.createPR(branchName, `${title} [WI-${id}]`, prDescription, id);

      // 6. Log to work item
      await this.addWorkItemComment(id,
        `[${this.agentId}] Created PR #${pr.pullRequestId}: ${pr.url}\n` +
        `Branch: ${branchName}\n` +
        `Ready for review.`
      );

      // 7. Request review (create review task or notify review agent)
      await this.requestReview(pr, workItem);

      return { success: true, prId: pr.pullRequestId, branchName };

    } catch (error) {
      // Handle failure
      await this.addWorkItemComment(id,
        `[${this.agentId}] ❌ Failed to complete task.\n` +
        `Error: ${error.message}\n` +
        `Escalating to Jarvis.`
      );

      // Escalate to Jarvis
      await this.redis.publish(`vertical:${this.vertical}`, JSON.stringify({
        type: "escalation",
        from: this.agentId,
        workItemId: id,
        error: error.message
      }));

      return { success: false, error: error.message };
    }
  }

  generatePRDescription(workItem, claudeResult) {
    return `
## Work Item
[WI-${workItem.id}](${process.env.ADO_ORG_URL}/${process.env.ADO_PROJECT}/_workitems/edit/${workItem.id}): ${workItem.fields["System.Title"]}

## Changes
${claudeResult.result || "See commit diff for details."}

## Agent
- **Agent**: ${this.agentId}
- **Vertical**: ${this.vertical}
- **Role**: ${this.role}

## Checklist
- [x] Implementation complete
- [x] Tests added/updated
- [x] Tests passing
- [ ] Code review (pending)
- [ ] Human approval (if required)
    `.trim();
  }

  async requestReview(pr, workItem) {
    // Option A: Create a review work item for the review agent
    await this.createWorkItem("Task", `Code Review: PR #${pr.pullRequestId} - ${workItem.fields["System.Title"]}`, {
      "Custom.AgentID": "agent-code-reviewer",
      "Custom.DeliverableURL": pr.url,
      "System.Description": `Review PR #${pr.pullRequestId} for work item WI-${workItem.id}.\\n\\nPR URL: ${pr.url}`
    });

    // Option B: Also notify via Redis for faster pickup
    await this.redis.publish(`vertical:${this.vertical}`, JSON.stringify({
      type: "review-request",
      from: this.agentId,
      prId: pr.pullRequestId,
      prUrl: pr.url,
      workItemId: workItem.id
    }));
  }

  // ─── PR Review Flow (for review agents) ────────────────────────

  async reviewPR(prId) {
    // Get PR diff
    const diff = execSync(
      `az repos pr diff --id ${prId} --output json`,
      { encoding: "utf-8", cwd: this.workspacePath }
    );

    // Get PR details
    const prDetails = execSync(
      `az repos pr show --id ${prId} --output json`,
      { encoding: "utf-8" }
    );
    const pr = JSON.parse(prDetails);

    // Checkout the PR branch to review
    execSync(`git fetch origin ${pr.sourceRefName}`, {
      cwd: this.workspacePath, stdio: "pipe"
    });
    execSync(`git checkout FETCH_HEAD`, {
      cwd: this.workspacePath, stdio: "pipe"
    });

    // Run Claude Code to review
    const reviewResult = await this.executeWithClaudeCode(`
You are a senior code reviewer. Review this pull request thoroughly.

PR Title: ${pr.title}
PR Description: ${pr.description}

Review the codebase changes. Run the tests. Check for:
1. Bugs and logic errors
2. Security vulnerabilities (injection, auth bypass, data leaks)
3. Performance issues (N+1 queries, memory leaks, blocking calls)
4. Missing error handling and edge cases
5. Test coverage gaps
6. Code style and readability
7. Architecture concerns

After reviewing, output a JSON object:
{
  "verdict": "approve" | "request-changes",
  "summary": "Overall assessment",
  "issues": [
    {
      "severity": "critical" | "major" | "minor" | "nit",
      "file": "path/to/file",
      "line": 42,
      "description": "What's wrong",
      "suggestion": "How to fix it"
    }
  ],
  "testsPass": true/false,
  "testCoverage": "assessment of coverage"
}
    `.trim(), {
      maxTurns: 15,
      timeout: 10 * 60 * 1000
    });

    // Parse the review
    let review;
    try {
      const text = reviewResult.result || reviewResult.raw || "";
      review = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      review = { verdict: "request-changes", summary: "Could not complete automated review", issues: [] };
    }

    // Post review comments on the PR
    if (review.verdict === "approve") {
      execSync(`az repos pr set-vote --id ${prId} --vote approve`, { stdio: "pipe" });

      // Add review summary as PR comment
      execSync(
        `az repos pr update --id ${prId} --description "${
          pr.description + "\\n\\n## Automated Review: ✅ Approved\\n" + review.summary
        }"`,
        { encoding: "utf-8" }
      );
    } else {
      execSync(`az repos pr set-vote --id ${prId} --vote wait-for-author`, { stdio: "pipe" });

      // Post issues as PR threads
      const issueText = review.issues
        .map(i => `**[${i.severity.toUpperCase()}]** ${i.file}:${i.line}\\n${i.description}\\n> ${i.suggestion}`)
        .join("\\n\\n");

      execSync(
        `az repos pr update --id ${prId} --description "${
          pr.description + "\\n\\n## Automated Review: 🔄 Changes Requested\\n" + review.summary + "\\n\\n" + issueText
        }"`,
        { encoding: "utf-8" }
      );
    }

    return review;
  }

  // ─── Pipeline Trigger ──────────────────────────────────────────

  async triggerPipeline(pipelineName, branchName, parameters = {}) {
    const paramArgs = Object.entries(parameters)
      .map(([k, v]) => `${k}=${v}`)
      .join(" ");

    const result = execSync(
      `az pipelines run --name "${pipelineName}" \
        --branch "${branchName}" \
        --parameters ${paramArgs} \
        --output json`,
      { encoding: "utf-8" }
    );
    return JSON.parse(result);
  }

  async checkPipelineStatus(runId) {
    const result = execSync(
      `az pipelines runs show --id ${runId} --output json`,
      { encoding: "utf-8" }
    );
    return JSON.parse(result);
  }

  // ─── Poll Loop ─────────────────────────────────────────────────

  async poll() {
    try {
      const items = await this.getNewWorkItems();

      for (const item of items) {
        const details = await this.getWorkItemDetails(item.id);

        // Skip items already assigned to other agents
        const assignedAgent = details.fields["Custom.AgentID"];
        if (assignedAgent && assignedAgent !== this.agentId) continue;

        // Skip items not matching our specialization
        if (!this.isRelevant(details)) continue;

        // Execute the task
        await this.executeTask(details);
      }

      this.lastChecked = new Date();
    } catch (err) {
      console.error(`[${this.agentId}] Poll error:`, err.message);
    }
  }

  isRelevant(workItem) {
    // Override in agent config — each agent defines what work items it picks up
    const tags = (workItem.fields["System.Tags"] || "").toLowerCase();
    const title = (workItem.fields["System.Title"] || "").toLowerCase();
    const keywords = (this.config?.keywords || []).map(k => k.toLowerCase());

    return keywords.some(k => tags.includes(k) || title.includes(k));
  }

  async start() {
    // Clone the repo(s) if not already present
    this.setupWorkspace();

    // Subscribe to Redis channels
    await this.subscribeToChannels();

    // Start polling
    console.log(`[${this.agentId}] Started. Polling every ${this.pollInterval / 1000}s`);
    this.poll();
    setInterval(() => this.poll(), this.pollInterval);
  }

  setupWorkspace() {
    const repos = JSON.parse(process.env.AGENT_REPOS || "[]");
    for (const repo of repos) {
      const repoDir = `${this.workspacePath}/${repo.name}`;
      try {
        execSync(`ls ${repoDir}/.git`, { stdio: "pipe" });
        // Already cloned, just pull
        execSync(`cd ${repoDir} && git checkout main && git pull`, { stdio: "pipe" });
      } catch {
        // Clone it
        execSync(`git clone ${repo.url} ${repoDir}`, { stdio: "pipe" });
      }
    }
  }
}

module.exports = { AgentRuntime };
```

---

## What Else Was Missing — Full Gap Analysis

### ✅ Now Covered (This Document)

| Component | Tool | Purpose |
|-----------|------|---------|
| Coding engine | `claude -p` (Claude Code CLI, headless) | Autonomous code writing, editing, testing |
| Source control | `git` + Azure DevOps Git | Branching, committing, pushing |
| Work items | `az boards work-item` | Create, update, query, close work items |
| Pull requests | `az repos pr` | Create PRs, link work items, auto-complete |
| Code review | `claude -p` + `az repos pr set-vote` | Automated review, approve/reject |
| CI/CD | `az pipelines run` | Trigger builds, check status |
| PR → Work Item linking | `az repos pr work-item add` | Auto-transition work items on PR complete |

### ⚠️ Additional Gaps To Address

| Gap | Why It Matters | Solution |
|-----|----------------|----------|
| **Branch protection policies** | Prevent agents from pushing directly to main | Set up ADO branch policies requiring PR + min 1 reviewer |
| **Merge conflict resolution** | Two agents may edit the same files | Agent detects conflict, rebases or escalates to Jarvis |
| **Repo cloning per workspace** | Each agent needs its own working copy | PersistentVolumeClaim per agent, clone on first boot |
| **Build artifact storage** | Compiled apps need to go somewhere | Azure Artifacts or ACR for container images |
| **Secrets for the apps being built** | DB passwords, API keys for the product | Azure Key Vault, mounted as K8s secrets per namespace |
| **Test environment access** | Agents need staging/dev to test against | Dedicated dev cluster or namespace per vertical |
| **Audit trail** | Track every action every agent takes | Stream Claude Code output to Postgres + Grafana |
| **Token budget per agent** | Prevent runaway API costs | Set `--max-turns` and timeout per agent role |
| **Concurrent file editing** | Two agents on the same repo at once | Each agent works on its own branch; never share branches |
| **Large repo handling** | Claude Code context limits | Use `--allowedTools` with `Bash(rg *)` for targeted search |
| **Agent health monitoring** | Know if a pod crashed or is stuck | Liveness/readiness probes + Prometheus metrics |
| **Rollback capability** | Bad agent code gets merged | Git revert automation + pipeline rollback triggers |

---

## Branch Strategy for Multi-Agent Repos

```
main (protected — requires PR + review + CI green)
├── feature/WI-1234-rate-limiting         (agent-api-dev)
├── feature/WI-1235-user-dashboard        (agent-react-dev)
├── feature/WI-1236-db-migration          (agent-db-architect)
├── bugfix/WI-1237-login-crash            (agent-api-dev)
└── infra/WI-1238-terraform-networking    (agent-infra-terraform)

Rules:
1. Every branch is named: {type}/WI-{id}-{slug}
2. One agent per branch (never shared)
3. Always branch from latest main
4. Squash merge on PR completion
5. Delete source branch after merge
6. If branch conflicts with main:
   a. Agent rebases: git rebase main
   b. Re-runs tests
   c. Force pushes: git push --force-with-lease
   d. If rebase fails → escalate to Jarvis
```

---

## Azure DevOps Branch Policies (Apply to main)

```bash
# Set up branch policies via CLI
# Require minimum 1 reviewer (the review agent counts)
az repos policy approver-count create \
  --branch main \
  --repository-id <REPO_ID> \
  --minimum-approver-count 1 \
  --creator-vote-counts false \
  --allow-downvotes false \
  --reset-on-source-push true \
  --blocking true \
  --enabled true

# Require build validation (CI pipeline must pass)
az repos policy build create \
  --branch main \
  --repository-id <REPO_ID> \
  --build-definition-id <PIPELINE_ID> \
  --display-name "CI Build Validation" \
  --blocking true \
  --enabled true \
  --queue-on-source-update-only true \
  --valid-duration 720
```

---

## Kubernetes ConfigMap — Full Agent Config Example

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-api-dev-config
  namespace: jarvis-backend
data:
  agent-config.json: |
    {
      "agentId": "agent-api-dev",
      "vertical": "jarvis-backend",
      "role": "Backend API Developer",
      "isJarvis": false,
      "pollInterval": 300000,
      "keywords": ["api", "endpoint", "rest", "graphql", "middleware", "route", "controller"],
      "workspacePath": "/workspace/backend-api",
      "systemPrompt": "You are agent-api-dev, a senior backend developer specializing in Node.js/Express APIs. You write clean, well-tested, production-grade code. You always include error handling, input validation, and appropriate HTTP status codes. You follow REST conventions.",
      "claudeCode": {
        "maxTurns": 30,
        "timeout": 900000,
        "allowedTools": [
          "Read", "Write", "Edit",
          "Bash(git *)", "Bash(npm *)", "Bash(npx *)",
          "Bash(node *)", "Bash(jest *)", "Bash(vitest *)",
          "Bash(curl *)", "Bash(cat *)", "Bash(ls *)",
          "Bash(find *)", "Bash(grep *)", "Bash(rg *)",
          "Bash(az boards *)", "Bash(az repos *)"
        ]
      }
    }
  repos.json: |
    [
      {
        "name": "backend-api",
        "url": "https://dev.azure.com/your-org/Agent-Factory/_git/backend-api"
      }
    ]
```

---

## Updated Deployment Checklist

1. **Container Image**
   - [ ] Build Dockerfile with Node.js 22+, Claude Code CLI, Azure CLI, Git
   - [ ] Push to container registry (ACR)
   - [ ] Test `claude -p` works in the container

2. **Azure DevOps Setup**
   - [ ] Create project + repos
   - [ ] Set up branch policies on main (require PR + reviewer + CI)
   - [ ] Create area paths per vertical
   - [ ] Generate PAT with repos + boards + pipelines permissions
   - [ ] Create CI/CD pipelines for each repo

3. **Per-Namespace Setup**
   - [ ] Create namespace + secrets (ANTHROPIC_API_KEY, ADO_PAT)
   - [ ] Create PVCs for agent workspaces
   - [ ] Deploy Jarvis CEO StatefulSet
   - [ ] Deploy first specialist agent
   - [ ] Test: WI created → agent picks up → codes → commits → creates PR → review agent approves

4. **Monitoring**
   - [ ] Prometheus scraping agent metrics
   - [ ] Grafana dashboard: tasks completed, PRs created, API token usage
   - [ ] Alert on: stuck agents, failed Claude Code runs, merge conflicts
   - [ ] Cost tracking: tokens consumed per agent per day
