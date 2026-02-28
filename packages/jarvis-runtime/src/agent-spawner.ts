import { spawn, type ChildProcess } from 'node:child_process';
import type { Logger, VerticalType, AgentRole } from '@agentcoders/shared';

export interface SpawnAgentConfig {
  tenantId: string;
  namespace: string;
  image: string;
  envVars?: Record<string, string>;
  resourceLimits?: {
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  };
}

interface KubectlResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class AgentSpawner {
  constructor(
    private readonly namespace: string,
    private readonly logger: Logger,
  ) {}

  async spawnAgent(
    vertical: VerticalType,
    role: AgentRole,
    config: SpawnAgentConfig,
  ): Promise<{ agentId: string; deploymentName: string }> {
    const agentId = `${vertical}-${role}-${Date.now()}`;
    const deploymentName = `agent-${agentId}`;
    const image = config.image;

    const cpuRequest = config.resourceLimits?.cpuRequest ?? '250m';
    const cpuLimit = config.resourceLimits?.cpuLimit ?? '1000m';
    const memoryRequest = config.resourceLimits?.memoryRequest ?? '256Mi';
    const memoryLimit = config.resourceLimits?.memoryLimit ?? '1Gi';

    const envArgs = Object.entries(config.envVars ?? {})
      .map(([k, v]) => `--env=${k}=${v}`)
      .join(',');

    // Build the manifest YAML inline
    const manifest = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: deploymentName,
        namespace: config.namespace,
        labels: {
          app: 'agentcoders-agent',
          'agentcoders/tenant-id': config.tenantId,
          'agentcoders/vertical': vertical,
          'agentcoders/role': role,
          'agentcoders/agent-id': agentId,
        },
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            'agentcoders/agent-id': agentId,
          },
        },
        template: {
          metadata: {
            labels: {
              app: 'agentcoders-agent',
              'agentcoders/tenant-id': config.tenantId,
              'agentcoders/vertical': vertical,
              'agentcoders/role': role,
              'agentcoders/agent-id': agentId,
            },
          },
          spec: {
            containers: [
              {
                name: 'agent',
                image,
                env: [
                  { name: 'AGENT_ID', value: agentId },
                  { name: 'TENANT_ID', value: config.tenantId },
                  { name: 'AGENT_VERTICAL', value: vertical },
                  { name: 'AGENT_NAMESPACE', value: config.namespace },
                  ...Object.entries(config.envVars ?? {}).map(([k, v]) => ({
                    name: k,
                    value: v,
                  })),
                ],
                resources: {
                  requests: { cpu: cpuRequest, memory: memoryRequest },
                  limits: { cpu: cpuLimit, memory: memoryLimit },
                },
              },
            ],
          },
        },
      },
    };

    const manifestJson = JSON.stringify(manifest);

    this.logger.info(
      { agentId, deploymentName, vertical, role },
      'Spawning new agent deployment',
    );

    const result = await this.kubectl([
      'apply',
      '-f', '-',
    ], manifestJson);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to spawn agent ${agentId}: ${result.stderr}`);
    }

    this.logger.info({ agentId, deploymentName }, 'Agent deployment created');
    return { agentId, deploymentName };
  }

  async scaleAgents(vertical: VerticalType, count: number): Promise<void> {
    const labelSelector = `agentcoders/vertical=${vertical},app=agentcoders-agent`;

    this.logger.info({ vertical, count }, 'Scaling agent deployments');

    // Get all deployments for this vertical
    const listResult = await this.kubectl([
      'get', 'deployments',
      '-n', this.namespace,
      '-l', labelSelector,
      '-o', 'jsonpath={.items[*].metadata.name}',
    ]);

    if (listResult.exitCode !== 0) {
      throw new Error(`Failed to list deployments for vertical ${vertical}: ${listResult.stderr}`);
    }

    const deployments = listResult.stdout.trim().split(/\s+/).filter(Boolean);

    if (deployments.length === 0) {
      this.logger.warn({ vertical }, 'No deployments found for vertical — cannot scale');
      return;
    }

    // Scale each deployment
    for (const deployment of deployments) {
      const scaleResult = await this.kubectl([
        'scale', 'deployment', deployment,
        '-n', this.namespace,
        '--replicas', String(count),
      ]);

      if (scaleResult.exitCode !== 0) {
        this.logger.error(
          { deployment, stderr: scaleResult.stderr },
          'Failed to scale deployment',
        );
      } else {
        this.logger.info({ deployment, replicas: count }, 'Scaled deployment');
      }
    }
  }

  async removeAgent(agentId: string): Promise<void> {
    const labelSelector = `agentcoders/agent-id=${agentId}`;

    this.logger.info({ agentId }, 'Removing agent deployment');

    const result = await this.kubectl([
      'delete', 'deployment',
      '-n', this.namespace,
      '-l', labelSelector,
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to remove agent ${agentId}: ${result.stderr}`);
    }

    this.logger.info({ agentId }, 'Agent deployment removed');
  }

  async listAgents(vertical?: VerticalType): Promise<Array<{ agentId: string; deploymentName: string; replicas: number }>> {
    const labels = vertical
      ? `agentcoders/vertical=${vertical},app=agentcoders-agent`
      : 'app=agentcoders-agent';

    const result = await this.kubectl([
      'get', 'deployments',
      '-n', this.namespace,
      '-l', labels,
      '-o', 'json',
    ]);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to list agents: ${result.stderr}`);
    }

    try {
      const parsed = JSON.parse(result.stdout) as {
        items: Array<{
          metadata: { name: string; labels: Record<string, string> };
          spec: { replicas: number };
        }>;
      };

      return parsed.items.map((item) => ({
        agentId: item.metadata.labels['agentcoders/agent-id'] ?? 'unknown',
        deploymentName: item.metadata.name,
        replicas: item.spec.replicas,
      }));
    } catch {
      this.logger.error('Failed to parse kubectl output');
      return [];
    }
  }

  private kubectl(args: string[], stdin?: string): Promise<KubectlResult> {
    return new Promise((resolve) => {
      const proc: ChildProcess = spawn('kubectl', args, {
        stdio: 'pipe',
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      if (stdin && proc.stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      }

      proc.on('close', (code: number | null) => {
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 1,
        });
      });

      proc.on('error', (err: Error) => {
        resolve({
          stdout: '',
          stderr: err.message,
          exitCode: 1,
        });
      });
    });
  }
}
