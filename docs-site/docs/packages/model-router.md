---
sidebar_position: 8
title: "@agentcoders/model-router"
---

# @agentcoders/model-router

Multi-provider LLM routing engine with cost/latency optimization, health monitoring, rate limiting, and automatic fallback chains.

**Entry point:** `dist/main.js`
**Source files:** 14

## Components

### ModelRouter (`router.ts`)

Main routing orchestrator:

```typescript
interface RouteOptions {
  tenantId: string;
  agentId: string;
  prompt: string;
  strategy?: RoutingStrategy;
  preferredProvider?: ModelProvider;
  maxCostUsd?: number;
  capabilities?: string[];
}
```

Flow:
1. Receive route request with options
2. Query `ModelRegistry` for available routes matching tenant/capabilities
3. Apply `RoutingStrategyEngine` to select best route
4. Check `TokenBucketRateLimiter` for provider availability
5. Check `HealthMonitor` for provider health
6. Execute via provider, with `FallbackChainExecutor` on failure
7. Track cost via `CostCalculator`
8. Log to `modelRouteLogs` table
9. Publish routing decision to Redis

### Providers

4 provider implementations, all extending `BaseProvider`:

| Provider | Class | SDK | Key Models |
|----------|-------|-----|-----------|
| **Anthropic** | `AnthropicProvider` | `@anthropic-ai/sdk` | Claude Opus 4, Sonnet 4, Haiku 4.5 |
| **OpenAI** | `OpenAIProvider` | `openai` | GPT-4o, o1 |
| **Google** | `GoogleProvider` | `@google/generative-ai` | Gemini 2.5 Pro, Gemini Flash |
| **Ollama** | `OllamaProvider` | HTTP API | Local models (zero cost) |

`BaseProvider` abstract class:
- `generate(prompt, options)` — generate completion
- `listModels()` — list available models
- `isHealthy()` — health check

### RoutingStrategyEngine (`strategy.ts`)

4 routing strategies:

| Strategy | Selection Logic |
|----------|----------------|
| `cost-optimized` | Select cheapest model meeting capability requirements |
| `quality-optimized` | Select highest-quality model (by priority ranking) |
| `latency-optimized` | Select fastest-responding model (by historical latency) |
| `round-robin` | Distribute evenly across available models |

### FallbackChainExecutor (`fallback-chain.ts`)

Automatic failover on provider errors:

- Primary provider fails → try secondary
- Configurable `maxRetries` per provider
- Falls through priority-sorted route list
- Throws when all providers exhausted
- Logs each attempt for observability

### CostCalculator (`cost-calculator.ts`)

Built-in pricing table for 15+ models:

| Model | Input (per 1k) | Output (per 1k) |
|-------|----------------|------------------|
| Claude Opus 4 | $0.015 | $0.075 |
| Claude Sonnet 4 | $0.003 | $0.015 |
| Claude Haiku 4.5 | $0.001 | $0.005 |
| GPT-4o | $0.005 | $0.015 |
| o1 | $0.015 | $0.060 |
| Gemini 2.5 Pro | $0.00125 | $0.01 |
| Gemini Flash | $0.0001 | $0.0004 |
| Ollama (any) | $0.000 | $0.000 |

### TokenBucketRateLimiter (`rate-limiter.ts`)

Per-provider rate limiting:

- Token bucket algorithm
- Default: 60 RPM (configurable via `RATE_LIMIT_RPM`)
- Refills tokens at a steady rate
- Returns `false` when bucket empty (triggers fallback)

### HealthMonitor (`health-monitor.ts`)

Provider health tracking with auto-disable:

- Tracks consecutive failures per provider
- **Auto-disable threshold:** 5 consecutive failures
- **Cooldown period:** 60,000ms (1 minute)
- Auto-re-enables after cooldown expires
- Logs health state transitions

### ModelRegistry (`model-registry.ts`)

In-memory route storage indexed by tenant and provider:

- Loads routes from `modelRoutes` database table
- Filters by `isActive` flag and `priority` ordering
- Supports capability-based filtering
