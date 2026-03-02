---
sidebar_position: 12
title: "@agentcoders/skill-registry"
---

# @agentcoders/skill-registry

Skill registration, discovery, and deployment system with MCP (Model Context Protocol) server connectivity and builtin skill definitions.

**Entry point:** `dist/main.js`
**Source files:** 6

## Components

### SkillRegistry (`registry.ts`)

Central skill management using Drizzle ORM:

**Methods:**
- `register(skill)` — register a new skill definition
- `getAll(category?)` — list skills, optionally filtered by category
- `getByName(name)` — find skill by unique name
- `getById(id)` — find skill by ID
- `activateForAgent(tenantId, agentId, skillId)` — activate skill for an agent (inserts into `agentSkills` table)
- `deactivateForAgent(tenantId, agentId, skillId)` — deactivate skill
- `getAgentSkills(tenantId, agentId)` — list all skills activated for an agent

### SkillLoader (`skill-loader.ts`)

Deploys skills to agent workspaces:

- `writeToWorkspace(workspacePath, skills)` — writes skill files to `.claude/skills/` directory
- `loadBuiltins()` — loads all 6 builtin skill definitions

**Workspace structure:**
```
.claude/
└── skills/
    ├── frontend-design.md
    ├── tdd-workflow.md
    ├── security-audit.md
    ├── api-design.md
    ├── devops-pipeline.md
    └── code-review.md
```

### Builtin Skills

6 built-in skill definitions:

| Skill | Category | Content |
|-------|----------|---------|
| `frontend-design` | `frontend` | Design tokens, atomic design methodology, responsive patterns, WCAG AA accessibility |
| `tdd-workflow` | `testing` | Test-driven development process, test-first methodology, behavioral testing patterns |
| `security-audit` | `security` | Input validation, authentication checks, injection prevention (XSS, SQLi), secrets scanning, CVE checks, logging practices, CORS, rate limiting |
| `api-design` | `backend` | RESTful conventions, HTTP methods and status codes, pagination patterns, API versioning, standardized error format |
| `devops-pipeline` | `devops` | 7-stage CI/CD pipeline: lint → typecheck → unit tests → build → integration tests → security scan → deploy |
| `code-review` | `general` | Code quality checks, edge case analysis, error handling patterns, security review, readability, type safety |

### SkillPackager (`skill-packager.ts`)

Packages skills for distribution:
- Serializes skill definitions with metadata
- Validates skill content and format
- Supports versioning for skill updates

### SkillScorer (`skill-scorer.ts`)

Tracks skill performance via `skillScores` table:
- Records `qualityDelta` — improvement in output quality when skill is active
- Tracks `sampleCount` — number of tasks using the skill
- Groups by `taskType` for per-domain effectiveness analysis

### McpConnector (`mcp-connector.ts`)

Manages external MCP (Model Context Protocol) servers:

```typescript
interface McpServerConfig {
  name: string;
  url: string;
  authToken?: string;
  enabled: boolean;
}
```

**Methods:**
- `register(config)` — register an MCP server
- `unregister(name)` — remove an MCP server
- `getEnabled()` — list all enabled MCP servers
- `getByName(name)` — find server by name
- `healthCheck(name)` — verify MCP server connectivity
- `buildMcpConfig()` — build MCP configuration for Claude Code sessions

## Skill Categories

| Category | Description |
|----------|-------------|
| `frontend` | UI/UX, design systems, accessibility |
| `backend` | APIs, server-side logic, databases |
| `devops` | CI/CD, infrastructure, deployment |
| `security` | Vulnerability scanning, auth, compliance |
| `testing` | TDD, test frameworks, coverage |
| `design` | Architecture, patterns, system design |
| `general` | Cross-cutting: reviews, documentation, conventions |
