#!/usr/bin/env bash
# Create Kubernetes secrets from environment variables
# Usage: ./create-secrets.sh [namespace]
#
# Required env vars:
#   POSTGRES_USER, POSTGRES_PASSWORD, DATABASE_URL
#   TELEGRAM_BOT_TOKEN, TELEGRAM_OWNER_CHAT_ID
#   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET
#   ANTHROPIC_API_KEY
#   ADO_PAT

set -euo pipefail

NAMESPACE="${1:-agent-shared}"

echo "Creating secrets in namespace: $NAMESPACE"

# Postgres credentials
kubectl create secret generic postgres-credentials \
  --namespace="$NAMESPACE" \
  --from-literal=username="${POSTGRES_USER:?Required}" \
  --from-literal=password="${POSTGRES_PASSWORD:?Required}" \
  --from-literal=connection-string="${DATABASE_URL:?Required}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Telegram credentials
kubectl create secret generic telegram-credentials \
  --namespace="$NAMESPACE" \
  --from-literal=bot-token="${TELEGRAM_BOT_TOKEN:?Required}" \
  --from-literal=owner-chat-id="${TELEGRAM_OWNER_CHAT_ID:?Required}" \
  --dry-run=client -o yaml | kubectl apply -f -

# Stripe credentials
kubectl create secret generic stripe-credentials \
  --namespace="$NAMESPACE" \
  --from-literal=secret-key="${STRIPE_SECRET_KEY:?Required}" \
  --from-literal=webhook-secret="${STRIPE_WEBHOOK_SECRET:?Required}" \
  --dry-run=client -o yaml | kubectl apply -f -

# AI credentials
kubectl create secret generic ai-credentials \
  --namespace="$NAMESPACE" \
  --from-literal=anthropic-api-key="${ANTHROPIC_API_KEY:?Required}" \
  --dry-run=client -o yaml | kubectl apply -f -

# SCM credentials — ADO or GitHub depending on SCM_PROVIDER
SCM_PROVIDER="${SCM_PROVIDER:-ado}"

if [ "$SCM_PROVIDER" = "github" ]; then
  kubectl create secret generic scm-credentials \
    --namespace="$NAMESPACE" \
    --from-literal=provider="github" \
    --from-literal=github-token="${GITHUB_TOKEN:?Required for GitHub SCM}" \
    --from-literal=github-owner="${GITHUB_OWNER:?Required for GitHub SCM}" \
    --from-literal=github-repo="${GITHUB_REPO:?Required for GitHub SCM}" \
    --dry-run=client -o yaml | kubectl apply -f -
else
  kubectl create secret generic scm-credentials \
    --namespace="$NAMESPACE" \
    --from-literal=provider="ado" \
    --from-literal=ado-pat="${ADO_PAT:?Required for ADO SCM}" \
    --from-literal=ado-org-url="${ADO_ORG_URL:?Required for ADO SCM}" \
    --from-literal=ado-project="${ADO_PROJECT:?Required for ADO SCM}" \
    --dry-run=client -o yaml | kubectl apply -f -
fi

# Tenant-manager API key
kubectl create secret generic api-credentials \
  --namespace="$NAMESPACE" \
  --from-literal=api-key-secret="${API_KEY_SECRET:?Required (min 32 chars)}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secrets created successfully (SCM_PROVIDER=$SCM_PROVIDER)"
