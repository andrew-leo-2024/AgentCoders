# Integration Tests

Integration tests use testcontainers to spin up real PostgreSQL and Redis instances.

## Prerequisites

- Docker running locally
- `npm install -D testcontainers`

## Running

```bash
npm run test:integration
```

## What they test

- Drizzle ORM schema migrations against real Postgres
- Redis pub/sub message round-trips
- Coordination layer: agent registration, heartbeats, escalations
- DWI lifecycle: creation → criteria fulfillment → billable status
- Tenant provisioning: DB record creation, quota management
