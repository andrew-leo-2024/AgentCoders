import { describe, it, expect } from 'vitest';

// Test the routing logic inline (to avoid importing the full module with Telegraf deps)
function getTargetChannel(text: string, tenantId: string): { channel: string; isbroadcast: boolean } {
  const prefixes: Record<string, string> = {
    'Frontend:': 'jarvis-frontend',
    'Backend:': 'jarvis-backend',
    'DevOps:': 'jarvis-devops',
    'QA:': 'jarvis-qa',
  };

  const upperText = text.trim();

  if (upperText.startsWith('All:')) {
    return { channel: 'all', isbroadcast: true };
  }

  for (const [prefix, vertical] of Object.entries(prefixes)) {
    if (upperText.startsWith(prefix)) {
      return { channel: `${tenantId}:telegram:${vertical}`, isbroadcast: false };
    }
  }

  return { channel: `${tenantId}:telegram:jarvis`, isbroadcast: false };
}

describe('Telegram Router', () => {
  const tenantId = 'tenant-123';

  it('should route Frontend: prefix to jarvis-frontend', () => {
    const result = getTargetChannel('Frontend: build the navbar', tenantId);
    expect(result.channel).toBe('tenant-123:telegram:jarvis-frontend');
    expect(result.isbroadcast).toBe(false);
  });

  it('should route Backend: prefix to jarvis-backend', () => {
    const result = getTargetChannel('Backend: add auth endpoint', tenantId);
    expect(result.channel).toBe('tenant-123:telegram:jarvis-backend');
  });

  it('should route DevOps: prefix to jarvis-devops', () => {
    const result = getTargetChannel('DevOps: fix CI pipeline', tenantId);
    expect(result.channel).toBe('tenant-123:telegram:jarvis-devops');
  });

  it('should route QA: prefix to jarvis-qa', () => {
    const result = getTargetChannel('QA: write integration tests', tenantId);
    expect(result.channel).toBe('tenant-123:telegram:jarvis-qa');
  });

  it('should broadcast All: to all verticals', () => {
    const result = getTargetChannel('All: pivot to new architecture', tenantId);
    expect(result.isbroadcast).toBe(true);
  });

  it('should route unprefixed messages to default jarvis', () => {
    const result = getTargetChannel('What is the status of the project?', tenantId);
    expect(result.channel).toBe('tenant-123:telegram:jarvis');
  });
});
