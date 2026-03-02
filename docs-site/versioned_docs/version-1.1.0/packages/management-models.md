---
sidebar_position: 13
title: "@agentcoders/management-models"
---

# @agentcoders/management-models

Organizational topology models for structuring AI agent teams. Implements 7 primary models with a unified interface, plus an extended catalog covering 12+ additional frameworks. All models reduce to 10 configurable axes.

**Entry point:** `dist/model-interface.js`
**Source files:** 15

## Core Interface

### ManagementModel (`model-interface.ts`)

All models implement a common interface:

```typescript
interface ManagementModel {
  type: ManagementModelType;
  configureTopology(config: TopologyConfig): void;
  assignWork(workItem: WorkItem): void;
  getGroups(): Group[];
  reportMetrics(): ModelMetrics;
}
```

**Available model types:** `spotify`, `safe`, `scrum-at-scale`, `team-topologies`, `less`, `dora`, `kanban-enterprise`

### ModelSelector (`model-selector.ts`)

Selects and instantiates the appropriate management model based on tenant configuration:

- Reads `managementConfigs` table for tenant's chosen model
- Instantiates the correct model class
- Supports runtime model switching

### TopologyEngine (`topology-engine.ts`)

Orchestrates model operations:

- Manages group creation and agent assignment
- Coordinates cross-group work distribution
- Reports aggregate metrics across all groups

---

## The 10 Core Axes

Every organizational model is a different setting on the same 10 dials. Understanding the axes lets you configure any model — or create hybrids.

| # | Axis | Low Setting | High Setting |
|---|------|-------------|--------------|
| 1 | **Autonomy** | Central command decides | Teams self-organize |
| 2 | **Cadence** | Continuous flow | Fixed time-boxes (sprints, PIs) |
| 3 | **Hierarchy depth** | Flat (2 layers) | Deep (5+ layers) |
| 4 | **Specialization** | Generalist teams | Typed teams (platform, enabling) |
| 5 | **Coupling** | Tight cross-team dependencies | Loose, API-boundary coupling |
| 6 | **Measurement focus** | Output metrics (velocity, story points) | Outcome metrics (DORA, business KPIs) |
| 7 | **Planning horizon** | Sprint-level (2 weeks) | Portfolio-level (quarters, horizons) |
| 8 | **Change tolerance** | Stable, change-averse | Continuous experimentation |
| 9 | **Governance weight** | Lightweight (team decides) | Heavy (stage gates, approval chains) |
| 10 | **Feedback loop speed** | Slow (quarterly reviews) | Fast (real-time telemetry) |

```mermaid
graph TD
    Q1{How many agents?} -->|"< 20"| Q2{Need compliance?}
    Q1 -->|"20-100"| Q3{Org has existing framework?}
    Q1 -->|"100+"| Q4{Priority?}

    Q2 -->|No| RK[Kanban Enterprise]
    Q2 -->|Yes| RT[Team Topologies]

    Q3 -->|SAFe culture| RS[SAFe]
    Q3 -->|Scrum culture| RSS[Scrum@Scale]
    Q3 -->|No framework| RSP[Spotify Model]

    Q4 -->|Speed| RL[LeSS]
    Q4 -->|Quality| RD[DORA/DevOps]
    Q4 -->|Both| RSF[SAFe + DORA hybrid]
```

---

## Model Selection Diagnostic

Answer these 5 questions to identify the right model for an enterprise:

**1. What's the agent fleet size?**
- Under 20 → Kanban Enterprise or Team Topologies
- 20-100 → Spotify, Scrum@Scale, or SAFe
- 100+ → SAFe, LeSS, or DORA

**2. Does the enterprise operate in a regulated industry?**
- Yes → SAFe (traceability), Team Topologies (clear ownership), or DORA (change failure rate tracking)
- No → Spotify (speed), Kanban (flow)

**3. What failure mode can they tolerate?**
- Drift/inconsistency → SAFe or Scrum@Scale (synchronization)
- Rigidity/slowness → Spotify or Kanban (autonomy)
- Quality variance → DORA (measurement-driven)

**4. How mature is their current process?**
- No process → Start with Kanban (lowest ceremony)
- Basic agile → Spotify or Scrum@Scale
- Mature agile → SAFe, Team Topologies, or DORA

**5. What's the primary coordination challenge?**
- Too many dependencies → Team Topologies (reduce cognitive load)
- Too slow to deliver → Kanban or DORA (optimize flow)
- No visibility → SAFe (PI planning) or DORA (metrics)

---

## Primary Models

### 1. Spotify Model (`spotify/`)

Spotify's Squad/Tribe/Chapter/Guild model adapted for AI agents.

**What it actually does:** Creates autonomous squads aligned to missions, grouped into tribes by domain. Chapters provide cross-squad functional consistency. Guilds enable voluntary knowledge sharing.

**Risk profile:** Drift risk — squads can diverge in practices without strong chapter governance. Works best when agents have high autonomy and clear mission boundaries.

**Agent topology:** Each squad = 3-7 agents with mixed roles (product-owner, developer, tester). Tribes = 3-5 squads sharing a domain.

**Use when:** The enterprise values speed and innovation over process consistency. Teams are skilled enough to self-organize.

#### Squad (`spotify/squad.ts`)

Autonomous team aligned to a mission:
- Configurable squad size (default configurable per tenant)
- Round-robin work assignment within the squad
- Role assignment: `product-owner`, `developer`, `tester`
- Each squad owns a vertical (frontend, backend, etc.)

#### Tribe (`spotify/tribe.ts`)

Collection of related squads:
- Groups squads by domain area
- Cross-squad coordination for large features
- Tribe-level metrics aggregation

#### Chapter (`spotify/chapter.ts`)

Functional guild spanning squads:
- Groups agents by role across squads (e.g., all reviewers)
- Enables skill sharing and consistency
- Chapter leads for standards enforcement

#### Guild (`spotify/guild.ts`)

Cross-squad communities of interest:
- Voluntary communities for knowledge sharing
- Cross-cutting concerns (security, performance, accessibility)
- No direct work assignment — advisory role

---

### 2. SAFe Model (`safe/`)

Scaled Agile Framework adapted for AI agent teams.

**What it actually does:** Synchronizes large agent fleets through cadence-based planning (Program Increments). Provides traceability from strategy to execution through Agile Release Trains.

**Risk profile:** Rigidity risk — heavy ceremony overhead can slow small teams. Coordination cost is high but justified at scale. Best for enterprises that need auditability and cross-team alignment.

**Agent topology:** ARTs of 50-125 agents, divided into teams of 5-10. Solution Trains for 500+ agents across multiple ARTs.

**Use when:** The enterprise is large (100+ agents), regulated, and needs portfolio-level visibility into AI work.

#### Agile Release Train (`safe/art.ts`)

Long-lived team-of-teams:
- Coordinates multiple agent squads
- Manages shared dependencies and integration
- Train-level planning and tracking

#### PI Planning (`safe/pi-planning.ts`)

Program Increment planning for coordinated delivery:
- Identifies cross-team dependencies
- Plans work across multiple sprints
- Tracks PI objectives and progress
- Supports feature-level planning with agent assignments

---

### 3. Scrum@Scale (`scrum-at-scale/`)

Recursive Scrum hierarchy for scaling without losing agility.

**What it actually does:** Replicates the Scrum pattern at every level — teams have Scrum Masters, groups of teams have a Scrum of Scrums, groups of groups have a Scrum of Scrum of Scrums. Lightweight coordination through daily scaled standups.

**Risk profile:** Coordination fragility — relies heavily on Scrum Master quality at each level. If any level's SM fails, cascading communication breakdown.

**Agent topology:** Base teams of 5-9 agents. MetaScrum groups of 3-5 teams. Executive MetaScrum for portfolio alignment.

**Use when:** The enterprise already uses Scrum and wants to scale it without adopting a heavy framework like SAFe.

#### ScaledScrumTeam (`scrum-at-scale/scaled-team.ts`)

Base execution unit:
- Standard Scrum roles: Product Owner, Scrum Master, Developers
- Sprint-based execution with configurable sprint length
- Definition of Done enforced per team

#### ScrumOfScrums (`scrum-at-scale/scrum-of-scrums.ts`)

Cross-team coordination layer:
- Daily scaled standup aggregating team blockers
- Dependency resolution across teams
- Shared backlog for cross-cutting work items

---

### 4. Team Topologies (`team-topologies/`)

Team Topologies patterns for AI agent organization.

**What it actually does:** Classifies teams into 4 types (stream-aligned, platform, enabling, complicated-subsystem) and defines 3 interaction modes (collaboration, X-as-a-Service, facilitating). Reduces cognitive load by making team boundaries explicit.

**Risk profile:** Classification rigidity — teams may resist being typed. Requires periodic re-evaluation as the system evolves.

**Agent topology:** Stream-aligned teams of 5-9 agents per value stream. Platform teams providing shared services. Enabling teams for temporary capability injection.

**Use when:** The enterprise has dependency problems. Teams step on each other, cognitive load is high, and nobody knows who owns what.

#### Stream-Aligned Team (`team-topologies/stream-aligned.ts`)

Primary value delivery teams:
- Aligned to a flow of work (feature stream)
- End-to-end ownership of their stream
- Minimize external dependencies

#### Platform Team (`team-topologies/platform-team.ts`)

Internal service providers:
- Provide shared capabilities to stream-aligned teams
- Self-service APIs and tooling
- Reduce cognitive load on stream teams

#### Enabling Team (`team-topologies/enabling-team.ts`)

Capability enablers:
- Help other teams adopt new technologies or practices
- Temporary engagement — upskill then move on
- Bridge knowledge gaps across the organization

---

### 5. LeSS — Large-Scale Scrum (`less/`)

Minimalist scaling. One Product Owner, one backlog, multiple teams.

**What it actually does:** Removes as much coordination overhead as possible. All teams work from a single prioritized backlog. No dedicated roles beyond standard Scrum. Cross-team coordination happens through shared Sprint Reviews and Overall Retrospectives.

**Risk profile:** Product Owner bottleneck — one person becomes the decision chokepoint. Works only when the PO is highly available and decisive.

**Agent topology:** 2-8 teams of 5-9 agents, all pulling from one backlog. No middle management layer.

**Use when:** The enterprise wants to scale without adding process layers. Best for products (not projects) with a clear single owner.

#### LessTeam (`less/less-team.ts`)

Standard Scrum team pulling from shared backlog:
- No team-specific backlogs — all teams share one
- Cross-team Sprint Planning (Part 1 together, Part 2 separate)
- Multi-team Sprint Review for integration feedback

#### SharedBacklog (`less/shared-backlog.ts`)

Single prioritized work queue:
- Product Owner maintains priority order
- Teams self-select work items based on skills and capacity
- Prevents duplicate work through real-time claiming

---

### 6. DORA / DevOps Model (`dora/`)

Measurement-driven operational excellence through the 4 DORA metrics.

**What it actually does:** Organizes teams around optimizing four key metrics: deployment frequency, lead time for changes, mean time to recovery (MTTR), and change failure rate. Everything — team structure, tooling, process — serves metric improvement.

**Risk profile:** Metric gaming — teams optimize for the metric rather than the outcome. Requires pairing DORA metrics with quality gates and business outcome tracking.

**Agent topology:** Cross-functional teams owning the full pipeline (build, test, deploy, monitor). No handoff-heavy org charts.

**Use when:** The enterprise cares about delivery speed and reliability. Already has CI/CD and wants to optimize it systematically.

#### DoraTeam (`dora/dora-team.ts`)

Full-lifecycle ownership team:
- Owns code, pipeline, deployment, and monitoring
- Measured on 4 DORA metrics continuously
- Automates everything that slows lead time

#### MetricsCollector (`dora/metrics-collector.ts`)

Real-time DORA metric aggregation:

| Metric | Measurement | Elite Target |
|--------|-------------|--------------|
| Deployment Frequency | Deploys per day | Multiple per day |
| Lead Time | Commit to production | Less than 1 hour |
| MTTR | Incident to recovery | Less than 1 hour |
| Change Failure Rate | Failed deployments / total | Less than 5% |

---

### 7. Kanban Enterprise (`kanban/`)

Flow-based work management with WIP limits and value stream optimization.

**What it actually does:** Visualizes work as a flow through stages (backlog, in-progress, review, done). WIP limits prevent overload. No sprints, no ceremonies beyond daily standups and periodic reviews. Work is pulled, never pushed.

**Risk profile:** Drift risk — without time-boxes, work can stagnate. Requires strong WIP limit discipline and regular flow reviews.

**Agent topology:** Flexible team sizes aligned to value streams. Agents pull work based on capacity. No fixed roles — agents move between stages as needed.

**Use when:** The enterprise wants minimal ceremony. Work arrives continuously (support, maintenance, ops) rather than in planned batches.

#### KanbanBoard (`kanban/kanban-board.ts`)

Visual work management:
- Configurable columns per tenant workflow
- WIP limits per column (enforced, not advisory)
- Swimlanes for priority or work type separation

#### FlowMetrics (`kanban/flow-metrics.ts`)

Value stream analytics:

| Metric | What It Measures |
|--------|-----------------|
| Cycle Time | Time from start to completion |
| Throughput | Items completed per time period |
| WIP Age | How long items have been in progress |
| Flow Efficiency | Active time / total time in system |

---

## Extended Catalog

Beyond the 7 primary models, these frameworks are available as configuration presets. Each maps to specific axis settings rather than requiring dedicated implementation.

### Holacracy
Role-based, distributed authority. No job titles — dynamic roles assigned based on tensions. **Use when:** The enterprise wants radical decentralization. **Axes:** Max autonomy, flat hierarchy, continuous cadence.

### OKR Operating Model
Quarterly Objectives with measurable Key Results cascading from company to team to individual. **Use when:** The enterprise needs alignment between strategy and execution. **Axes:** High planning horizon, outcome-focused measurement.

### Balanced Scorecard
Four-perspective measurement: Financial, Customer, Internal Process, Learning & Growth. **Use when:** The enterprise wants holistic performance tracking beyond velocity. **Axes:** High governance weight, slow feedback loops, portfolio planning horizon.

### Lean Operating System (Toyota)
Continuous improvement (kaizen), waste elimination (muda), value stream mapping. **Use when:** The enterprise has process waste and wants to optimize flow. **Axes:** Fast feedback loops, continuous cadence, high change tolerance.

### McKinsey Three Horizons
H1 (core business), H2 (adjacent opportunities), H3 (transformational bets). **Use when:** The enterprise needs to balance maintenance of existing systems with innovation. **Axes:** Long planning horizon, mixed specialization.

### Management by Objectives (MBO)
Individual accountability contracts with measurable targets. **Use when:** The enterprise has clear, measurable goals per agent or team. **Axes:** High autonomy within targets, output-focused measurement.

### Sociocracy
Consent-based decision-making in nested circles. Decisions pass unless someone has a "paramount objection." **Use when:** The enterprise values inclusive governance over speed. **Axes:** High autonomy, flat hierarchy, heavy governance.

### RACI Governance
Responsibility clarity through Responsible/Accountable/Consulted/Informed matrices. **Use when:** The enterprise has unclear ownership and accountability gaps. **Axes:** Deep hierarchy, tight coupling, heavy governance.

### PMO Model
Centralized Project Management Office with stage gates, resource allocation, and portfolio oversight. **Use when:** The enterprise runs project-based (not product-based) work with fixed budgets and timelines. **Axes:** Deep hierarchy, heavy governance, long planning horizon.

### Business Process Reengineering (BPR)
Radical end-to-end process optimization. Not incremental improvement — fundamental redesign. **Use when:** The enterprise's current process is fundamentally broken, not just slow. **Axes:** High change tolerance, loose coupling, fast feedback loops.

### ITIL Service Model
Service lifecycle management: Incident, Problem, Change, Release, Configuration. **Use when:** The enterprise runs IT services requiring SLA compliance and formal change control. **Axes:** Heavy governance, deep hierarchy, slow cadence.

### Lean Portfolio Management
Strategy-to-epic alignment with portfolio Kanban, guardrails, and participatory budgeting. **Use when:** The enterprise needs to connect executive strategy to team-level execution across multiple value streams. **Axes:** Long planning horizon, outcome-focused measurement, moderate governance.

---

## Configuration

Per-tenant configuration stored in `managementConfigs` table:

```typescript
{
  modelType: 'spotify',          // which model to use
  axes: {                        // 10-axis configuration
    autonomy: 0.8,               // 0.0 = central command, 1.0 = full self-org
    cadence: 0.3,                // 0.0 = continuous, 1.0 = strict time-boxes
    hierarchyDepth: 0.2,         // 0.0 = flat, 1.0 = 5+ layers
    specialization: 0.5,         // 0.0 = generalist, 1.0 = typed teams
    coupling: 0.2,               // 0.0 = tight, 1.0 = loose
    measurementFocus: 0.7,       // 0.0 = output, 1.0 = outcome
    planningHorizon: 0.4,        // 0.0 = sprint, 1.0 = portfolio
    changeTolerance: 0.8,        // 0.0 = stable, 1.0 = experimental
    governanceWeight: 0.3,       // 0.0 = lightweight, 1.0 = heavy
    feedbackSpeed: 0.9,          // 0.0 = slow, 1.0 = real-time
  },
  topology: {                     // model-specific group structure
    squads: [...],
    tribes: [...]
  },
  cadence: {                      // meeting/ceremony schedule
    standup: '0 9 * * 1-5',      // cron expression
    review: '0 15 * * 5',
    planning: '0 10 * * 1'
  },
  escalationPaths: {              // who escalates to whom
    squad: 'tribe-lead',
    tribe: 'jarvis',
    timeout: 300000               // 5 minutes
  }
}
```
