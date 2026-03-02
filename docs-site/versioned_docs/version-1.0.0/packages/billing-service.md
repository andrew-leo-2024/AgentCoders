---
sidebar_position: 5
title: "@agentcoders/billing-service"
---

# @agentcoders/billing-service

Value-based billing system built around the Delivered Work Item (DWI) model. Tracks work item lifecycle, enforces quality gates, manages budgets, records usage, generates invoices, and integrates with Stripe.

**Entry point:** `dist/dwi-tracker.js`
**Source files:** 7

## Components

### DWI Tracker (`dwi-tracker.ts`)

Main DWI lifecycle tracking service (405 lines).

**Subscribed Redis channels:**
- `{tenantId}:dwi:work-item-created` — starts DWI tracking
- `{tenantId}:pr:linked` — marks PR linked
- `{tenantId}:ci:completed` — marks CI result
- `{tenantId}:pr:approved` — marks PR approved
- `{tenantId}:pr:merged` — marks PR merged
- `{tenantId}:dwi:work-item-closed` — marks work item closed

**Published channels:**
- `{tenantId}:billing:budget-exceeded` — hard budget stop
- `{tenantId}:dwi:completed` — DWI finalized and billable

**6 Quality Gates (all must pass for billability):**

| Gate | Field | Requirement |
|------|-------|-------------|
| 1 | `workItemExists` | Work item exists in ADO/GitHub |
| 2 | `prLinked` | PR linked to work item |
| 3 | `ciPassed` | CI pipeline passes |
| 4 | `prApproved` | PR approved by reviewer |
| 5 | `prMerged` | PR merged to main |
| 6 | `workItemClosed` | Work item closed in SCM |

**DWI Status lifecycle:**
```
in_progress → pending_review → approved → merged → completed (billable)
                                                  → reverted (non-billable)
           → failed
```

### ComplexityEstimator (`complexity-estimator.ts`)

Estimates work item complexity using a two-stage approach:

**Stage 1: Keyword heuristics**

| Tier | Keywords |
|------|----------|
| XS | typo, rename, label, color, text change, bump version, update readme |
| S | add field, fix bug, validation, unit test, simple endpoint, config change |
| M | new endpoint, new component, refactor, migration, CRUD, form, api route |
| L | new service, authentication, authorization, database schema, workflow, pipeline |
| XL | architecture, microservice, real-time, event-driven, full redesign, cross-service |

Additional boosters: file count, test count, description length.

**Stage 2: Claude Haiku fallback** — for ambiguous cases where keyword matching is inconclusive, calls Claude Haiku API (`claude-haiku-4-5-20251001`) for classification.

Returns: `{ tier, priceUsd, confidence, reason }`.

### QualityGates (`quality-gates.ts`)

Post-merge quality enforcement with auto-revert:

- **Revert window:** 30 minutes after merge
- Tracks merged PRs in a time-windowed map
- Listens to `{tenantId}:ci:completed` and `{tenantId}:pr:merged`
- On CI failure within the revert window:
  1. Marks DWI as `reverted` (non-billable)
  2. Publishes revert request to `{tenantId}:agent:{agentId}:progress`
  3. Notifies via Telegram
- Periodically cleans stale merge tracking entries

### BudgetEnforcer (`budget-enforcer.ts`)

Per-tenant and per-agent spending enforcement:

| Threshold | Action |
|-----------|--------|
| **80%** of daily/monthly budget | Publishes `warning-80pct` to `{tenantId}:billing:budget-alert` |
| **100%** of daily/monthly budget | Publishes `exceeded` — agent forced to `idle` |
| Session cost limit | Publishes `session-limit` for individual costly sessions |

Aggregates spending from:
- DWI records (revenue/prices)
- Usage records (internal token costs)

### UsageRecorder (`usage-recorder.ts`)

Tracks **AWU (Active Work Unit)** — 15-minute blocks of active agent time.

:::info
AWU is for **internal cost accounting only**. It is never exposed to customers. Customers see only DWI-based value pricing.
:::

- Subscribes via `psubscribe` to `{tenantId}:agent:*:progress` pattern
- AWU tick timer runs every minute
- Flushes completed sessions to database
- **Cost:** $0.10 per 15-minute AWU block

### StripeIntegration (`stripe-integration.ts`)

Stripe API integration (SDK v2025-02-24.acacia):

| Method | Description |
|--------|-------------|
| `createCustomer(tenant)` | Creates Stripe customer for tenant |
| `createSubscription(customerId, plan)` | Creates metered subscription with usage-based billing |
| `reportDwiCompletion(dwiRecord)` | Reports metered usage (price in cents as quantity) |
| `createInvoice(tenantId, lineItems)` | Creates invoice with itemized line items |
| `processWebhook(event)` | Handles `invoice.paid`, `payment_failed`, `subscription.*` events |
| `getOrCreatePrice(plan, tier)` | Gets or creates metered Stripe prices |

### InvoiceGenerator (`invoice-generator.ts`)

Generates **value-focused** invoices emphasizing work delivered:

- Fetches completed, billable DWIs for a billing period
- Calculates savings vs human equivalent cost (base rate: **$150/hour**)

**Human equivalent hours per tier:**

| Tier | Human Hours |
|------|------------|
| XS | 0.5h |
| S | 2h |
| M | 8h |
| L | 24h |
| XL | 60h |

:::warning
Invoices **never show** tokens, AWUs, API calls, or internal metrics. Customers see only: work item titles, complexity tiers, DWI prices, and total savings.
:::

- Stores invoices in `invoices` database table
- Creates corresponding Stripe invoices
