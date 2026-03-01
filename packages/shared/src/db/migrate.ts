/**
 * Runtime database migration runner using drizzle-orm's migrator.
 *
 * Used by tenant-provisioner to bootstrap dedicated Postgres instances
 * with the full AgentCoders schema.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Run all pending Drizzle migrations against a Postgres database.
 *
 * Creates a short-lived connection pool, runs migrations from the
 * `packages/shared/drizzle/` directory (shipped in Docker images),
 * then tears down the pool.
 *
 * @param connectionString - Postgres connection URL
 * @param migrationsFolder - Override migrations path (for tests)
 */
export async function runMigrations(
  connectionString: string,
  migrationsFolder?: string,
): Promise<void> {
  const pool = new pg.Pool({
    connectionString,
    max: 1,
    connectionTimeoutMillis: 10_000,
  });

  try {
    const db = drizzle(pool);
    const folder = migrationsFolder ?? path.resolve(__dirname, '../../drizzle');
    await migrate(db, { migrationsFolder: folder });
  } finally {
    await pool.end();
  }
}
