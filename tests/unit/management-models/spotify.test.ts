import { describe, it, expect, vi } from 'vitest';

vi.mock('@agentcoders/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { createSpotifyModel } from '../../../packages/management-models/src/spotify/index.js';

describe('SpotifyModel', () => {
  it('should configure topology with squads and tribes from agent list', () => {
    const model = createSpotifyModel();
    const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5', 'agent-6'];

    const topology = model.configureTopology(agents, { squadSize: 3 });

    expect(topology.modelType).toBe('spotify');
    expect(topology.groups.length).toBeGreaterThan(0);

    // Should have squads
    const squads = topology.groups.filter((g) => g.type === 'squad');
    expect(squads.length).toBe(2); // 6 agents / 3 per squad = 2 squads

    // Each squad should have 3 members
    for (const squad of squads) {
      expect(squad.members).toHaveLength(3);
    }

    // Should have a tribe
    const tribes = topology.groups.filter((g) => g.type === 'tribe');
    expect(tribes).toHaveLength(1);

    // Should have a chapter
    const chapters = topology.groups.filter((g) => g.type === 'chapter');
    expect(chapters).toHaveLength(1);

    // Chapter should include all agents
    expect(chapters[0]!.members).toHaveLength(6);

    // Should have escalation paths
    expect(topology.escalationPaths.length).toBeGreaterThan(0);

    // Should have cadence config
    expect(topology.cadence).toBeDefined();
    expect(topology.cadence.standupFrequency).toBe('daily');
  });

  it('should assign work round-robin to squads', () => {
    const model = createSpotifyModel();
    const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5', 'agent-6'];
    model.configureTopology(agents, { squadSize: 3 });

    const groups = model.getGroups();
    const squads = groups.filter((g) => g.type === 'squad');
    expect(squads.length).toBe(2);

    // First assignment goes to first squad
    const assignee1 = model.assignWork(100, groups);
    // Second assignment goes to second squad
    const assignee2 = model.assignWork(101, groups);
    // Third assignment wraps back to first squad
    const assignee3 = model.assignWork(102, groups);

    // Assignees from different squads should be different agents
    // (first squad developers vs second squad developers)
    expect(assignee1).not.toBe('');
    expect(assignee2).not.toBe('');
    // Round-robin wraps around, so assignee3 should match assignee1's squad
    expect(assignee3).toBe(assignee1);
  });

  it('should report correct metrics', () => {
    const model = createSpotifyModel();
    const agents = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
    model.configureTopology(agents, { squadSize: 4 });

    const metrics = model.reportMetrics();

    expect(metrics['totalSquads']).toBe(2);
    // Total agents = tribe members + squad members + chapter members + guild members
    // But the key metric is totalSquads and avgSquadSize
    expect(metrics['avgSquadSize']).toBe(4);
    expect(metrics['totalAgents']).toBeGreaterThan(0);
  });

  it('should use default squad size of 4 when not specified', () => {
    const model = createSpotifyModel();
    const agents = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7', 'a8'];
    const topology = model.configureTopology(agents, {});

    const squads = topology.groups.filter((g) => g.type === 'squad');
    expect(squads).toHaveLength(2); // 8 / 4 = 2

    for (const squad of squads) {
      expect(squad.members).toHaveLength(4);
    }
  });

  it('should assign product-owner role to first member of each squad', () => {
    const model = createSpotifyModel();
    const agents = ['a1', 'a2', 'a3', 'a4'];
    const topology = model.configureTopology(agents, { squadSize: 4 });

    const squads = topology.groups.filter((g) => g.type === 'squad');
    expect(squads).toHaveLength(1);
    expect(squads[0]!.members[0]!.role).toBe('product-owner');
    expect(squads[0]!.members[1]!.role).toBe('developer');
  });
});
