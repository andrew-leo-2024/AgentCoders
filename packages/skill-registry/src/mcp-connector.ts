import { createLogger } from '@agentcoders/shared';
import type { McpServerConfig } from '@agentcoders/shared';

const logger = createLogger('skill-registry:mcp');

export class McpConnector {
  private servers: Map<string, McpServerConfig> = new Map();

  register(config: McpServerConfig): void {
    this.servers.set(config.name, config);
    logger.info({ name: config.name, url: config.url, tools: config.tools }, 'MCP server registered');
  }

  unregister(name: string): void {
    this.servers.delete(name);
    logger.info({ name }, 'MCP server unregistered');
  }

  getEnabled(): McpServerConfig[] {
    return [...this.servers.values()].filter(s => s.enabled);
  }

  getByName(name: string): McpServerConfig | undefined {
    return this.servers.get(name);
  }

  async healthCheck(name: string): Promise<boolean> {
    const server = this.servers.get(name);
    if (!server || !server.enabled) return false;

    try {
      const response = await fetch(server.url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      return response.ok;
    } catch {
      logger.warn({ name, url: server.url }, 'MCP server health check failed');
      return false;
    }
  }

  buildMcpConfig(): Record<string, { url: string; tools: string[] }> {
    const config: Record<string, { url: string; tools: string[] }> = {};
    for (const server of this.getEnabled()) {
      config[server.name] = { url: server.url, tools: server.tools };
    }
    return config;
  }
}
