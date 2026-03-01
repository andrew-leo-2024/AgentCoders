---
sidebar_position: 3
title: Environment Variables
---

# Environment Variables

All configuration is validated at startup via Zod schemas using `loadConfig()` from `@agentcoders/shared`.

## Base Config (all services)

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `DATABASE_URL` | string (url) | — | Yes | PostgreSQL connection string |
| `REDIS_URL` | string | `redis://localhost:6379` | No | Redis connection string |
| `LOG_LEVEL` | enum | `info` | No | `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `NODE_ENV` | enum | `development` | No | `development` / `staging` / `production` |

## Agent Runtime

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `AGENT_ID` | string | — | Yes | Unique agent identifier |
| `TENANT_ID` | uuid | — | Yes | Owning tenant |
| `AGENT_VERTICAL` | string | — | Yes | Vertical assignment (e.g., `frontend`) |
| `AGENT_NAMESPACE` | string | — | Yes | K8s namespace |
| `ADO_ORG_URL` | string (url) | — | Yes | Azure DevOps org URL |
| `ADO_PROJECT` | string | — | Yes | ADO project name |
| `ADO_PAT` | string | — | Yes | ADO personal access token |
| `ADO_REPOSITORY_ID` | string | — | No | ADO repository ID |
| `ANTHROPIC_API_KEY` | string | — | Yes | Anthropic API key |
| `CLAUDE_MODEL_CODING` | string | `claude-sonnet-4-6` | No | Model for coding tasks |
| `CLAUDE_MODEL_TRIAGE` | string | `claude-haiku-4-5-20251001` | No | Model for triage |
| `POLL_INTERVAL_MS` | number | `30000` | No | Work item poll interval (min: 5000) |
| `CLAUDE_CODE_TIMEOUT_MS` | number | `900000` | No | Claude session timeout (min: 60000) |
| `MAX_TURNS_CODING` | number | `25` | No | Max turns for coding sessions |
| `MAX_TURNS_REVIEW` | number | `15` | No | Max turns for review sessions |
| `DAILY_BUDGET_USD` | number | `100` | No | Daily budget cap |
| `MONTHLY_BUDGET_USD` | number | `2000` | No | Monthly budget cap |
| `HEALTH_PORT` | number | `8080` | No | Health endpoint port |

## Jarvis Runtime

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `TENANT_ID` | uuid | — | Yes | Owning tenant |
| `JARVIS_NAMESPACE` | string | `jarvis` | No | K8s namespace |
| `ADO_ORG_URL` | string (url) | — | Yes | Azure DevOps org URL |
| `ADO_PROJECT` | string | — | Yes | ADO project name |
| `ADO_PAT` | string | — | Yes | ADO PAT |
| `TELEGRAM_CHAT_ID` | string | — | Yes | Telegram chat for updates |
| `POLL_INTERVAL_MS` | number | `30000` | No | Poll interval (min: 5000) |
| `DAILY_SUMMARY_INTERVAL_MS` | number | `86400000` | No | Daily summary interval (24h) |
| `AGENT_IMAGE` | string | `agentcoders/agent-runtime:latest` | No | Docker image for spawned agents |

## Telegram Gateway

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | string | — | Yes | Telegraf bot token |
| `TELEGRAM_OWNER_CHAT_ID` | string | — | Yes | Owner chat ID (security filter) |

## Billing Service

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `STRIPE_SECRET_KEY` | string | — | Yes | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | string | — | Yes | Stripe webhook secret |
| `HEALTH_PORT` | number | `8081` | No | Health endpoint port |

## Tenant Manager

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `STRIPE_SECRET_KEY` | string | — | Yes | Stripe secret key |
| `K8S_IN_CLUSTER` | boolean | `true` | No | Running inside K8s cluster |
| `HEALTH_PORT` | number | `8082` | No | Health endpoint port |

## Model Router

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `DEFAULT_PROVIDER` | enum | `anthropic` | No | `anthropic` / `openai` / `google` / `ollama` |
| `DEFAULT_STRATEGY` | enum | `quality-optimized` | No | `cost-optimized` / `quality-optimized` / `latency-optimized` / `round-robin` |
| `ANTHROPIC_API_KEY` | string | — | No | Anthropic API key |
| `OPENAI_API_KEY` | string | — | No | OpenAI API key |
| `GOOGLE_API_KEY` | string | — | No | Google API key |
| `OLLAMA_BASE_URL` | string | `http://localhost:11434` | No | Ollama endpoint |
| `RATE_LIMIT_RPM` | number | `60` | No | Requests per minute limit |
| `HEALTH_PORT` | number | `8090` | No | Health endpoint port |

## Governance

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `AUDIT_FLUSH_INTERVAL_MS` | number | `5000` | No | Audit buffer flush interval |
| `TELEMETRY_FLUSH_INTERVAL_MS` | number | `10000` | No | Telemetry buffer flush interval |
| `FAILURE_PATTERN_WINDOW_MS` | number | `3600000` | No | Failure pattern detection window (1h) |
| `AUTHORITY_DECAY_CHECK_INTERVAL_MS` | number | `60000` | No | Authority decay check interval (1min) |

## Enhancement Layer

Extends base config.

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `MAX_REFINEMENT_LOOPS` | number | `3` | No | Max output refinement iterations |
| `CONFIDENCE_THRESHOLD` | number | `0.7` | No | Minimum confidence score (0-1) |
| `MAX_COST_PER_ENHANCEMENT_USD` | number | `5.0` | No | Cost ceiling per enhancement run |
| `SECURITY_SCAN_ENABLED` | boolean | `true` | No | Enable security scanning |
| `PII_DETECTION_ENABLED` | boolean | `true` | No | Enable PII detection |
