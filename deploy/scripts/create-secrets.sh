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

# ADO credentials
kubectl create secret generic ado-credentials \
  --namespace="$NAMESPACE" \
  --from-literal=pat="${ADO_PAT:?Required}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Secrets created successfully"
