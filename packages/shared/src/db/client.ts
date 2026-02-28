import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';

let dbInstance: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb(connectionString?: string) {
  if (dbInstance) return dbInstance;

  const pool = new pg.Pool({
    connectionString: connectionString ?? process.env['DATABASE_URL'],
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  dbInstance = drizzle(pool, { schema });
  return dbInstance;
}

export type Database = ReturnType<typeof getDb>;
