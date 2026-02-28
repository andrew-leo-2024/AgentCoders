#!/usr/bin/env bash
# Provision a new tenant namespace from template
# Usage: ./provision-tenant.sh <tenant-slug> <tenant-id> <isolation-tier>
#
# Example: ./provision-tenant.sh acme-corp abc-123-def namespace

set -euo pipefail

TENANT_SLUG="${1:?Usage: provision-tenant.sh <tenant-slug> <tenant-id> <isolation-tier>}"
TENANT_ID="${2:?Tenant ID required}"
TIER="${3:-namespace}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATES_DIR="$SCRIPT_DIR/../kustomize/tenant-templates"
TENANT_NAMESPACE="tenant-${TENANT_SLUG}"

echo "Provisioning tenant: $TENANT_SLUG (ID: $TENANT_ID, Tier: $TIER)"

case "$TIER" in
  namespace)
    TEMPLATE_DIR="$TEMPLATES_DIR/namespace-only"
    ;;
  namespace-dedicated-db)
    TEMPLATE_DIR="$TEMPLATES_DIR/namespace-dedicated-db"
    ;;
  dedicated-cluster)
    echo "Dedicated cluster tier requires Terraform pipeline. Placeholder only."
    exit 1
    ;;
  *)
    echo "Unknown isolation tier: $TIER"
    exit 1
    ;;
esac

# Create temporary directory with substituted templates
TEMP_DIR=$(mktemp -d)
trap 'rm -rf $TEMP_DIR' EXIT

cp -r "$TEMPLATE_DIR/"* "$TEMP_DIR/"

# Substitute variables
find "$TEMP_DIR" -type f -name '*.yaml' -exec \
  sed -i "s/TENANT_NAMESPACE/$TENANT_NAMESPACE/g; s/TENANT_ID/$TENANT_ID/g" {} +

# Apply templates
echo "Applying templates from: $TEMPLATE_DIR"
kubectl apply -f "$TEMP_DIR/"

echo "Tenant namespace $TENANT_NAMESPACE provisioned"
kubectl get namespace "$TENANT_NAMESPACE"
kubectl -n "$TENANT_NAMESPACE" get all
