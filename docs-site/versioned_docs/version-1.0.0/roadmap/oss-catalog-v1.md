---
sidebar_position: 3
title: OSS Integration Catalog — v1
---

# Open-Source Integration Catalog — v1

:::info Version History
- **v1 (2026-03-01):** Initial catalog. 60+ projects discovered across 6 capability tracks via systematic research. Each project evaluated for license, language, integration effort, and strategic fit.
:::

## Overview

This catalog contains **60+ open-source projects** that AgentCoders can fork, audit, and integrate using the [Fork-Audit-Extract-Integrate methodology](./oss-discovery-prompt). Projects are organized by capability track and prioritized by strategic value.

**Selection criteria:** 1K-20K stars (hidden gems), permissive license preferred (MIT/Apache-2.0), TypeScript-native where possible, solves a specific problem well.

---

## Track 1: Agent Execution and Orchestration

Projects for autonomous agent loops, multi-agent coordination, and durable execution.

| Project | Stars | License | Language | What to Extract | Maps To | Effort |
|---------|-------|---------|----------|-----------------|---------|--------|
| **Mastra** | ~19.4K | Apache-2.0 | TypeScript | Agent orchestration, eval framework, RAG, workflow engine | agent-runtime, governance | Low |
| **Trigger.dev** | ~16K | Apache-2.0 | TypeScript | Durable workflow execution, retry logic, K8s-native scheduling | agent-runtime | Medium |
| **E2B** | ~10K | Apache-2.0 | TypeScript SDK | Sandboxed code execution, cloud microVMs, filesystem isolation | agent-runtime | Low |
| **LangGraph.js** | ~1K+ | MIT | TypeScript | Stateful multi-agent graphs, checkpointing, human-in-the-loop | jarvis-runtime | Medium |
| **A2A Protocol** | ~8K | Apache-2.0 | TypeScript | Google's Agent-to-Agent protocol, task lifecycle, agent cards | shared, agent-runtime | Medium |
| **Inngest AgentKit** | ~5K+ | Apache-2.0 | TypeScript | Durable agent execution with state machines, tool routing | agent-runtime | Low |
| **Temporal** | ~12K | MIT | Go/TS SDK | Workflow durability, saga patterns, activity retries | jarvis-runtime | Medium |
| **Hatchet** | ~4K+ | MIT | TypeScript | Durable workflow engine, DAG-based task execution | jarvis-runtime | Medium |
| **Restate** | ~2K+ | Apache-2.0 | TypeScript SDK | Durable execution with virtual objects, exactly-once semantics | agent-runtime | Medium |
| **AWS Agent Squad** | ~1K+ | Apache-2.0 | TypeScript | Multi-agent orchestration, supervisor routing, shared memory | jarvis-runtime | Medium |

### Priority Actions

1. **Mastra** -- TypeScript-native, Apache-2.0, 300K+ weekly npm downloads. Extract eval framework for quality gates
2. **E2B** -- Drop-in sandboxed execution for agent pods
3. **Inngest AgentKit** -- Durable agent state machines with zero infrastructure

---

## Track 2: Memory and Context

Projects for persistent agent memory, RAG systems, and cross-session context.

| Project | Stars | License | Language | What to Extract | Maps To | Effort |
|---------|-------|---------|----------|-----------------|---------|--------|
| **LanceDB** | ~9.2K | Apache-2.0 | Rust + TS SDK | Embedded vector DB, zero-infra, hybrid search (vector + BM25) | agent-memory | Low |
| **VoltAgent** | ~6.3K | MIT | TypeScript | Memory adapter pattern, durable memory persistence | agent-memory | Low |
| **Letta Code** | ~1.7K | Apache-2.0 | TypeScript | Git-versioned context repos, memory-first coding agent loop | agent-memory | Low |
| **OpenMemory** | ~3.5K | Apache-2.0 | TS + Python | Relevance decay, MCP endpoint, hierarchical memory decomposition | agent-memory | Low |
| **Cognee** | ~12.7K | Apache-2.0 | Python | Knowledge graph + vector hybrid search, poly-store architecture | agent-memory | Medium |
| **Mem0** | ~48K | Apache-2.0 | Python + TS SDK | Universal memory layer, dedup, relationship-aware recall | agent-memory | Medium |
| **Graphiti** | ~23.2K | Apache-2.0 | Python | Temporal knowledge graphs, bi-temporal data model, MCP server | agent-memory | Medium |
| **SimpleMem** | ~3K | MIT | Python | Semantic compression, online synthesis, intent-aware retrieval | agent-memory | Medium |
| **Code-Graph-RAG** | ~2K | MIT | Python | Tree-sitter code graph, monorepo RAG with edit support, MCP server | agent-runtime | Medium |
| **MCP Memory Service** | ~1.4K | Apache-2.0 | Python | MCP-native persistent memory, dual capture system, REST API | agent-memory | Low |
| **Engram** | ~585 | MIT | Go | Single binary, SQLite, 13 MCP tools, passive memory capture | agent-memory | Low |
| **LightRAG** | ~28.8K | MIT | Python | Dual-level graph RAG, incremental updates, EMNLP 2025 paper | agent-memory | Medium |
| **CocoIndex** | ~6.2K | Apache-2.0 | Rust + Python | Incremental codebase indexing, Tree-sitter chunking | agent-runtime | Medium |
| **Letta** | ~21.3K | Apache-2.0 | Python | Self-editing memory tiers, context compaction | agent-memory | Medium |
| **Hindsight** | ~2K | MIT | Python | Structured memory networks, time-anchored model, relevance decay | agent-memory | Medium |

### Priority Actions

1. **LanceDB** -- Embedded vector DB with native TypeScript SDK, zero infrastructure per agent pod
2. **Engram** -- Single binary sidecar, MCP-native, purpose-built for Claude Code agents
3. **Letta Code** -- Git-versioned context repos, TypeScript, memory-first coding agent pattern
4. **OpenMemory** -- Deploy as MCP memory backend with relevance decay

---

## Track 3: Skills, Tools, and MCP

Projects for modular skill systems, MCP servers, and tool-use frameworks.

| Project | Stars | License | Language | What to Extract | Maps To | Effort |
|---------|-------|---------|----------|-----------------|---------|--------|
| **FastMCP** | ~5K+ | MIT | TypeScript | Lightweight MCP server framework, tool registration patterns | skill-registry | Low |
| **azure-devops-mcp** | ~1K+ | MIT | TypeScript | ADO work item and pipeline MCP tools | scm-adapters | Low |
| **mcp-server-kubernetes** | ~1K+ | Apache-2.0 | TypeScript | K8s resource management via MCP | agent-runtime | Low |
| **git-mcp-server** | ~1K+ | MIT | TypeScript | Git operations as MCP tools | agent-runtime | Low |
| **Composio** | ~15K+ | Apache-2.0 | TypeScript | Agent orchestrator, 250+ tool integrations, auth management | skill-registry | Medium |
| **Agentica** | ~2K+ | MIT | TypeScript | TypeScript-first agent tool framework, schema validation | agent-runtime | Low |
| **microsoft/skills** | ~1K+ | MIT | TypeScript | Microsoft's modular skills framework, skill composition | skill-registry | Medium |
| **kagent** | ~1K+ | Apache-2.0 | Go + TS | Kubernetes-native agent management, CRD-based skill deployment | agent-runtime | Medium |
| **VoltAgent** | ~6.3K | MIT | TypeScript | Tool/memory/guardrail system, sub-agent orchestration | agent-runtime | Low |

### Priority Actions

1. **FastMCP** -- Fastest path to exposing AgentCoders capabilities as MCP tools
2. **azure-devops-mcp** -- Direct ADO integration for agent pods (AgentCoders' primary SCM)
3. **git-mcp-server** -- Git operations as MCP tools for Claude Code agents

---

## Track 4: Code Intelligence and Review

Projects for AST analysis, automated review, security scanning, and test generation.

| Project | Stars | License | Language | What to Extract | Maps To | Effort |
|---------|-------|---------|----------|-----------------|---------|--------|
| **ast-grep** | ~12.7K | MIT | Rust + TS NAPI | Structural code search/lint/rewrite via Tree-sitter ASTs | enhancement-layer | Low |
| **Knip** | ~10.2K | ISC | TypeScript | Unused files/deps/exports detection, monorepo-native | enhancement-layer, governance | Low |
| **Qodo PR-Agent** | ~10.1K | AGPL-3.0 | Python | PR compression, diff analysis, `/review` `/improve` pipeline | agent-runtime | Medium |
| **reviewdog** | ~9K | MIT | Go | Universal linter-to-PR-comment bridge, SARIF parser, diff filter | governance | Low |
| **Madge** | ~9.8K | MIT | JavaScript | Circular dependency finder, module dependency graphs | enhancement-layer | Low |
| **ts-morph** | ~5.9K | MIT | TypeScript | Full TS Compiler API wrapper, programmatic AST manipulation | enhancement-layer | Low |
| **Danger.js** | ~5.4K | MIT | TypeScript | PR metadata DSL, review rules, Azure DevOps native support | governance | Low |
| **jscpd** | ~5.4K | MIT | TypeScript | Rabin-Karp duplication detection, 150+ languages, programmatic API | enhancement-layer | Low |
| **Stryker-JS** | ~2.7K | Apache-2.0 | TypeScript | Mutation testing, Vitest plugin, meaningful test quality scoring | billing-service | Low |
| **dependency-cruiser** | ~6.2K | MIT | JavaScript | Dependency graph builder, architectural constraint rules | governance | Low |
| **Bearer** | ~2.5K | ELv2 | Go | Data-flow SAST, OWASP Top 10, PII leak detection | governance | Medium |
| **Opengrep** | ~2.2K | LGPL-2.1 | OCaml | Semgrep fork with restored taint analysis, inter-procedural scanning | governance | Medium |
| **CodeRabbit ai-pr-reviewer** | ~2K | MIT | TypeScript | AI PR review, incremental review, GitHub Actions integration | agent-runtime | Low |
| **Lizard** | ~2K | MIT | Python | Cyclomatic complexity calculator, 20+ languages | enhancement-layer | Low |
| **GitHub TestPilot** | ~562 | MIT | TypeScript | Generate-validate-fix test loop pattern | agent-runtime | Medium |
| **CodePrism** | Growing | MIT | Rust | Graph-based code analysis, 23 tools, MCP server, Universal AST | agent-runtime | Medium |
| **GitHub CodeQL** | ~8K | MIT (queries) | CodeQL | Taint tracking, injection detection, semantic code analysis | governance | Medium |

### Priority Actions — The Agent Quality Pipeline

```text
Agent generates code
        |
  [ast-grep] --- structural validation
        |
  [ts-morph] --- semantic validation (types resolve? imports correct?)
        |
  [Knip] --- hygiene (dead code, unused deps, unused exports?)
        |
  [jscpd] --- duplication detection (AI copy-pasting?)
        |
  [Bearer + Opengrep] --- security scan (data flow, taint analysis)
        |
  [Stryker-JS] --- test quality (mutation score > 80%)
        |
  [reviewdog] --- post all findings as PR comments
        |
  [Danger.js] --- enforce team conventions
        |
  PR created in Azure DevOps / GitHub
```

**P0 (Foundation):** ast-grep, Knip, Stryker-JS
**P1 (Quality):** ts-morph, CodeRabbit ai-pr-reviewer, Bearer
**P2 (Review):** jscpd, Danger.js, reviewdog, dependency-cruiser

---

## Track 5: Observability and LLM Ops

Projects for LLM tracing, cost tracking, prompt management, and agent fleet monitoring.

| Project | Stars | License | Language | What to Extract | Maps To | Effort |
|---------|-------|---------|----------|-----------------|---------|--------|
| **Opik** | ~17.9K | Apache-2.0 | Java + TS SDK | LLM-as-judge eval framework, trace visualization, 40M+ traces/day | governance, billing-service | Medium |
| **TensorZero** | ~11K | Apache-2.0 | Rust | Sub-ms LLM gateway, experiment routing, dynamic in-context learning | model-router | Medium |
| **Portkey AI Gateway** | ~10.7K | MIT | TypeScript | LLM gateway (122KB), retry/fallback/load-balance, cost tracking | model-router | Low |
| **OpenLLMetry** | ~6.9K | Apache-2.0 | Python + TS | OpenTelemetry instrumentation for LLM calls, semantic conventions | agent-runtime | Low |
| **VoltAgent** | ~5.1K | MIT | TypeScript | Observability-first agent framework, VoltOps Console | agent-runtime, dashboard | Low |
| **AgentOps** | ~5.3K | MIT | Python | Session replay, multi-agent tracking, cost aggregation | jarvis-runtime | Low |
| **Mastra** | ~19.4K | Apache-2.0 | TypeScript | Built-in eval/observability, 300K+ weekly npm downloads | governance | Low |
| **Latitude** | ~3.9K | LGPL-3.0 | TypeScript | Prompt versioning with publish/deploy workflow, eval-driven loop | governance | Medium |
| **Agenta** | ~3.9K | MIT | TS + Python | Prompt playground, A/B testing, human annotation | governance | Medium |
| **LangWatch** | ~2.8K | Custom (BSL) | TypeScript | Real-time eval framework, dataset curation, annotation UI | governance | Medium |
| **Bifrost** | ~2.6K | Apache-2.0 | Go | Ultra-low-latency gateway, semantic caching, virtual key budgets | model-router, billing-service | Medium |
| **OpenLIT** | ~2.3K | Apache-2.0 | Python + TS | One-line OTel instrumentation, pre-built Grafana dashboards | agent-runtime, dashboard | Low |
| **Pezzo** | ~3.2K | Apache-2.0 | TypeScript | Instant prompt delivery (change in UI, agent picks up immediately) | governance | Low |
| **TokenCost** | ~1.9K | MIT | Python | Pricing database for 400+ models, cost calculation utilities | billing-service | Low |
| **RouteLLM** | ~3.5K | Apache-2.0 | Python | Pre-trained router classifiers, 85% cost reduction, 95% quality | model-router | Medium |
| **Evidently** | ~5.5K | Apache-2.0 | Python | 100+ eval metrics (toxicity, hallucination, quality), drift detection | governance | Medium |

### Priority Actions

1. **Portkey AI Gateway** -- TypeScript, MIT, drop-in LLM proxy with retry/fallback/cost tracking
2. **OpenLLMetry-JS** -- One-line OTel instrumentation for Claude calls in agent-runtime
3. **OpenLIT Grafana dashboards** -- Import pre-built LLM metrics dashboards immediately
4. **TokenCost** -- Port pricing data to TypeScript for billing-service

---

## Track 6: Workflow and Reliability

Projects for durable workflows, event-driven execution, and job scheduling.

| Project | Stars | License | Language | What to Extract | Maps To | Effort |
|---------|-------|---------|----------|-----------------|---------|--------|
| **Hatchet** | ~4K+ | MIT | TypeScript | DAG-based durable workflows, event triggers, worker pools | jarvis-runtime | Medium |
| **DBOS Transact** | ~2K+ | MIT | TypeScript | Exactly-once execution via Postgres, no separate infra | agent-runtime | Low |
| **Graphile Worker** | ~2K+ | MIT | TypeScript | Postgres-backed job queue, cron, migration-safe | agent-runtime | Low |
| **pg-boss** | ~2K+ | MIT | TypeScript | Postgres-native job queue, exponential backoff, job priorities | agent-runtime | Low |
| **Restate** | ~2K+ | Apache-2.0 | TS SDK | Durable execution, virtual objects, saga patterns | agent-runtime | Medium |
| **Effect-TS** | ~8K+ | MIT | TypeScript | Typed effect system, retry/timeout/circuit-breaker, fiber concurrency | shared | Medium |
| **XState** | ~27K+ | MIT | TypeScript | Finite state machines, statecharts, visual editor | agent-runtime | Low |

### Priority Actions

1. **pg-boss** or **Graphile Worker** -- Postgres-native job queues (AgentCoders already uses Postgres)
2. **DBOS Transact** -- Exactly-once execution with zero new infrastructure
3. **XState** -- State machine modeling for agent lifecycle states

---

## Cross-Track Integration Architecture

```text
                    ┌──────────────────────────────────────┐
                    │         Portkey AI Gateway            │
                    │   (retry, fallback, cost tracking)    │
                    └──────────────┬───────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
    ┌─────────▼──────┐  ┌────────▼────────┐  ┌────────▼────────┐
    │  Agent Pod #1   │  │  Agent Pod #2   │  │  Agent Pod #N   │
    │                 │  │                 │  │                 │
    │ [LanceDB]       │  │ [LanceDB]       │  │ [LanceDB]       │
    │  embedded memory│  │  embedded memory│  │  embedded memory│
    │                 │  │                 │  │                 │
    │ [Engram]        │  │ [Engram]        │  │ [Engram]        │
    │  MCP memory     │  │  MCP memory     │  │  MCP memory     │
    │                 │  │                 │  │                 │
    │ [OpenLLMetry]   │  │ [OpenLLMetry]   │  │ [OpenLLMetry]   │
    │  OTel tracing   │  │  OTel tracing   │  │  OTel tracing   │
    └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
             │                    │                     │
             └────────────────────┼─────────────────────┘
                                  │
              ┌───────────────────▼────────────────────┐
              │        Quality Pipeline                 │
              │                                        │
              │  ast-grep → ts-morph → Knip → jscpd   │
              │       → Bearer → Stryker-JS            │
              │       → reviewdog → Danger.js          │
              └───────────────────┬────────────────────┘
                                  │
              ┌───────────────────▼────────────────────┐
              │  Jarvis CEO (pg-boss job queue)         │
              │  Task decomposition + squad management  │
              │  [AgentOps session replay]              │
              └───────────────────┬────────────────────┘
                                  │
              ┌───────────────────▼────────────────────┐
              │  Dashboard                              │
              │  [OpenLIT Grafana] + [Opik trace UI]   │
              └────────────────────────────────────────┘
```

---

## License Summary

### Safe to Fork (MIT / Apache-2.0 / ISC)

Most projects in this catalog. Use freely in commercial products.

### Requires Caution

| Project | License | Issue |
|---------|---------|-------|
| Qodo PR-Agent | AGPL-3.0 | Modifications must be open-sourced. Use as a service boundary only |
| Qodo Cover | AGPL-3.0 | Same as PR-Agent. Run as isolated service |
| Bearer | ELv2 | Cannot offer as a managed service. Fine for internal use |
| Opengrep | LGPL-2.1 | Modifications to library must be open-sourced (not your app) |
| Latitude | LGPL-3.0 | Same as Opengrep |
| LangWatch | Custom BSL | Review specific terms before commercial deployment |
| GitNexus | PolyForm NC | Cannot use commercially without separate license |
| Sourcebot | Fair Source | Not OSI-approved. Review terms for commercial scale |

---

## Top 15 Immediate Integration Targets

Ranked by strategic value, license safety, and integration effort:

| Rank | Project | Track | License | Lang | Effort | Why First |
|------|---------|-------|---------|------|--------|-----------|
| 1 | **ast-grep** | Code Intelligence | MIT | Rust+TS | Low | Foundation for all code understanding |
| 2 | **LanceDB** | Memory | Apache-2.0 | Rust+TS | Low | Embedded vector DB, zero infra per pod |
| 3 | **Portkey Gateway** | Observability | MIT | TS | Low | Drop-in LLM proxy with cost tracking |
| 4 | **Knip** | Code Intelligence | ISC | TS | Low | Catches AI's worst habit (dead code) on your exact stack |
| 5 | **Stryker-JS** | Code Intelligence | Apache-2.0 | TS | Low | Only honest metric for AI-generated test quality |
| 6 | **pg-boss** | Workflow | MIT | TS | Low | Postgres-native job queue (already have Postgres) |
| 7 | **FastMCP** | Skills/MCP | MIT | TS | Low | Expose AgentCoders capabilities as MCP tools |
| 8 | **Engram** | Memory | MIT | Go | Low | Single binary MCP memory for Claude Code agents |
| 9 | **ts-morph** | Code Intelligence | MIT | TS | Low | Deep TypeScript semantic analysis |
| 10 | **Danger.js** | Code Intelligence | MIT | TS | Low | Azure DevOps-native review rules |
| 11 | **OpenLLMetry-JS** | Observability | Apache-2.0 | TS | Low | One-line OTel for Claude calls |
| 12 | **azure-devops-mcp** | Skills/MCP | MIT | TS | Low | ADO integration via MCP |
| 13 | **jscpd** | Code Intelligence | MIT | TS | Low | AI duplication detection |
| 14 | **Mastra** | Orchestration | Apache-2.0 | TS | Low | Eval framework extraction |
| 15 | **E2B** | Orchestration | Apache-2.0 | TS | Low | Sandboxed code execution |

---

## Next Steps

1. **Phase 1 (Week 1-2):** Integrate Top 5 -- ast-grep, LanceDB, Portkey, Knip, Stryker-JS
2. **Phase 2 (Week 3-4):** Add quality pipeline -- ts-morph, jscpd, Danger.js, reviewdog, Bearer
3. **Phase 3 (Month 2):** Memory layer -- Engram, OpenMemory, Letta Code
4. **Phase 4 (Month 3):** Observability -- OpenLLMetry, Opik eval framework, Grafana dashboards

Each integration follows the [Fork-Audit-Extract-Integrate process](./oss-discovery-prompt#philosophy-fork-audit-extract-integrate) and [Security Audit Checklist](./oss-discovery-prompt#security-audit-checklist).
