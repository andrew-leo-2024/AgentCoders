---
sidebar_position: 1
title: Implementation Approach — v1
---

# Implementation Approach — v1

:::info Version History
- **v1 (2026-03-01):** Initial approach. Derived from production readiness audit (55/100 score) and first-tenant analysis (AINEFF).
:::

## Strategic Assessment

AgentCoders has **strong architecture and sharp business model** but is **wide and shallow**. 14 packages, 22k LOC, 25 tables — much of it structural scaffolding. The core agent-Claude-git-PR loop has not been battle-tested on real projects. The path to revenue is narrowing focus to the core loop, proving it works, then layering platform capabilities.

### What's Strong
- DWI billing model — "you only pay for merged code" is a killer sales pitch
- 6-gate quality system with auto-revert builds enterprise trust
- Clean package separation and well-defined interfaces
- Multi-tenant isolation maps to starter/growth/enterprise pricing
- Sound agent work lifecycle (poll → triage → claim → code → PR → review → gate)

### What's Premature for Launch
- 20-stage enhancement pipeline (most stages are heuristic stubs)
- Management models (Spotify/SAFe/Team Topologies) — no customer has asked
- AI Insurance — interesting concept, premature
- Authority decay — solve trust with simpler mechanisms first
- Multi-provider model routing — Claude is the product; don't dilute focus

## Three-Phase Plan

### Phase 1: Make the Core Loop Bulletproof

**Goal:** One tenant, one vertical, one agent reliably delivering DWIs on a real project.

| Priority | Work Item | Why |
|----------|-----------|-----|
| P0 | Harden PollLoop with retry logic for transient ADO/git failures | One bad HTTP call shouldn't crash the agent |
| P0 | Fix ClaudeCodeExecutor: OOM handling, graceful timeout, "I'm stuck" detection | Burns turns and budget without these |
| P0 | Build feedback loop: capture CI errors + review comments → feed into next attempt | Single most impactful feature for code quality |
| P1 | Integration test the full lifecycle with mocked ADO responses | Prove the loop works end-to-end without live infra |
| P1 | Deploy one instance against a real project (dogfood) | Nothing reveals bugs like production |
| P2 | Structured logging at every state transition in the PollLoop | Debugging blind without this |

### Phase 2: Multi-Tenant + Billing

**Goal:** Two tenants running simultaneously, one producing real invoices.

| Priority | Work Item | Why |
|----------|-----------|-----|
| P0 | Wire Stripe end-to-end: signup → metered billing → invoice | Can't charge customers without it |
| P0 | Harden tenant isolation: multi-tenant integration tests | Verify tenant A can't see tenant B's data |
| P1 | Connect dashboard to tenant-manager API with auth | Dashboard is currently a static shell |
| P1 | Telegram approval flow: Jarvis → human approve/reject → agent merges | Human-in-the-loop is a selling point |
| P2 | Prometheus metrics + Grafana dashboards | Need operational visibility before onboarding customers |

### Phase 3: Scale + Differentiate

**Goal:** Ready for 5-10 paying customers, including AINEFF.

| Priority | Work Item | Why |
|----------|-----------|-----|
| P0 | GitHub SCM adapter end-to-end testing | Doubles addressable market |
| P0 | Agent memory (PARA) enabled across sessions | Agents that learn your codebase = competitive advantage |
| P1 | Enable security scanner + confidence scorer stages | High-value, low-risk enhancement stages |
| P1 | Jarvis task decomposer + smart work assignment | Match complexity to agent track record |
| P2 | Tenant onboarding automation: OAuth + one-click provisioning | Signup to first DWI under 30 minutes |
| P2 | AINEFF-specific vertical configuration | 43 systems across 6 clusters need organized decomposition |

## Explicitly Deferred

These features are scaffolded but will **not** be activated until post-launch data justifies them:

- Management models (Spotify/SAFe/Team Topologies)
- AI Insurance policies
- Authority decay mechanism
- Multi-provider model routing (keep Claude-only)
- Full 20-stage enhancement pipeline (enable 2-3 stages max)
- Dedicated-cluster tier (Terraform pipeline)

## Success Metrics

| Metric | Phase 1 Target | Phase 3 Target |
|--------|---------------|----------------|
| DWI success rate | >60% | >80% |
| Mean time to DWI | Under 4 hours | Under 2 hours |
| Agent uptime | >95% | >99% |
| CI-pass rate on agent PRs | >70% | >90% |
| Cost per DWI (internal) | Under $15 | Under $8 |
