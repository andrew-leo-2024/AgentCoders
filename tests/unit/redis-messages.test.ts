import { describe, it, expect } from 'vitest';

describe('Redis Message Types', () => {
  describe('discriminated union', () => {
    it('should serialize heartbeat message', () => {
      const msg = {
        type: 'heartbeat' as const,
        agentId: 'agent-backend-1',
        tenantId: 'tenant-123',
        status: 'idle' as const,
        timestamp: new Date().toISOString(),
      };

      const serialized = JSON.stringify(msg);
      const parsed = JSON.parse(serialized);
      expect(parsed.type).toBe('heartbeat');
      expect(parsed.agentId).toBe('agent-backend-1');
    });

    it('should serialize escalation message', () => {
      const msg = {
        type: 'escalation' as const,
        subType: 'merge-conflict' as const,
        agentId: 'agent-frontend-2',
        tenantId: 'tenant-123',
        workItemId: 42,
        details: 'Rebase failed on src/app.ts',
        timestamp: new Date().toISOString(),
      };

      const serialized = JSON.stringify(msg);
      const parsed = JSON.parse(serialized);
      expect(parsed.type).toBe('escalation');
      expect(parsed.subType).toBe('merge-conflict');
      expect(parsed.workItemId).toBe(42);
    });

    it('should serialize progress update message', () => {
      const msg = {
        type: 'progress-update' as const,
        agentId: 'agent-backend-1',
        tenantId: 'tenant-123',
        workItemId: 99,
        phase: 'coding' as const,
        details: 'Implementing user authentication',
        tokensUsed: 15000,
        timestamp: new Date().toISOString(),
      };

      const serialized = JSON.stringify(msg);
      const parsed = JSON.parse(serialized);
      expect(parsed.phase).toBe('coding');
      expect(parsed.tokensUsed).toBe(15000);
    });
  });

  describe('channel naming', () => {
    it('should construct tenant-scoped channel names', () => {
      const tenantId = 'acme-123';
      const namespace = 'acme-backend';
      const agentId = 'agent-1';

      expect(`${tenantId}:vertical:${namespace}`).toBe('acme-123:vertical:acme-backend');
      expect(`${tenantId}:agent:${agentId}:progress`).toBe('acme-123:agent:agent-1:progress');
      expect(`${tenantId}:telegram:outbound`).toBe('acme-123:telegram:outbound');
    });
  });
});
