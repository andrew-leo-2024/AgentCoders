import type { SkillDefinition, McpServerConfig } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';

const logger = createLogger('skill-registry:packager');

export interface PodSkillConfig {
  skills: SkillDefinition[];
  mcpServers: McpServerConfig[];
  claudeFlags: string[];
}

export class SkillPackager {
  packageForPod(skills: SkillDefinition[], mcpServers: McpServerConfig[] = []): PodSkillConfig {
    const claudeFlags: string[] = [];

    if (mcpServers.length > 0) {
      const enabledServers = mcpServers.filter(s => s.enabled);
      for (const server of enabledServers) {
        claudeFlags.push('--mcp-config', JSON.stringify({
          name: server.name,
          url: server.url,
          tools: server.tools,
        }));
      }
    }

    logger.info({
      skillCount: skills.length,
      mcpServerCount: mcpServers.length,
      flagCount: claudeFlags.length,
    }, 'Pod skill config packaged');

    return { skills, mcpServers, claudeFlags };
  }
}
