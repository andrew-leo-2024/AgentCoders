import { describe, it, expect, vi } from 'vitest';

vi.mock('@agentcoders/shared', () => ({
  createLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { SecurityScanner } from '../../../packages/enhancement-layer/src/armours/security-scanner.js';
import type { StageContext } from '../../../packages/enhancement-layer/src/stage-interface.js';

const ctx: StageContext = {
  tenantId: 'tenant-1',
  agentId: 'agent-1',
  metadata: {},
};

describe('SecurityScanner', () => {
  it('should detect XSS patterns like innerHTML and script tags', async () => {
    const scanner = new SecurityScanner(['xss']);
    const code = [
      'const el = document.getElementById("app");',
      'el.innerHTML = userInput;',
      '<script>alert("xss")</script>',
    ].join('\n');

    const result = await scanner.execute(code, ctx);

    expect(result.modified).toBe(false);
    const findings = result.details['findings'] as Array<{ type: string; message: string }>;
    expect(findings.length).toBeGreaterThanOrEqual(2);

    const types = findings.map((f) => f.type);
    expect(types).toContain('xss');

    const messages = findings.map((f) => f.message);
    const hasInnerHtml = messages.some((m) => m.toLowerCase().includes('innerhtml'));
    const hasScript = messages.some((m) => m.toLowerCase().includes('script'));
    expect(hasInnerHtml).toBe(true);
    expect(hasScript).toBe(true);
  });

  it('should detect hardcoded secrets like API keys and AWS keys', async () => {
    const scanner = new SecurityScanner(['secrets']);
    const code = [
      'const config = {',
      '  apiKey: "sk-abcdefghijklmnopqrstuvwxyz123456",',
      '  awsKey: "AKIAIOSFODNN7EXAMPLE1",',
      '};',
    ].join('\n');

    const result = await scanner.execute(code, ctx);

    const findings = result.details['findings'] as Array<{ type: string; message: string }>;
    expect(findings.length).toBeGreaterThanOrEqual(2);

    const types = new Set(findings.map((f) => f.type));
    expect(types.has('secrets')).toBe(true);

    const messages = findings.map((f) => f.message.toLowerCase()).join(' ');
    expect(messages).toMatch(/aws|api key|openai/i);
  });

  it('should pass clean code without findings', async () => {
    const scanner = new SecurityScanner(['xss', 'sqli', 'command-injection', 'secrets']);
    const cleanCode = [
      'function add(a: number, b: number): number {',
      '  return a + b;',
      '}',
      '',
      'const result = add(1, 2);',
      'console.log(result);',
    ].join('\n');

    const result = await scanner.execute(cleanCode, ctx);

    const findings = result.details['findings'] as unknown[];
    expect(findings).toHaveLength(0);
    expect(result.details['passed']).toBe(true);
    expect(result.details['requiresReview']).toBe(false);
  });

  it('should detect SQL injection patterns', async () => {
    const scanner = new SecurityScanner(['sqli']);
    const code = [
      'const userId = req.params.id;',
      'db.execute("SELECT * FROM users WHERE id = " + userId);',
    ].join('\n');

    const result = await scanner.execute(code, ctx);

    const findings = result.details['findings'] as Array<{ type: string }>;
    expect(findings.length).toBeGreaterThanOrEqual(1);
    expect(findings.some((f) => f.type === 'sqli')).toBe(true);
  });

  it('should only run checks that are configured', async () => {
    const scanner = new SecurityScanner(['xss']);
    const code = [
      'el.innerHTML = userInput;',
      'const apiKey = "sk-abcdefghijklmnopqrstuvwxyz123456";',
    ].join('\n');

    const result = await scanner.execute(code, ctx);

    const findings = result.details['findings'] as Array<{ type: string }>;
    const types = new Set(findings.map((f) => f.type));
    // Only XSS checks were configured, so secrets should not be flagged
    expect(types.has('xss')).toBe(true);
    expect(types.has('secrets')).toBe(false);

    const checksPerformed = result.details['checksPerformed'] as string[];
    expect(checksPerformed).toEqual(['xss']);
  });
});
