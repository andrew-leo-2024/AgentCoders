/**
 * Shared test container setup for integration tests.
 *
 * Starts real Postgres 16 and Redis 7 containers via testcontainers,
 * runs Drizzle migrations, and exposes connection getters.
 */

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer, type StartedTestContainer } from 'testcontainers';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { Redis } from 'ioredis';
import * as schema from '../../packages/shared/src/db/schema.js';
import { runMigrations } from '../../packages/shared/src/db/migrate.js';

let pgContainer: StartedPostgreSqlContainer;
let redisContainer: StartedTestContainer;
let pool: pg.Pool;

export async function startContainers() {
  [pgContainer, redisContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:16-alpine').start(),
    new GenericContainer('redis:7-alpine').withExposedPorts(6379).start(),
  ]);

  const connectionString = pgContainer.getConnectionUri();

  // Run migrations
  await runMigrations(connectionString);

  // Create shared pool
  pool = new pg.Pool({ connectionString, max: 5 });

  return { connectionString };
}

export async function stopContainers() {
  await pool?.end().catch(() => {});
  await Promise.all([
    pgContainer?.stop().catch(() => {}),
    redisContainer?.stop().catch(() => {}),
  ]);
}

export function getDb() {
  return drizzle(pool, { schema });
}

export function getConnectionString(): string {
  return pgContainer.getConnectionUri();
}

export function getRedisUrl(): string {
  const host = redisContainer.getHost();
  const port = redisContainer.getMappedPort(6379);
  return `redis://${host}:${port}`;
}

export function createRedisClient(): Redis {
  return new Redis(getRedisUrl(), { lazyConnect: true });
}

export { schema };
