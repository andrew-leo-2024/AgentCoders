---
sidebar_position: 9
title: BPMN Process Diagrams
---

# BPMN Process Diagrams — v1

:::info Version History
- **v1 (2026-03-01):** Initial BPMN diagrams for all core AgentCoders processes. ASCII representations suitable for agent context recovery.
:::

## Purpose

Complete BPMN 2.0 process diagrams for every major AgentCoders workflow. These diagrams serve as the canonical reference for how the platform operates — both for human operators and for agent context recovery.

---

## BPMN-001: DWI Delivery Process (End-to-End)

The master process from work item creation to invoice.

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│  POOL: AgentCoders Platform                                                  │
├──────────┬───────────┬───────────┬───────────┬───────────┬──────────────────┤
│ Tenant   │ Jarvis    │ Agent Pod │ SCM       │ Quality   │ Billing          │
│          │ CEO       │           │ (ADO/GH)  │ Gates     │ Service          │
├──────────┼───────────┼───────────┼───────────┼───────────┼──────────────────┤
│          │           │           │           │           │                  │
│ (Start)  │           │           │           │           │                  │
│ Create   │           │           │           │           │                  │
│ work item│           │           │           │           │                  │
│ + tag    │           │           │           │           │                  │
│ "agent-  │           │           │           │           │                  │
│  ready"  │           │           │           │           │                  │
│    │     │           │           │           │           │                  │
│    ▼     │           │           │           │           │                  │
│    ●────────────────►│           │           │           │                  │
│          │           │ Poll for  │           │           │                  │
│          │           │ items     │           │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ ◇ Budget  │           │           │                  │
│          │           │ check     │           │           │                  │
│          │           │ │YES  │NO │           │           │                  │
│          │           │ ▼     ▼   │           │           │                  │
│          │           │ Triage  IDLE           │           │                  │
│          │           │ (Haiku)   │           │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ Estimate  │           │           │                  │
│          │           │ complexity│           │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ Claim ────────────────►│           │                  │
│          │           │ work item │ Update    │           │                  │
│          │           │           │ state to  │           │                  │
│          │           │           │ Active    │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ Create    │           │           │                  │
│          │           │ branch    │           │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ Hydrate   │           │           │                  │
│          │           │ context   │           │           │                  │
│          │           │ (TASK.md  │           │           │                  │
│          │           │  MEMORY.md│           │           │                  │
│          │           │  skills/) │           │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ ═══════   │           │           │                  │
│          │           │ CODING    │           │           │                  │
│          │           │ (Claude   │           │           │                  │
│          │           │  Sonnet)  │           │           │                  │
│          │           │ ═══════   │           │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ◇      │           │           │                  │
│          │           │ Success?  │           │           │                  │
│          │           │ │YES │NO  │           │           │                  │
│          │           │ │    │    │           │           │                  │
│          │           │ │    ▼    │           │           │                  │
│          │    ◄──────│ Escalate  │           │           │                  │
│          │ Handle    │           │           │           │                  │
│          │ escalation│           │           │           │                  │
│          │    │      │           │           │           │                  │
│          │    ▼      │ │         │           │           │                  │
│          │ ◇ Auto-   │ │         │           │           │                  │
│          │ resolve?  │ │         │           │           │                  │
│          │ │Y  │N    │ │         │           │           │                  │
│          │ │   ▼     │ │         │           │           │                  │
│          │ │ Telegram │ │         │           │           │                  │
│          │ │ to human│ │         │           │           │                  │
│          │ │   │     │ │         │           │           │                  │
│          │ ▼   ▼     │ │         │           │           │                  │
│          │ Retry ────►│ │         │           │           │                  │
│          │           │ ▼         │           │           │                  │
│          │           │ Commit +  │           │           │                  │
│          │           │ push      │           │           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ Open PR ──────────────►│           │                  │
│          │           │           │ PR created│           │                  │
│          │           │           │    │      │           │                  │
│          │           │           │    ▼      │           │                  │
│          │           │           │ CI runs   │           │                  │
│          │           │           │    │      │           │                  │
│          │           │           │    ▼      │           │                  │
│          │           │ Review PR │◄──────────│           │                  │
│          │           │    │      │           │           │                  │
│          │           │    ▼      │           │           │                  │
│          │           │ Merge PR ─────────────►│           │                  │
│          │           │           │ Merged    │           │                  │
│          │           │           │    │      │           │                  │
│          │           │           │    ▼      │           │                  │
│          │           │           │           │ 6 quality │                  │
│          │           │           │           │ gates     │                  │
│          │           │           │           │ check     │                  │
│          │           │           │           │    │      │                  │
│          │           │           │           │    ◇      │                  │
│          │           │           │           │ All pass? │                  │
│          │           │           │           │ │YES │NO  │                  │
│          │           │           │           │ │    │    │                  │
│          │           │           │           │ │    ▼    │                  │
│          │           │           │           │ │  Revert │                  │
│          │           │           │           │ │  + not  │                  │
│          │           │           │           │ │  billable│                 │
│          │           │           │           │ ▼         │                  │
│          │           │           │           │ DWI ──────►│                  │
│          │           │           │           │ completed │ Mark billable    │
│          │           │           │           │           │ Report to Stripe │
│          │           │           │           │           │ Generate invoice │
│          │           │           │           │           │    │             │
│ ◄────────────────────────────────────────────────────────│    ▼             │
│ Invoice  │           │           │           │           │ (End)            │
│ received │           │           │           │           │                  │
└──────────┴───────────┴───────────┴───────────┴───────────┴──────────────────┘
```

---

## BPMN-002: Jarvis Task Decomposition

```text
(Start)
   │
   ▼
[Receive Epic/Feature]
   │
   ▼
[GsdPlanner.analyzeProject()]
   │
   ├── Extract markdown sections (## headers)
   │
   ▼
═══════════════════
 FOR EACH SECTION
═══════════════════
   │
   ▼
[decomposeMilestone()]
   │
   ├── Break into bullet-point tasks
   │
   ▼
═══════════════════
  FOR EACH TASK
═══════════════════
   │
   ▼
[estimateComplexity()]
   │
   ├── Keyword heuristics → tier (XS/S/M/L/XL)
   │
   ▼
◇ Confident?
│YES          │NO
▼             ▼
Use tier    [Claude Haiku fallback]
│             │
▼             ▼
[Create work item in SCM]
   │
   ├── Title, description, acceptance criteria
   ├── Complexity tag
   ├── Parent-child link to epic
   └── Tag: "agent-ready"
   │
   ▼
[Assign to vertical]
   │
   ├── Match domain to vertical (frontend/backend/etc)
   │
   ▼
[SquadManager.assignWorkItem()]
   │
   ▼
◇ Idle agent available?
│YES                    │NO
▼                       ▼
[Publish to vertical    [Queue for next
 Redis channel]          available agent]
   │                       │
   ▼                       │
(End) ◄────────────────────┘
```

---

## BPMN-003: Escalation Handling

```text
(Start)
   │
   ▼
[Agent publishes escalation to Redis]
   │
   ├── Channel: {tenantId}:vertical:escalations
   ├── Payload: type, agentId, workItemId, details
   │
   ▼
[Jarvis.handleEscalation()]
   │
   ▼
◇ Escalation type?
│                    │                   │                    │
▼                    ▼                   ▼                    ▼
merge-conflict    test-failure        timeout             budget/blocked/
│                    │                   │                 quality
▼                    ▼                   ▼                    │
[Find idle agent  [Capture test       [Upgrade tier:         ▼
 in same vertical] output]             XS→S→M→L→XL]      [Notify human
│                    │                   │                  via Telegram]
▼                    ▼                   ▼                    │
[Reassign work    [Send output as     ◇ Already XL?          │
 item to new       context to agent]  │NO          │YES      │
 agent]              │                 ▼             ▼        │
│                    ▼                [Retry with  [Notify    │
▼                  [Agent retries]    new tier]    human]     │
[New agent starts    │                   │           │        │
 on clean branch]    ▼                   ▼           │        │
│                  ◇ Retry succeed?   [Agent retries]│        │
▼                  │YES    │NO           │           │        │
[Write to            ▼      ▼            ▼           │        │
 escalations     (End)  [Notify        (End)         │        │
 table:                  human via                    ▼        │
 resolved]               Telegram]              ┌────────────┐│
│                          │                    │ Telegram:   ││
▼                          ▼                    │ Inline      ││
(End)                 ┌────────────┐            │ keyboard    ││
                      │ Telegram:  │            │ [Approve]   ││
                      │ Escalation │            │ [Reject]    ││
                      │ details +  │            │ [Defer]     ││
                      │ keyboard   │            └──────┬──────┘│
                      └─────┬──────┘                   │       │
                            │                          │       │
                            ▼                          ▼       │
                      [Human decides] ◄────────────────────────┘
                            │
                      ◇ Decision?
                      │           │            │
                      ▼           ▼            ▼
                   Approve     Reject        Defer
                      │           │            │
                      ▼           ▼            ▼
                   [Resume    [Close work   [Queue for
                    agent]     item]         later]
                      │           │            │
                      ▼           ▼            ▼
                   (End)       (End)        (End)
```

---

## BPMN-004: Quality Gate Evaluation

```text
(Start: PR Merged)
   │
   ▼
[Create DWI record: status='in_progress']
   │
   ▼
══════════════════════════════
 PARALLEL GATEWAY (all must pass)
══════════════════════════════
   │         │         │         │         │         │
   ▼         ▼         ▼         ▼         ▼         ▼
Gate 1    Gate 2    Gate 3    Gate 4    Gate 5    Gate 6
Work item PR linked CI passes PR        PR        Work item
exists    to WI              approved   merged    closed
   │         │         │         │         │         │
   ▼         ▼         ▼         ▼         ▼         ▼
══════════════════════════════
 SYNCHRONIZING GATEWAY
══════════════════════════════
   │
   ▼
◇ All 6 gates passed?
│YES                        │NO
▼                           ▼
[DWI status: 'completed']   ◇ CI failed within 30 min?
[isBillable: true]          │YES              │NO
│                           ▼                 ▼
▼                        [RevertManager:   [DWI status:
[Publish to Redis:        create revert     'failed']
 {tenantId}:dwi:           commit]          [isBillable:
 completed]                  │               false]
│                           ▼                 │
▼                        [DWI status:         │
[Stripe: report           'reverted']         │
 metered usage]          [isBillable:         │
│                         false]              │
▼                           │                 │
[Generate invoice           ▼                 │
 line item]              [Telegram:           │
│                         notify revert]      │
▼                           │                 │
(End: Billed)            (End: Not billed)  (End: Not billed)
```

---

## BPMN-005: Tenant Provisioning

```text
(Start: POST /api/tenants)
   │
   ▼
[Validate input]
   │
   ▼
◇ Slug unique?
│YES          │NO
▼             ▼
│          [Return 409 Conflict]
│             │
│             ▼
│          (End: Error)
▼
[Insert tenant record: status='provisioning']
   │
   ▼
[Return 201 with tenant ID] ──► (Caller receives response)
   │
   ▼ (async)
[TenantProvisioner.provisionTenant()]
   │
   ▼
[Generate YAML manifests]
   │
   ├── Namespace
   ├── ServiceAccount
   ├── Role + RoleBinding
   ├── NetworkPolicy
   ├── ResourceQuota
   │
   ▼
◇ Isolation tier?
│namespace          │namespace+dedicated-db    │dedicated-cluster
▼                   ▼                          ▼
[Apply base        [Apply base manifests]      [Terraform apply
 manifests only]       │                        entire cluster]
│                   ▼                             │
│                [Generate Postgres              │
│                 StatefulSet YAML]              │
│                   │                            │
│                ▼                               │
│                [Generate Redis                 │
│                 StatefulSet YAML]              │
│                   │                            │
│                ▼                               │
│                [kubectl apply -k]              │
│                   │                            │
│                ▼                               │
│                [Wait for Postgres ready]       │
│                   │                            │
│                ▼                               │
│                [Wait for Redis ready]          │
│                   │                            │
│                ▼                               │
│                [runMigrations(dbUrl)]          │
│                   │                            │
▼                   ▼                            ▼
════════════════════════════════════════════════════
                    │
                    ▼
[Update tenant status: 'active']
                    │
                    ▼
[Clean up temp directory]
                    │
                    ▼
                 (End)
```

---

## BPMN-006: Budget Enforcement

```text
(Start: Every poll tick)
   │
   ▼
[CostTracker.checkBudget()]
   │
   ▼
[Query daily spend from usage records]
   │
   ▼
◇ Daily spend vs limit?
│Under 80%     │80-99%          │100%+
▼              ▼                ▼
[Continue     [Publish          [Publish
 normal        budget-alert      budget-exceeded
 operation]    to Redis]         to Redis]
│              │                │
▼              ▼                ▼
│           [Telegram:       [Agent forced
│            "80% budget      to IDLE status]
│            consumed"]         │
│              │                ▼
│              ▼             [Telegram:
│           [Continue         "Budget exceeded,
│            but monitor]      agents paused"]
│              │                │
▼              ▼                ▼
(End:        (End:           ◇ Human action?
 Normal)      Warning)       │Increase   │Wait
                             ▼           ▼
                          [Update      [Agents remain
                           budget       IDLE until
                           quota]       next period]
                             │           │
                             ▼           ▼
                          [Resume     (End:
                           agents]     Paused)
                             │
                             ▼
                          (End:
                           Resumed)
```

---

## BPMN-007: AINEFF ORF-Wrapped Agent Execution

This specialized process extends BPMN-001 for AINEFF tenants where all operations must be ORF-wrapped.

```text
(Start: Agent claims AINEFF work item)
   │
   ▼
[Load orf-specialist skill]
   │
   ▼
[Hydrate context with AINEFF docs page URL]
   │
   ▼
═══════════════════
 CODING PHASE
═══════════════════
   │
   ▼
[Claude codes solution]
   │
   ▼
◇ Code contains ORF wrapping?
│YES                          │NO
▼                             ▼
[Continue to review]       [Agent self-corrects:
│                           add ORF envelope to
│                           all API endpoints]
│                              │
│                              ▼
│                           [Re-verify ORF
│                            compliance]
│                              │
▼                              ▼
═══════════════════════════════
 ORF COMPLIANCE CHECK
═══════════════════════════════
   │
   ├── Every API endpoint wrapped in createORFEnvelope()
   ├── Every state mutation emits audit event
   ├── Every authority check uses governance-sdk
   ├── Fail-closed: unreachable ORF returns 503
   │
   ▼
◇ ORF compliant?
│YES              │NO
▼                 ▼
[Open PR]      [Escalate to Jarvis:
│               "ORF non-compliance"]
▼                 │
[CI runs AINEFF    ▼
 pipeline which  [Jarvis retry with
 includes ORF     ORF constraint
 validation]      reinforced in prompt]
│                 │
▼                 ▼
(Continue standard DWI flow from BPMN-001)
```

---

## Process Cross-Reference

| Process ID | Name | Triggers | Outputs |
|-----------|------|----------|---------|
| BPMN-001 | DWI Delivery | Work item tagged `agent-ready` | Invoice line item |
| BPMN-002 | Task Decomposition | Epic/feature created | Atomic work items in SCM |
| BPMN-003 | Escalation Handling | Agent failure | Resolution or human notification |
| BPMN-004 | Quality Gate Evaluation | PR merged | DWI billable/not-billable status |
| BPMN-005 | Tenant Provisioning | `POST /api/tenants` | Active tenant with K8s namespace |
| BPMN-006 | Budget Enforcement | Every poll tick | Budget alerts or agent pause |
| BPMN-007 | AINEFF ORF Execution | AINEFF work item claimed | ORF-compliant code in PR |

---

## RACI Matrix

| Activity | Platform Team | Jarvis CEO | Agent Pod | Tenant | Billing |
|----------|:------------:|:----------:|:---------:|:------:|:-------:|
| Create work items | I | I | - | **R** | - |
| Decompose epics | C | **R** | - | A | - |
| Claim work items | - | I | **R** | I | - |
| Write code | - | - | **R** | - | - |
| Open PR | - | I | **R** | I | - |
| Review PR | - | C | **R** | A | - |
| Merge PR | - | I | **R** | A | - |
| Quality gate check | - | - | - | - | **R** |
| Auto-revert | - | I | - | I | **R** |
| Generate invoice | - | - | - | I | **R** |
| Handle escalation | C | **R** | I | A | - |
| Scale agents | **R** | I | - | A | - |
| Rotate secrets | **R** | - | - | C | - |

**R** = Responsible, **A** = Accountable, **C** = Consulted, **I** = Informed
