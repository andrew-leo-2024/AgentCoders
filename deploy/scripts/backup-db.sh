#!/usr/bin/env bash
# Backup PostgreSQL database to Azure Blob Storage
# Usage: ./backup-db.sh [namespace]
# Designed to run as a K8s CronJob

set -euo pipefail

NAMESPACE="${1:-agent-shared}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="/tmp/agentcoders-backup-${TIMESTAMP}.sql.gz"
AZURE_CONTAINER="${AZURE_BACKUP_CONTAINER:-agentcoders-backups}"

echo "Starting database backup: $TIMESTAMP"

# Get postgres pod
POD=$(kubectl -n "$NAMESPACE" get pods -l app=postgres -o jsonpath='{.items[0].metadata.name}')

# Run pg_dump
kubectl -n "$NAMESPACE" exec "$POD" -- \
  pg_dump -U agentcoders -d agentcoders --format=custom | gzip > "$BACKUP_FILE"

BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"

# Upload to Azure Blob Storage if configured
if command -v az &> /dev/null && [ -n "${AZURE_STORAGE_ACCOUNT:-}" ]; then
  az storage blob upload \
    --account-name "$AZURE_STORAGE_ACCOUNT" \
    --container-name "$AZURE_CONTAINER" \
    --name "$(basename "$BACKUP_FILE")" \
    --file "$BACKUP_FILE" \
    --auth-mode login
  echo "Backup uploaded to Azure Blob Storage"
fi

# Cleanup local file
rm -f "$BACKUP_FILE"
echo "Backup complete"
