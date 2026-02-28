# The Anti-Token Manifesto
## Why Selling Tokens Is a Crime Against Value — And How to Price AI Developers by What They Deliver

---

## The Sin of Selling Tokens

When you sell tokens, you are doing something profoundly stupid.

You're a construction company telling a client: "We don't charge for the house. We charge per brick. Also per nail. And we meter the electricity the power tools used. And we bill for every swing of the hammer. Your invoice this month is 847,293 bricks."

The client doesn't want bricks. They want a house.

When Devin sells "Agent Compute Units" at $2.25 each and tells you 1 ACU is about 15 minutes of "active work," they're selling you the AI equivalent of buying a car by the number of engine revolutions. Nobody walks into a dealership and says, "I'd like 4.7 million RPMs, please."

Token pricing is the vendor saying: "I don't know what my product is worth to you, so I'm going to charge you for what it costs me." That's not a business model. That's a confession of ignorance.

Here's what token/compute pricing actually communicates to your customer:

- "We don't understand your problem well enough to price the solution"
- "We can't predict our own costs, so we're passing that uncertainty to you"
- "Our value to you is unknowable, so pay us for electricity instead"
- "We're a utility, not a partner"

You're building something that writes code, ships features, closes bugs, and delivers working software. And you want to charge people for... the API calls it took to think? That's like charging a surgeon per heartbeat during your operation instead of for saving your life.

**Stop. Selling. Tokens.**

---

## The Hierarchy of Pricing Shame

Let's rank pricing models from most embarrassing to most powerful:

```
LEVEL 0: TOKENS / COMPUTE UNITS (The Basement)
"Pay us for the electricity our servers consumed"
→ You are a commodity. A utility. A dumb pipe.
→ Race to zero. Margins collapse. No loyalty.
→ Customer has ZERO visibility into what they got.

LEVEL 1: TIME-BASED (The Parking Meter)
"Pay us per hour of AI work"
→ Slightly less embarrassing but still backwards.
→ A slow agent makes you more money than a fast one.
→ Incentive misalignment: you profit from inefficiency.
→ Customer still asking "but what did I GET?"

LEVEL 2: SEAT / AGENT PRICING (The Rental Car)
"Pay per AI developer per month"
→ Better. Customer thinks in headcount.
→ But still input-based: paying for access, not results.
→ Unused agents = shelfware = churn risk.

LEVEL 3: TASK-BASED (The Mechanic)
"Pay per bug fixed, per PR merged, per feature built"
→ Now we're talking. Customer pays for work done.
→ But who defines a "task"? Scoping disputes.
→ A 5-line bug fix costs the same as a 500-line one?

LEVEL 4: OUTCOME-BASED (The Doctor)
"Pay when the patient lives"
→ Powerful. Total alignment.
→ But hard to attribute. What if the human helped?
→ Requires trust and measurement infrastructure.

LEVEL 5: VALUE-BASED (The Partner)  ← YOU ARE HERE
"Pay a percentage of the value we create for you"
→ God tier. You are a growth partner, not a vendor.
→ Customer succeeds = you succeed.
→ Infinite upside. Maximum alignment.
→ Hardest to implement. Worth it.
```

**Your competitors are on Level 0 and 1. Most are afraid to even attempt Level 3. You're going straight to Level 4/5.**

---

## The Value Framework: What You Actually Sell

You don't sell AI developers. You sell these four things:

### 1. SHIPPED CODE
Working software that passes tests, gets reviewed, and merges to main. Not tokens consumed. Not compute hours. The pull request that closes the work item.

**Measurable unit: Merged PR that passes CI/CD.**

### 2. VELOCITY
How fast a customer's backlog shrinks. How quickly features go from "To Do" to "Done." The time from work item creation to PR merged.

**Measurable unit: Average cycle time from work item → merged PR.**

### 3. DEVELOPER ECONOMICS
The cost to deliver a feature compared to what a human team would cost. If a 40-hour human task gets done in 2 hours of AI time for $15 instead of $4,000 — that's a 99.6% cost reduction.

**Measurable unit: Cost per story point vs. human baseline.**

### 4. CAPACITY
The ability to run 10 projects simultaneously, 24/7, without hiring. The customer's engineering capacity becomes elastic and infinite.

**Measurable unit: Concurrent work streams active.**

---

## The Pricing Model: "Pay for What Ships"

### The Core Unit: The Delivered Work Item (DWI)

A DWI is a completed, reviewed, merged piece of work that closes an Azure DevOps work item. It is the atomic unit of value in your business.

A DWI is NOT:
- An API call
- A token
- A compute minute
- A "session"

A DWI IS:
- A bug fix with a merged PR ✓
- A feature implementation with tests and a merged PR ✓
- A code refactor with a merged PR ✓
- A migration task with a merged PR ✓
- A code review completed on someone else's PR ✓
- A research deliverable (document attached to work item) ✓

**The customer sees: "I submitted 47 work items this month. 43 were completed and merged. I paid for 43."**

They never see tokens. They never see compute. They see results.

### Pricing Tiers by Complexity

Not all work items are equal. A one-line typo fix is not the same as building an authentication system. Your AI agents already know this — they estimate complexity when they evaluate work items.

| Complexity | Description | Price per DWI | Human Equivalent Cost |
|-----------|-------------|--------------|---------------------|
| **XS** | Typo fix, config change, dependency update | $5 | $50–100 (30 min dev time) |
| **S** | Bug fix, small refactor, add a test | $15 | $200–400 (2–4 hr dev time) |
| **M** | Feature implementation, API endpoint, UI component | $50 | $800–2,000 (1–2 day dev time) |
| **L** | Multi-file feature, integration, migration | $150 | $2,000–5,000 (3–5 day dev time) |
| **XL** | Architecture change, full module, complex system | $500 | $5,000–15,000 (1–2 week dev time) |

**The pitch:** "A medium feature costs you $50 with us. It would cost you $800–2,000 with a human developer. That's 95% savings. And we deliver it overnight while your team sleeps."

### Who Determines Complexity?

The AI agent estimates complexity when it claims a work item, based on:
- Number of files likely affected
- Codebase analysis (how tangled is the code?)
- Test coverage requirements
- Integration surface area

The customer sees the estimated complexity BEFORE the work begins and can approve or dispute it. This eliminates surprises. Transparency builds trust.

If the agent underestimates and the work turns out harder? That's your problem, not the customer's. You eat the cost. This forces your agents to get better at estimation — which makes your product better over time.

---

## The Product Plans (Value-First)

### Plan 1: Sprint Pack
**"Buy a sprint, not a subscription."**

| Pack | What You Get | Price | $/DWI Effective |
|------|-------------|-------|-----------------|
| **Starter Sprint** | 20 DWIs (any complexity mix) | $299 | ~$15/DWI |
| **Growth Sprint** | 100 DWIs | $999 | ~$10/DWI |
| **Scale Sprint** | 500 DWIs | $3,499 | ~$7/DWI |

The customer buys a pack. They submit work items. Agents deliver. DWIs get deducted based on actual complexity. Unused DWIs roll over for 90 days. No subscription lock-in. No metering surprises.

**Why this works:** It feels like hiring a contractor for a project. "I need 100 things built. Here's my money. Go." Clean, simple, value-aligned.

### Plan 2: Retainer (Monthly Managed Team)
**"Your AI dev team, always on."**

| Plan | Team Size | Monthly DWI Allowance | Price/mo | Overage |
|------|----------|----------------------|----------|---------|
| **Startup** | 1 Jarvis + 3 agents | Up to 50 DWIs | $799/mo | $12/DWI |
| **Growth** | 1 Jarvis + 8 agents | Up to 200 DWIs | $2,499/mo | $10/DWI |
| **Enterprise** | Multi-Jarvis + 20+ agents | Up to 1,000 DWIs | $9,999/mo | $8/DWI |

The customer gets a dedicated team that works their backlog continuously. They pay a flat monthly fee for a guaranteed capacity. If they go over, they pay per DWI at a discounted rate.

**Why this works:** Predictable budget for the customer. Recurring revenue for you. The team learns their codebase over time, getting faster and better (improving YOUR margins while keeping THEIR price constant).

### Plan 3: Revenue Share (God Tier)
**"We build it. We share in the upside."**

For startups building new products or features where you can track revenue impact:

- **$0 upfront** (or minimal base fee)
- **5–15% of revenue** generated by the features your AI team built
- **Capped** at a maximum monthly amount (so the customer doesn't feel exploited at scale)

**Example:** Your AI team builds a new pricing page, checkout flow, and onboarding sequence for a SaaS. The customer's conversion rate goes from 2% to 4%. Your team built the code. You get 10% of the incremental revenue for 12 months.

**Why this works:** Total alignment. You only make money if the customer makes money. It's venture capital logic applied to software development.

**When to offer this:** Only for customers where the delivered code has measurable revenue impact AND you trust the attribution.

---

## How to Measure and Prove Value (The Dashboard)

The customer dashboard never shows tokens. It shows:

### The Value Dashboard

```
┌────────────────────────────────────────────────────────┐
│  YOUR AI DEVELOPMENT TEAM — February 2026              │
├────────────────────────────────────────────────────────┤
│                                                        │
│  WORK ITEMS DELIVERED          47 / 52 submitted       │
│  ████████████████████████████░░  90% completion rate    │
│                                                        │
│  PULL REQUESTS MERGED          43                      │
│  AVERAGE CYCLE TIME            4.2 hours               │
│  (human baseline: 3.5 days)    ↑ 20x faster            │
│                                                        │
│  COST THIS MONTH               $2,100                  │
│  HUMAN EQUIVALENT COST         $38,400                 │
│  ─────────────────────────────────────────────────────  │
│  YOU SAVED                     $36,300  (94.5%)        │
│                                                        │
│  LINES OF CODE SHIPPED         12,847                  │
│  TEST COVERAGE ADDED           +8.3%                   │
│  BUGS FOUND BY AI REVIEW       7                       │
│                                                        │
│  TOP AGENTS THIS MONTH:                                │
│  🏆 Friday (Backend Dev)    — 18 DWIs                  │
│  🥈 Shuri (Research)        — 12 DWIs                  │
│  🥉 Vision (Frontend)       — 9 DWIs                  │
│                                                        │
│  [View All Work Items]  [Download Report]              │
└────────────────────────────────────────────────────────┘
```

**Notice what's NOT on this dashboard:**
- ❌ Tokens consumed
- ❌ API calls made
- ❌ Compute hours
- ❌ Agent Work Units
- ❌ Anything the customer can't connect to business value

Every number on this dashboard is something the customer can take to their CEO and say: "This is what our AI team did this month."

---

## The Sales Conversation

### Old Way (Token Seller)

> **Customer:** "How much does it cost?"
> **You:** "It depends on your token usage. Each Agent Compute Unit is $2.25, which represents approximately 15 minutes of active agent work. Complex tasks consume more tokens due to multi-turn reasoning chains and—"
> **Customer:** *glazes over* "So... what would a bug fix cost me?"
> **You:** "Well, it depends on the number of turns, the context window size, the model used—"
> **Customer:** "I'll just hire a freelancer."

### New Way (Value Seller)

> **Customer:** "How much does it cost?"
> **You:** "A bug fix is $15. A feature is $50. What's in your backlog right now?"
> **Customer:** "We've got about 40 items. Mix of bugs and small features."
> **You:** "That's roughly $1,200 worth of work. A freelance dev would charge you $8,000–12,000 for the same backlog and take 3–4 weeks. Our team will clear it in 3–4 days. Want to try 20 items for $299?"
> **Customer:** "Done."

The second conversation takes 30 seconds. The first one loses the deal.

---

## The Anti-Token Guarantee

Put this on your website. Mean it.

```
┌──────────────────────────────────────────────────┐
│                                                  │
│  THE VALUE GUARANTEE                             │
│                                                  │
│  We will NEVER charge you for:                   │
│  ✗ Tokens consumed                               │
│  ✗ API calls made                                │
│  ✗ Compute hours used                            │
│  ✗ How long our agents "thought"                 │
│  ✗ How many times they retried                   │
│  ✗ How much electricity our servers consumed     │
│                                                  │
│  We ONLY charge you for:                         │
│  ✓ Working code that merged to your repo         │
│  ✓ Tests that pass                               │
│  ✓ Work items that moved to "Done"               │
│  ✓ Value you can see, measure, and ship          │
│                                                  │
│  If our agents spin their wheels for 6 hours     │
│  on a bug fix? That's our problem, not yours.    │
│  You pay $15 for the fix. Period.                │
│                                                  │
│  We eat our own compute costs because we         │
│  believe in what we deliver, not what we burn.   │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## Why This Model Is Competitively Devastating

### Against Devin ($2.25/ACU)

Devin sells Agent Compute Units. 1 ACU ≈ 15 minutes of work. A customer has no idea how many ACUs a task will take until it's done. A simple frontend fix might take 1 ACU ($2.25) or 15 ACUs ($33.75). The customer is gambling every time they hit "start."

You sell outcomes. A frontend fix is $15. Done. No gambling. No surprises. No anxiety.

**Your customer knows the price before the work starts. Devin's customer finds out after.**

### Against Offshore Dev Shops ($25–85/hr)

Offshore shops sell hours. Slow developers make them more money. The incentive is to stretch work, not finish it. A task estimated at 8 hours somehow takes 20. The project manager shrugs.

You sell delivered work items. Your agents are incentivized to finish FAST because your margin improves when they're efficient. The faster your agents work, the more money you make per DWI. The customer gets faster delivery AND you get better margins. Everyone wins.

**Your incentives are aligned with the customer. Offshore shops' incentives are aligned against them.**

### Against Internal Hiring ($150K+/yr)

A full-time developer costs $150K+ in salary, plus benefits, equipment, office space, management overhead, onboarding time, and the risk that they leave in 18 months. All of that before they write a single line of code.

You charge for shipped code. No salary. No benefits. No PTO. No notice period. No onboarding. No "cultural fit" interviews. No recruiter fees (typically 20–25% of first-year salary).

**You turn a $150K/yr fixed cost into a $1,000–3,000/mo variable cost that scales up and down with the business.**

---

## How to Handle "But What If Costs Are Unpredictable?"

The #1 objection to outcome-based pricing is internal: "What if a customer submits a monster task and our agents burn $200 in API costs but we only charge $50?"

The answer is: **portfolio math.**

Some tasks will be wildly profitable ($15 bug fix that takes 2 API calls = $0.10 cost, 99% margin). Some tasks will be unprofitable ($50 feature that takes 200 turns = $80 cost, -60% margin). Over a portfolio of hundreds of DWIs per month across all customers, the math works out.

This is how insurance companies work. This is how restaurants work (some dishes lose money, the portfolio makes money). This is how law firms work (some cases settle fast, some drag on).

**Your job is to manage the portfolio, not optimize individual transactions.**

Practical safeguards:

1. **Complexity tiers with caps.** An XS task is capped at $5 no matter what. If your agent burns $50 in API calls on an XS task, that's a bug in your agent — fix the agent, don't punish the customer.

2. **Right to reclassify.** If a task labeled "S" turns out to be genuinely "L" complexity, the agent can request reclassification BEFORE starting work. The customer approves the new tier.

3. **Scope limits per tier.** An "M" task affects up to 5 files and adds up to 200 lines. If the scope exceeds that, it auto-escalates to "L."

4. **Kill switch.** If an agent has been working for 30 minutes on an "S" task without progress, it stops, reports the blocker, and escalates. You don't let agents spiral.

5. **Continuous improvement.** Every unprofitable DWI is a learning signal. Retrain. Improve prompts. Add skills. Over time, your cost per DWI drops while your price stays the same. Your margins GROW with scale.

---

## The Flywheel Effect

```
Customer submits work items
        │
        ▼
Agents deliver → Customer pays per DWI
        │
        ▼
You learn which tasks cost you the most
        │
        ▼
You improve agents (skills, prompts, MCP servers)
        │
        ▼
Cost per DWI drops → Your margins increase
        │
        ▼
You can lower prices OR expand capacity → More customers
        │
        ▼
More data → Better agents → Lower costs → Higher margins
        │
        ▼
(REPEAT — this is a compounding advantage)
```

Token sellers don't have this flywheel. When they make agents more efficient, they LOSE revenue (fewer tokens consumed = less money). Their incentive is to keep agents inefficient. That's perverse.

Your incentive is to make agents as efficient as possible because your price is fixed per outcome but your cost drops with efficiency. **You profit from innovation. They profit from waste.**

---

## Revenue Projections (Value Model)

| Scenario | Customers | Avg DWIs/mo | Avg Revenue/Customer | MRR | ARR |
|---------|-----------|-------------|---------------------|-----|-----|
| **Month 6** | 30 | 40 | $600 | $18K | $216K |
| **Month 12** | 150 | 80 | $1,200 | $180K | $2.2M |
| **Month 18** | 500 | 120 | $1,800 | $900K | $10.8M |
| **Month 24** | 1,000 | 150 | $2,200 | $2.2M | $26.4M |

As your agents improve, your COGS per DWI drops from ~$20 average to ~$5, while your average selling price stays at $15–20. Your gross margin goes from 40% to 75% without raising prices.

**That's the beauty of value pricing: efficiency improvements flow to YOUR bottom line, not to price reductions.**

---

## The 10 Commandments of Value Pricing

1. **Thou shalt never show a customer a token count.** Tokens are your COGS. COGS are your business. The customer sees results.

2. **Thou shalt never charge for failed work.** If the agent couldn't do it, the customer pays nothing. If the PR doesn't merge, it doesn't count.

3. **Thou shalt price before work begins.** The customer knows the cost before the agent starts. No surprises. No anxiety.

4. **Thou shalt eat thine own inefficiency.** If your agent took 500 turns to fix a bug, that's your problem. Improve the agent. Don't bill the customer.

5. **Thou shalt always show the human equivalent cost.** Every invoice shows what the work would have cost with human developers. The savings are always visible.

6. **Thou shalt align incentives with the customer.** You make more money when your agents are fast and efficient. The customer gets faster delivery. Everyone wins.

7. **Thou shalt never sell access.** You sell outcomes. The platform, the agents, the infrastructure — those are your tools. The customer buys the house, not the hammers.

8. **Thou shalt guarantee quality.** If the code doesn't pass tests, if the review finds critical issues, if the work item isn't properly closed — it doesn't count as a DWI.

9. **Thou shalt compound thine advantage.** Every completed DWI makes your agents smarter, your skills better, your costs lower. You get stronger with every customer.

10. **Thou shalt make token sellers feel embarrassed.** When a competitor says "we charge $2.25 per Agent Compute Unit," the customer should laugh. "My other vendor just charges $15 per bug fix. I know what I'm paying for."

---

## Implementation: How to Track DWIs

Your agents already create work items and merge PRs via Azure DevOps. Tracking DWIs is straightforward:

```
DWI = 1 when ALL of these are true:
  ✓ Azure DevOps work item exists
  ✓ Work item has a linked PR
  ✓ PR passes CI/CD pipeline
  ✓ PR has at least 1 approval (human or review agent)
  ✓ PR is merged to target branch
  ✓ Work item state transitions to "Done" or "Closed"

DWI = 0 when ANY of these are true:
  ✗ PR is abandoned or rejected
  ✗ CI/CD fails and is not resolved
  ✗ Work item is cancelled by customer
  ✗ Agent could not complete the task (escalated)
```

This is binary. Either it shipped or it didn't. No ambiguity. No metering complexity. No token counting infrastructure.

**Your billing system is literally: count the merged PRs linked to work items. Send invoice.**
