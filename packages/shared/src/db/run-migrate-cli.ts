/**
 * CLI entry point for running database migrations.
 *
 * Used as a K8s init container to ensure the schema is up-to-date
 * before services start. Idempotent — safe to run on every deploy.
 *
 * Usage: node dist/db/run-migrate-cli.js
 * Requires: DATABASE_URL environment variable
 */

import { runMigrations } from './migrate.js';

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

try {
  await runMigrations(connectionString);
  console.log('Migrations completed successfully');
  process.exit(0);
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
