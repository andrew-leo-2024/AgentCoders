#!/usr/bin/env bash
# Deploy AgentCoders to a Kubernetes cluster
# Usage: ./deploy.sh <environment> [--build]
#
# Environments: dev, staging, production

set -euo pipefail

ENV="${1:?Usage: deploy.sh <dev|staging|production> [--build]}"
BUILD="${2:-}"
ACR_NAME="${ACR_NAME:-agentcoders}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOY_DIR="$ROOT_DIR/deploy"

echo "Deploying AgentCoders to: $ENV"

# Build and push images if requested
if [ "$BUILD" = "--build" ]; then
  echo "Building Docker images..."

  for service in agent jarvis gateway billing tenant-manager dashboard; do
    IMAGE="$ACR_NAME.azurecr.io/agentcoders/$service:$IMAGE_TAG"
    echo "  Building $IMAGE"
    docker build -t "$IMAGE" \
      -f "$DEPLOY_DIR/dockerfiles/Dockerfile.$service" \
      "$ROOT_DIR"
    docker push "$IMAGE"
  done

  echo "Images built and pushed"
fi

# Apply Kustomize overlay
echo "Applying Kustomize overlay: $ENV"
kubectl apply -k "$DEPLOY_DIR/kustomize/overlays/$ENV/"

echo "Waiting for rollout..."
kubectl -n agent-shared rollout status statefulset/postgres --timeout=120s
kubectl -n agent-shared rollout status statefulset/redis --timeout=120s
kubectl -n agent-shared rollout status deployment/telegram-gateway --timeout=60s
kubectl -n agent-shared rollout status deployment/billing-service --timeout=60s
kubectl -n agent-shared rollout status deployment/tenant-manager --timeout=60s

echo "Deployment complete"
kubectl -n agent-shared get pods
