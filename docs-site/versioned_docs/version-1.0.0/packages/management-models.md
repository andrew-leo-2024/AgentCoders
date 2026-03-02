---
sidebar_position: 13
title: "@agentcoders/management-models"
---

# @agentcoders/management-models

Organizational topology models for structuring AI agent teams. Implements Spotify, SAFe, and Team Topologies patterns with a unified interface.

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

**Available model types:** `spotify`, `safe`, `scrum-at-scale`, `team-topologies`

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

## Spotify Model (`spotify/`)

Spotify's Squad/Tribe/Chapter/Guild model adapted for AI agents:

### Squad (`spotify/squad.ts`)

Autonomous team aligned to a mission:

- Configurable squad size (default configurable per tenant)
- Round-robin work assignment within the squad
- Role assignment: `product-owner`, `developer`, `tester`
- Each squad owns a vertical (frontend, backend, etc.)

### Tribe (`spotify/tribe.ts`)

Collection of related squads:

- Groups squads by domain area
- Cross-squad coordination for large features
- Tribe-level metrics aggregation

### Chapter (`spotify/chapter.ts`)

Functional guild spanning squads:

- Groups agents by role across squads (e.g., all reviewers)
- Enables skill sharing and consistency
- Chapter leads for standards enforcement

### Guild (`spotify/guild.ts`)

Cross-squad communities of interest:

- Voluntary communities for knowledge sharing
- Cross-cutting concerns (security, performance, accessibility)
- No direct work assignment — advisory role

## SAFe Model (`safe/`)

Scaled Agile Framework adapted for AI agent teams:

### Agile Release Train (`safe/art.ts`)

Long-lived team-of-teams:

- Coordinates multiple agent squads
- Manages shared dependencies and integration
- Train-level planning and tracking

### PI Planning (`safe/pi-planning.ts`)

Program Increment planning for coordinated delivery:

- Identifies cross-team dependencies
- Plans work across multiple sprints
- Tracks PI objectives and progress
- Supports feature-level planning with agent assignments

## Team Topologies Model (`team-topologies/`)

Team Topologies patterns for AI agent organization:

### Stream-Aligned Team (`team-topologies/stream-aligned.ts`)

Primary value delivery teams:

- Aligned to a flow of work (feature stream)
- End-to-end ownership of their stream
- Minimize external dependencies

### Platform Team (`team-topologies/platform-team.ts`)

Internal service providers:

- Provide shared capabilities to stream-aligned teams
- Self-service APIs and tooling
- Reduce cognitive load on stream teams

### Enabling Team (`team-topologies/enabling-team.ts`)

Capability enablers:

- Help other teams adopt new technologies or practices
- Temporary engagement — upskill then move on
- Bridge knowledge gaps across the organization

## Configuration

Per-tenant configuration stored in `managementConfigs` table:

```typescript
{
  modelType: 'spotify',          // which model to use
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
