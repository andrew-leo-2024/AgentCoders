#!/usr/bin/env bash
# Provision a vertical (agent squad) for a tenant
# Usage: ./provision-vertical.sh <tenant-namespace> <vertical> <agent-count>
#
# Example: ./provision-vertical.sh tenant-acme-frontend frontend 3

set -euo pipefail

NAMESPACE="${1:?Usage: provision-vertical.sh <namespace> <vertical> <agent-count>}"
VERTICAL="${2:?Vertical name required (frontend, backend, devops, qa)}"
AGENT_COUNT="${3:-2}"
ACR_NAME="${ACR_NAME:-agentcoders}"
IMAGE_TAG="${IMAGE_TAG:-latest}"

echo "Provisioning vertical: $VERTICAL in $NAMESPACE with $AGENT_COUNT agents"

# Deploy Jarvis CEO for this vertical
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: jarvis-${VERTICAL}
  namespace: ${NAMESPACE}
  labels:
    agentcoders.io/component: jarvis
    agentcoders.io/vertical: ${VERTICAL}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: jarvis-${VERTICAL}
  template:
    metadata:
      labels:
        app: jarvis-${VERTICAL}
        agentcoders.io/component: jarvis
        agentcoders.io/vertical: ${VERTICAL}
    spec:
      serviceAccountName: jarvis
      containers:
        - name: jarvis
          image: ${ACR_NAME}.azurecr.io/agentcoders/jarvis:${IMAGE_TAG}
          env:
            - name: AGENT_ID
              value: jarvis-${VERTICAL}
            - name: AGENT_VERTICAL
              value: ${VERTICAL}
            - name: AGENT_NAMESPACE
              value: ${NAMESPACE}
            - name: REDIS_URL
              value: redis://redis.agent-shared.svc.cluster.local:6379
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: connection-string
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-credentials
                  key: anthropic-api-key
            - name: ADO_PAT
              valueFrom:
                secretKeyRef:
                  name: ado-credentials
                  key: pat
          ports:
            - containerPort: 8080
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            periodSeconds: 15
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: "1"
              memory: 1Gi
EOF

# Deploy coding agents
for i in $(seq 1 "$AGENT_COUNT"); do
  AGENT_ID="agent-${VERTICAL}-${i}"
  echo "  Deploying $AGENT_ID"

  cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${AGENT_ID}
  namespace: ${NAMESPACE}
  labels:
    agentcoders.io/component: agent
    agentcoders.io/vertical: ${VERTICAL}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${AGENT_ID}
  template:
    metadata:
      labels:
        app: ${AGENT_ID}
        agentcoders.io/component: agent
        agentcoders.io/vertical: ${VERTICAL}
    spec:
      containers:
        - name: agent
          image: ${ACR_NAME}.azurecr.io/agentcoders/agent:${IMAGE_TAG}
          env:
            - name: AGENT_ID
              value: ${AGENT_ID}
            - name: AGENT_VERTICAL
              value: ${VERTICAL}
            - name: AGENT_NAMESPACE
              value: ${NAMESPACE}
            - name: REDIS_URL
              value: redis://redis.agent-shared.svc.cluster.local:6379
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-credentials
                  key: connection-string
            - name: ANTHROPIC_API_KEY
              valueFrom:
                secretKeyRef:
                  name: ai-credentials
                  key: anthropic-api-key
            - name: ADO_PAT
              valueFrom:
                secretKeyRef:
                  name: ado-credentials
                  key: pat
          ports:
            - containerPort: 8080
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8080
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /readyz
              port: 8080
            periodSeconds: 15
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: "2"
              memory: 2Gi
EOF
done

echo "Vertical $VERTICAL provisioned with $AGENT_COUNT agents"
kubectl -n "$NAMESPACE" get pods
