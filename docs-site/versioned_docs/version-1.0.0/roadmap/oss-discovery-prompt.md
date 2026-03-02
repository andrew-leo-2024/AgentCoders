---
sidebar_position: 2
title: OSS Discovery Prompt
---

# Open-Source Discovery Prompt — v1

:::info Version History
- **v1 (2026-03-01):** Initial discovery prompt. Targets capabilities AgentCoders needs, mapped to known high-value OSS projects.
:::

## Purpose

This document contains a reusable prompt for any Claude agent (or human researcher) to systematically discover, evaluate, and catalog open-source GitHub projects that AgentCoders can **fork, audit, harden, and integrate** — instead of building from scratch.

## Philosophy: Fork-Audit-Extract-Integrate

AgentCoders does NOT adopt entire frameworks. The process is:

1. **Fork** — create our own copy under the AgentCoders org
2. **Audit** — scan for malicious code, supply chain risks, vulnerable dependencies, telemetry/phoning-home, hardcoded credentials, obfuscated code
3. **Extract** — pull out the specific module/capability we need
4. **Adapt** — rewrite to fit TypeScript ESM, Drizzle ORM, our Redis pub/sub, our tenant isolation model
5. **Integrate** — ship as a new or enhanced AgentCoders package with full test coverage

## Known High-Value Projects

### Tier 1: Directly Relevant (Fork Candidates)

| Project | Stars (2026) | What AgentCoders Extracts | Maps To Package |
|---------|-------------|--------------------------|-----------------|
| **OpenClaw** | 145K-221K | Modular skills system, 100+ community skills, trigger-based agent behavior, multi-platform integration patterns | `@agentcoders/skill-registry`, `@agentcoders/agent-runtime` |
| **AutoGPT** | ~140K | Task decomposition patterns, memory architecture, plugin system, self-improvement loops | `@agentcoders/jarvis-runtime`, `@agentcoders/agent-memory` |
| **AgentGPT** | ~100K | Browser-based agent UI patterns, real-time execution visualization, task tree rendering | `@agentcoders/dashboard` |
| **MemOS** | ~10K | Persistent long-term memory with relevance scoring, cross-session context, memory compaction | `@agentcoders/agent-memory` |
| **CrewAI** | ~10K+ | Role-based multi-agent orchestration, task delegation, inter-agent communication, crew formation | `@agentcoders/jarvis-runtime`, `@agentcoders/management-models` |

### Tier 2: Capability Extraction

| Project | Stars (2026) | What AgentCoders Extracts | Maps To Package |
|---------|-------------|--------------------------|-----------------|
| **OpenCode** | ~20K-30K | Agentic coding patterns, multi-provider model routing, code generation pipelines | `@agentcoders/model-router`, `@agentcoders/enhancement-layer` |
| **BabyAGI** | Notable | Lightweight task prioritization, task chaining, objective decomposition | `@agentcoders/jarvis-runtime` (GSD Planner) |
| **Open Interpreter** | Notable | Sandboxed local execution, privacy-first code running, streaming output | `@agentcoders/agent-runtime` (ClaudeCodeExecutor) |
| **SuperAGI** | ~10K+ | Enterprise agent management, resource provisioning, agent marketplace patterns | `@agentcoders/tenant-manager`, `@agentcoders/skill-registry` |
| **Nanobot** | ~20K | Edge/low-resource agent execution, efficient inference patterns | Future: lightweight agent tier |

### Tier 3: Ecosystem & Infrastructure

| Category | Projects to Scout | What We Extract |
|----------|------------------|-----------------|
| **Prompt Engineering** | LangChain, DSPy, Guidance | Structured prompt composition, chain-of-thought patterns |
| **RAG Systems** | LlamaIndex, Chroma, Weaviate | Retrieval-augmented generation for agent context |
| **Code Analysis** | Tree-sitter, ast-grep, Semgrep | AST-based code understanding for enhancement pipeline |
| **Observability** | Langfuse, Phoenix (Arize), Helicone | LLM observability, token tracking, cost monitoring |
| **Sandboxing** | E2B, Daytona, Devbox | Secure code execution environments for agent pods |
| **Workflow** | Temporal, Inngest, Trigger.dev | Durable workflow execution for agent lifecycles |

---

## The Discovery Prompt

Copy and use this prompt with any Claude agent, ChatGPT, or search tool to discover additional projects:

````
## Task: GitHub Open-Source Discovery for AgentCoders

You are researching open-source GitHub projects that AgentCoders — an autonomous
AI development factory — can fork, audit for security, and integrate to accelerate
its platform. AgentCoders ships autonomous coding agents that deliver work items
as merged PRs with quality gates.

### What AgentCoders Needs (Capability Gaps)

Search for projects that solve these specific problems:

**Agent Execution & Orchestration**
- Autonomous agent loops with self-correction and retry logic
- Multi-agent coordination (role assignment, task delegation, conflict resolution)
- Agent-to-agent communication protocols
- Durable agent execution (survive restarts, resume from checkpoints)

**Memory & Context**
- Long-term agent memory with relevance decay and compaction
- Cross-session context persistence (agents remember past work)
- RAG systems for injecting codebase knowledge into agent context
- Memory sharing between agents within a team

**Skills & Tools**
- Modular skill/plugin architectures for coding agents
- Community skill marketplaces and registries
- Tool-use frameworks (file manipulation, git operations, API calls)
- MCP (Model Context Protocol) server implementations

**Code Intelligence**
- AST-based code understanding and transformation
- Automated code review and quality scoring
- Security scanning for generated code
- Test generation from code analysis

**Multi-Model & Routing**
- Multi-provider LLM routing with fallback chains
- Cost optimization across model providers
- Model selection based on task complexity
- Streaming and batching optimizations

**Workflow & Reliability**
- Durable workflow engines for multi-step agent tasks
- Retry/compensation patterns for failed agent actions
- Event-driven architectures for agent lifecycle management
- Sandboxed execution environments

**Observability**
- LLM-specific observability (token usage, latency, quality scores)
- Agent behavior tracing and debugging
- Cost tracking across model providers
- Dashboard patterns for agent fleet monitoring

### Evaluation Criteria

For each project found, assess:

1. **Stars & Activity**: Stars, recent commits (last 90 days), open issues, contributor count
2. **License**: Must be permissive (MIT, Apache 2.0, BSD). Flag GPL/AGPL.
3. **Language**: TypeScript/JavaScript preferred. Python acceptable if the patterns are extractable.
4. **Modularity**: Can we extract specific modules, or is it monolithic?
5. **Security Posture**: Known vulnerabilities, dependency health, code review practices
6. **Integration Effort**: How much adaptation needed for TypeScript ESM + Drizzle ORM + Redis pub/sub?
7. **Specific Module to Extract**: Name the exact folder/module/class we'd fork

### Output Format

For each project, provide:

```
## [Project Name](github-url) ⭐ {stars}
- **License:** MIT/Apache/etc
- **Language:** TypeScript/Python/etc
- **Last Active:** date of most recent commit
- **What to Extract:** specific module/capability
- **Maps to AgentCoders Package:** @agentcoders/{package}
- **Integration Effort:** Low/Medium/High
- **Security Notes:** any concerns
- **Why It Matters:** 1-sentence value proposition
```

### Search Queries to Run

Use these GitHub search queries and web searches:

```
github.com topics: ai-agent, autonomous-agent, coding-agent, llm-agent
github.com search: "agent framework" language:TypeScript stars:>1000
github.com search: "agent memory" OR "long-term memory" language:TypeScript stars:>500
github.com search: "multi-agent" OR "agent orchestration" stars:>2000
github.com search: "code generation agent" OR "coding agent" stars:>1000
github.com search: "MCP server" OR "model context protocol" stars:>500
github.com search: "llm routing" OR "model router" stars:>500
github.com search: "agent skill" OR "agent plugin" OR "agent tool" stars:>1000
web search: "best open source AI agent frameworks 2026"
web search: "github AI coding agent projects 2026"
web search: "open source alternatives to Devin Cursor Claude Code 2026"
web search: "agent memory persistence github 2026"
web search: "multi-agent orchestration framework open source 2026"
```

### Projects Already Known (Don't Re-list Unless Adding New Info)

- OpenClaw (~145K-221K stars) — skills system, triggers, multi-platform
- AutoGPT (~140K stars) — task decomposition, memory, plugins
- AgentGPT (~100K stars) — browser UI, task trees
- OpenCode (~20K-30K stars) — agentic coding, multi-provider
- Nanobot (~20K stars) — edge AI agents
- MemOS (~10K stars) — persistent agent memory
- CrewAI (~10K stars) — multi-agent orchestration
- SuperAGI (~10K stars) — enterprise agents
- Open Interpreter — local execution
- BabyAGI — task management

Find projects NOT on this list. Prioritize hidden gems with 1K-20K stars that
solve specific problems well, over mega-projects that try to do everything.
````

---

## Security Audit Checklist

Before integrating any forked code, verify:

- [ ] No obfuscated or minified source in the repo
- [ ] No outbound telemetry, analytics, or phone-home calls
- [ ] No hardcoded API keys, tokens, or credentials
- [ ] No eval(), Function(), or dynamic code execution outside sandboxes
- [ ] Dependencies scanned with `npm audit` / `pnpm audit`
- [ ] License compatibility verified (MIT/Apache 2.0 preferred)
- [ ] No native binaries without source (verify all `.node`, `.so`, `.dylib`)
- [ ] Git history reviewed for suspicious force-pushes or author changes
- [ ] CI/CD pipeline does not download external scripts at build time
- [ ] No postinstall scripts that execute arbitrary code

## Integration Template

When forking a project module into AgentCoders:

```
packages/
  {package-name}/
    src/
      forked/
        {project-name}/           # Extracted module, cleaned
          README.md               # Origin URL, commit hash, license, what was modified
          ...source files...
      adapters/
        {project-name}-adapter.ts # Our TypeScript adapter wrapping the forked code
    ATTRIBUTION.md                # Full license attribution
```

Every forked module gets:
- Origin commit hash pinned
- ATTRIBUTION.md with full license text
- Adapter layer (never import forked code directly from other packages)
- Unit tests covering our usage patterns
- Security scan results logged
