/**
 * Integration test: Redis pub/sub with tenant-scoped channels.
 *
 * Verifies channel isolation — messages published on one tenant's
 * channel are not received by a subscriber on a different tenant's channel.
 */

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { Redis } from 'ioredis';

let redisContainer: StartedTestContainer;
let redisUrl: string;
const clients: Redis[] = [];

function createClient(): Redis {
  const client = new Redis(redisUrl, { lazyConnect: true });
  clients.push(client);
  return client;
}

beforeAll(async () => {
  redisContainer = await new GenericContainer('redis:7-alpine')
    .withExposedPorts(6379)
    .start();

  const host = redisContainer.getHost();
  const port = redisContainer.getMappedPort(6379);
  redisUrl = `redis://${host}:${port}`;
}, 120_000);

afterEach(async () => {
  // Disconnect all clients created during the test
  await Promise.all(clients.map((c) => c.quit().catch(() => {})));
  clients.length = 0;
});

afterAll(async () => {
  await redisContainer?.stop().catch(() => {});
}, 30_000);

describe('Redis Pub/Sub — Tenant Isolation', () => {
  it('should deliver messages on a tenant-scoped channel', async () => {
    const sub = createClient();
    const pub = createClient();
    await sub.connect();
    await pub.connect();

    const tenantId = 'aaaa-bbbb-cccc-dddd';
    const channel = `tenant:${tenantId}:events`;
    const received: string[] = [];

    await sub.subscribe(channel);
    sub.on('message', (_ch: string, msg: string) => received.push(msg));

    await pub.publish(channel, JSON.stringify({ type: 'task-assigned', agentId: 'agent-1' }));

    // Give Redis a moment to deliver
    await new Promise((r) => setTimeout(r, 200));

    expect(received).toHaveLength(1);
    expect(JSON.parse(received[0])).toEqual({ type: 'task-assigned', agentId: 'agent-1' });
  });

  it('should NOT receive messages from a different tenant channel', async () => {
    const sub = createClient();
    const pub = createClient();
    await sub.connect();
    await pub.connect();

    const tenantA = 'tenant:aaaa:events';
    const tenantB = 'tenant:bbbb:events';
    const received: string[] = [];

    await sub.subscribe(tenantA);
    sub.on('message', (_ch: string, msg: string) => received.push(msg));

    // Publish to tenant B's channel
    await pub.publish(tenantB, 'should-not-arrive');

    await new Promise((r) => setTimeout(r, 200));

    expect(received).toHaveLength(0);
  });

  it('should handle multiple subscribers on the same tenant channel', async () => {
    const sub1 = createClient();
    const sub2 = createClient();
    const pub = createClient();
    await sub1.connect();
    await sub2.connect();
    await pub.connect();

    const channel = 'tenant:multi-sub:events';
    const received1: string[] = [];
    const received2: string[] = [];

    await sub1.subscribe(channel);
    await sub2.subscribe(channel);
    sub1.on('message', (_ch: string, msg: string) => received1.push(msg));
    sub2.on('message', (_ch: string, msg: string) => received2.push(msg));

    await pub.publish(channel, 'broadcast');

    await new Promise((r) => setTimeout(r, 200));

    expect(received1).toHaveLength(1);
    expect(received2).toHaveLength(1);
  });
});
