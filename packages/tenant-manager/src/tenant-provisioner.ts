/**
 * TenantProvisioner — orchestrates Kubernetes infrastructure provisioning
 * for new tenants based on their isolation tier.
 *
 * MVP approach: shells out to `kubectl` via child_process.spawn.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

import type { Logger } from '@agentcoders/shared';
import type { Tenant, IsolationTier } from '@agentcoders/shared';

import { getTierConfig, generateKustomization, getDbConnectionString } from './isolation-tiers.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProvisioningResult {
  success: boolean;
  namespace: string;
  dbConnectionString: string;
  steps: ProvisioningStep[];
}

export interface ProvisioningStep {
  name: string;
  success: boolean;
  durationMs: number;
  error?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runKubectl(args: string[], logger: Logger): Promise<{ stdout: string; stderr: string; code: number }> {
  return new Promise((resolve) => {
    const proc = spawn('kubectl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('close', (code) => {
      logger.debug({ args, code, stdout: stdout.slice(0, 500), stderr: stderr.slice(0, 500) }, 'kubectl completed');
      resolve({ stdout, stderr, code: code ?? 1 });
    });

    proc.on('error', (err) => {
      logger.error({ args, err: err.message }, 'kubectl spawn error');
      resolve({ stdout, stderr: err.message, code: 1 });
    });
  });
}

async function timed<T>(fn: () => Promise<T>): Promise<{ result: T; durationMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, durationMs: Date.now() - start };
}

// ---------------------------------------------------------------------------
// K8s manifest generators (inline YAML — no external template files required)
// ---------------------------------------------------------------------------

function namespaceYaml(ns: string, tenantId: string, slug: string): string {
  return [
    'apiVersion: v1',
    'kind: Namespace',
    'metadata:',
    `  name: ${ns}`,
    '  labels:',
    `    agentcoders.io/tenant-id: "${tenantId}"`,
    `    agentcoders.io/tenant-slug: "${slug}"`,
  ].join('\n') + '\n';
}

function rbacYaml(ns: string, tenantId: string): string {
  return [
    'apiVersion: v1',
    'kind: ServiceAccount',
    'metadata:',
    `  name: tenant-agent`,
    `  namespace: ${ns}`,
    '---',
    'apiVersion: rbac.authorization.k8s.io/v1',
    'kind: Role',
    'metadata:',
    `  name: tenant-agent-role`,
    `  namespace: ${ns}`,
    'rules:',
    '  - apiGroups: [""]',
    '    resources: ["pods", "pods/log", "configmaps", "secrets"]',
    '    verbs: ["get", "list", "watch", "create", "update", "patch", "delete"]',
    '  - apiGroups: ["apps"]',
    '    resources: ["deployments", "statefulsets"]',
    '    verbs: ["get", "list", "watch"]',
    '---',
    'apiVersion: rbac.authorization.k8s.io/v1',
    'kind: RoleBinding',
    'metadata:',
    `  name: tenant-agent-binding`,
    `  namespace: ${ns}`,
    'roleRef:',
    '  apiGroup: rbac.authorization.k8s.io',
    '  kind: Role',
    `  name: tenant-agent-role`,
    'subjects:',
    '  - kind: ServiceAccount',
    '    name: tenant-agent',
    `    namespace: ${ns}`,
    '  labels:',
    `    agentcoders.io/tenant-id: "${tenantId}"`,
  ].join('\n') + '\n';
}

function networkPolicyYaml(ns: string): string {
  return [
    'apiVersion: networking.k8s.io/v1',
    'kind: NetworkPolicy',
    'metadata:',
    `  name: tenant-isolation`,
    `  namespace: ${ns}`,
    'spec:',
    '  podSelector: {}',
    '  policyTypes:',
    '    - Ingress',
    '    - Egress',
    '  ingress:',
    '    - from:',
    '        - namespaceSelector:',
    '            matchLabels:',
    `              kubernetes.io/metadata.name: ${ns}`,
    '  egress:',
    '    - to:',
    '        - namespaceSelector:',
    '            matchLabels:',
    `              kubernetes.io/metadata.name: ${ns}`,
    '    - to: []',  // allow DNS + external (ADO, Anthropic API)
    '      ports:',
    '        - port: 53',
    '          protocol: UDP',
    '        - port: 53',
    '          protocol: TCP',
    '        - port: 443',
    '          protocol: TCP',
  ].join('\n') + '\n';
}

function resourceQuotaYaml(ns: string, tier: IsolationTier, maxAgents: number): string {
  const cfg = getTierConfig(tier);
  return [
    'apiVersion: v1',
    'kind: ResourceQuota',
    'metadata:',
    `  name: tenant-quota`,
    `  namespace: ${ns}`,
    'spec:',
    '  hard:',
    `    pods: "${cfg.maxPods}"`,
    `    requests.cpu: "${maxAgents * parseInt(cfg.defaultCpuRequest)}"m`,
    `    requests.memory: "${maxAgents * parseInt(cfg.defaultMemoryRequest)}"Mi`,
    `    limits.cpu: "${maxAgents * parseInt(cfg.defaultCpuLimit)}"m`,
    `    limits.memory: "${maxAgents * parseInt(cfg.defaultMemoryLimit)}"Mi`,
  ].join('\n') + '\n';
}

function postgresStatefulSetYaml(ns: string): string {
  return [
    'apiVersion: apps/v1',
    'kind: StatefulSet',
    'metadata:',
    `  name: postgres`,
    `  namespace: ${ns}`,
    'spec:',
    '  serviceName: postgres',
    '  replicas: 1',
    '  selector:',
    '    matchLabels:',
    '      app: postgres',
    '  template:',
    '    metadata:',
    '      labels:',
    '        app: postgres',
    '    spec:',
    '      containers:',
    '        - name: postgres',
    '          image: postgres:16-alpine',
    '          ports:',
    '            - containerPort: 5432',
    '          env:',
    '            - name: POSTGRES_DB',
    '              value: agentcoders',
    '            - name: POSTGRES_USER',
    '              value: agentcoders',
    '            - name: POSTGRES_PASSWORD',
    '              value: agentcoders',
    '          volumeMounts:',
    '            - name: pgdata',
    '              mountPath: /var/lib/postgresql/data',
    '  volumeClaimTemplates:',
    '    - metadata:',
    '        name: pgdata',
    '      spec:',
    '        accessModes: ["ReadWriteOnce"]',
    '        resources:',
    '          requests:',
    '            storage: 10Gi',
    '---',
    'apiVersion: v1',
    'kind: Service',
    'metadata:',
    `  name: postgres`,
    `  namespace: ${ns}`,
    'spec:',
    '  selector:',
    '    app: postgres',
    '  ports:',
    '    - port: 5432',
    '      targetPort: 5432',
    '  clusterIP: None',
  ].join('\n') + '\n';
}

function redisStatefulSetYaml(ns: string): string {
  return [
    'apiVersion: apps/v1',
    'kind: StatefulSet',
    'metadata:',
    `  name: redis`,
    `  namespace: ${ns}`,
    'spec:',
    '  serviceName: redis',
    '  replicas: 1',
    '  selector:',
    '    matchLabels:',
    '      app: redis',
    '  template:',
    '    metadata:',
    '      labels:',
    '        app: redis',
    '    spec:',
    '      containers:',
    '        - name: redis',
    '          image: redis:7-alpine',
    '          ports:',
    '            - containerPort: 6379',
    '          volumeMounts:',
    '            - name: redisdata',
    '              mountPath: /data',
    '  volumeClaimTemplates:',
    '    - metadata:',
    '        name: redisdata',
    '      spec:',
    '        accessModes: ["ReadWriteOnce"]',
    '        resources:',
    '          requests:',
    '            storage: 2Gi',
    '---',
    'apiVersion: v1',
    'kind: Service',
    'metadata:',
    `  name: redis`,
    `  namespace: ${ns}`,
    'spec:',
    '  selector:',
    '    app: redis',
    '  ports:',
    '    - port: 6379',
    '      targetPort: 6379',
    '  clusterIP: None',
  ].join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// TenantProvisioner class
// ---------------------------------------------------------------------------

export class TenantProvisioner {
  constructor(private readonly logger: Logger) {}

  /**
   * Orchestrate full provisioning based on isolation tier.
   */
  async provisionTenant(tenant: Tenant): Promise<ProvisioningResult> {
    const ns = `tenant-${tenant.slug}`;
    const steps: ProvisioningStep[] = [];
    const tierCfg = getTierConfig(tenant.isolationTier);

    this.logger.info({ tenantId: tenant.id, tier: tenant.isolationTier, ns }, 'Starting tenant provisioning');

    // ---- dedicated-cluster: placeholder only ----
    if (tierCfg.dedicatedCluster) {
      this.logger.warn(
        { tenantId: tenant.id },
        'Dedicated-cluster tier selected — Terraform pipeline should be triggered (Phase 5). Falling back to namespace provisioning for now.',
      );
      steps.push({ name: 'terraform-trigger', success: true, durationMs: 0, error: 'Placeholder: Terraform pipeline not yet wired' });
    }

    // ---- Step 1: write manifests to a temp dir ----
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `tenant-${tenant.slug}-`));

    try {
      await fs.writeFile(path.join(tmpDir, 'namespace.yaml'), namespaceYaml(ns, tenant.id, tenant.slug));
      await fs.writeFile(path.join(tmpDir, 'rbac.yaml'), rbacYaml(ns, tenant.id));
      await fs.writeFile(path.join(tmpDir, 'network-policy.yaml'), networkPolicyYaml(ns));
      await fs.writeFile(path.join(tmpDir, 'resource-quota.yaml'), resourceQuotaYaml(ns, tenant.isolationTier, tenant.resourceQuotas.maxAgents));

      if (tierCfg.dedicatedDb) {
        await fs.writeFile(path.join(tmpDir, 'postgres-statefulset.yaml'), postgresStatefulSetYaml(ns));
      }
      if (tierCfg.dedicatedRedis) {
        await fs.writeFile(path.join(tmpDir, 'redis-statefulset.yaml'), redisStatefulSetYaml(ns));
      }

      await fs.writeFile(path.join(tmpDir, 'kustomization.yaml'), generateKustomization(tenant));

      // ---- Step 2: kubectl apply -k ----
      const { result: applyResult, durationMs: applyMs } = await timed(() =>
        runKubectl(['apply', '-k', tmpDir], this.logger),
      );
      steps.push({
        name: 'kubectl-apply',
        success: applyResult.code === 0,
        durationMs: applyMs,
        error: applyResult.code !== 0 ? applyResult.stderr : undefined,
      });

      if (applyResult.code !== 0) {
        this.logger.error({ stderr: applyResult.stderr }, 'kubectl apply failed');
        return { success: false, namespace: ns, dbConnectionString: '', steps };
      }

      // ---- Step 3 (dedicated-db): wait for Postgres ready, run migrations ----
      if (tierCfg.dedicatedDb) {
        const { result: waitResult, durationMs: waitMs } = await timed(() =>
          runKubectl(
            ['rollout', 'status', `statefulset/postgres`, '-n', ns, '--timeout=120s'],
            this.logger,
          ),
        );
        steps.push({
          name: 'wait-postgres-ready',
          success: waitResult.code === 0,
          durationMs: waitMs,
          error: waitResult.code !== 0 ? waitResult.stderr : undefined,
        });

        // Wait for Redis too
        const { result: waitRedis, durationMs: waitRedisMs } = await timed(() =>
          runKubectl(
            ['rollout', 'status', `statefulset/redis`, '-n', ns, '--timeout=60s'],
            this.logger,
          ),
        );
        steps.push({
          name: 'wait-redis-ready',
          success: waitRedis.code === 0,
          durationMs: waitRedisMs,
          error: waitRedis.code !== 0 ? waitRedis.stderr : undefined,
        });

        // Run Drizzle migrations on the dedicated Postgres (placeholder — needs drizzle-kit CLI)
        const dbUrl = getDbConnectionString(tenant);
        this.logger.info({ dbUrl: dbUrl.replace(/:[^@]+@/, ':***@') }, 'Dedicated DB ready — migrations should be run');
        steps.push({ name: 'drizzle-migrate', success: true, durationMs: 0, error: 'Placeholder: run drizzle-kit migrate against dedicated DB' });
      }

      this.logger.info({ tenantId: tenant.id, ns, stepsCount: steps.length }, 'Tenant provisioning complete');

      return {
        success: steps.every((s) => s.success),
        namespace: ns,
        dbConnectionString: getDbConnectionString(tenant),
        steps,
      };
    } finally {
      // Clean up temp dir
      await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Tear down tenant namespace (deprovisioning).
   */
  async deprovisionTenant(tenant: Pick<Tenant, 'id' | 'slug'>): Promise<ProvisioningStep> {
    const ns = `tenant-${tenant.slug}`;
    this.logger.info({ tenantId: tenant.id, ns }, 'Deprovisioning tenant namespace');

    const { result, durationMs } = await timed(() =>
      runKubectl(['delete', 'namespace', ns, '--ignore-not-found'], this.logger),
    );

    return {
      name: 'delete-namespace',
      success: result.code === 0,
      durationMs,
      error: result.code !== 0 ? result.stderr : undefined,
    };
  }
}
