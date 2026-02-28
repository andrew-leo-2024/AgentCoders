import type { Logger, RedisMessage } from '@agentcoders/shared';
import { RedisChannels } from '@agentcoders/shared';
import { Redis } from 'ioredis';
import type { SquadManager, TrackedAgent } from './squad-manager.js';

export interface FileConflict {
  filePath: string;
  agents: Array<{
    agentId: string;
    workItemId: number;
    priority: number;
  }>;
}

export interface ConflictResolution {
  conflictId: string;
  winner: { agentId: string; workItemId: number };
  losers: Array<{ agentId: string; workItemId: number; action: 'back-off' | 'defer' }>;
  reason: string;
}

export class ConflictResolver {
  private activeFiles = new Map<string, { agentId: string; workItemId: number; priority: number }>();

  constructor(
    private readonly tenantId: string,
    private readonly squadManager: SquadManager,
    private readonly pub: Redis,
    private readonly logger: Logger,
  ) {}

  registerFileAccess(agentId: string, workItemId: number, filePaths: string[], priority: number): FileConflict[] {
    const conflicts: FileConflict[] = [];

    for (const filePath of filePaths) {
      const existing = this.activeFiles.get(filePath);

      if (existing && existing.agentId !== agentId) {
        // Conflict detected
        conflicts.push({
          filePath,
          agents: [
            existing,
            { agentId, workItemId, priority },
          ],
        });
      }

      // Register or update the file access
      this.activeFiles.set(filePath, { agentId, workItemId, priority });
    }

    return conflicts;
  }

  releaseFiles(agentId: string): void {
    for (const [filePath, access] of this.activeFiles) {
      if (access.agentId === agentId) {
        this.activeFiles.delete(filePath);
      }
    }
  }

  async resolveConflicts(conflicts: FileConflict[]): Promise<ConflictResolution[]> {
    const resolutions: ConflictResolution[] = [];

    for (const conflict of conflicts) {
      const resolution = await this.resolveConflict(conflict);
      resolutions.push(resolution);
    }

    return resolutions;
  }

  private async resolveConflict(conflict: FileConflict): Promise<ConflictResolution> {
    const conflictId = `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Sort by priority — higher priority (lower number) wins
    const sorted = [...conflict.agents].sort((a, b) => a.priority - b.priority);
    const winner = sorted[0]!;
    const losers = sorted.slice(1);

    this.logger.info(
      {
        conflictId,
        filePath: conflict.filePath,
        winner: winner.agentId,
        losers: losers.map((l) => l.agentId),
      },
      'Resolving file conflict — higher priority WI wins',
    );

    // Update file ownership to winner
    this.activeFiles.set(conflict.filePath, winner);

    // Notify losers to back off
    const loserResults: ConflictResolution['losers'] = [];

    for (const loser of losers) {
      await this.notifyBackOff(loser.agentId, loser.workItemId, conflict.filePath, winner);
      loserResults.push({
        agentId: loser.agentId,
        workItemId: loser.workItemId,
        action: 'back-off',
      });
    }

    return {
      conflictId,
      winner: { agentId: winner.agentId, workItemId: winner.workItemId },
      losers: loserResults,
      reason: `Priority-based: WI #${winner.workItemId} (priority ${winner.priority}) wins over ${losers.map((l) => `WI #${l.workItemId}`).join(', ')}`,
    };
  }

  private async notifyBackOff(
    agentId: string,
    workItemId: number,
    filePath: string,
    winner: { agentId: string; workItemId: number },
  ): Promise<void> {
    // Find the agent's vertical for channel routing
    const agent = this.squadManager.getAgent(agentId);
    if (!agent) {
      this.logger.warn({ agentId }, 'Cannot notify agent — not tracked');
      return;
    }

    const channel = RedisChannels.vertical(this.tenantId, agent.vertical);
    const message: RedisMessage = {
      type: 'squad-chat',
      agentId: 'jarvis',
      tenantId: this.tenantId,
      content: [
        `CONFLICT RESOLUTION: Back off from file \`${filePath}\`.`,
        `Agent \`${winner.agentId}\` (WI #${winner.workItemId}) has higher priority.`,
        `Your WI #${workItemId} should avoid modifying this file.`,
      ].join('\n'),
      timestamp: new Date().toISOString(),
    };

    await this.pub.publish(channel, JSON.stringify(message));

    this.logger.info(
      { agentId, workItemId, filePath, winnerAgent: winner.agentId },
      'Notified agent to back off from conflicting file',
    );
  }

  getActiveConflicts(): FileConflict[] {
    const filesByMultipleAgents = new Map<string, FileConflict>();

    // Group files by path, find those with multiple agents
    for (const [filePath, access] of this.activeFiles) {
      const existing = filesByMultipleAgents.get(filePath);
      if (existing) {
        existing.agents.push(access);
      }
      // Single access — no conflict, skip
    }

    return Array.from(filesByMultipleAgents.values()).filter(
      (conflict) => conflict.agents.length > 1,
    );
  }

  getStats(): { trackedFiles: number; activeConflicts: number } {
    return {
      trackedFiles: this.activeFiles.size,
      activeConflicts: this.getActiveConflicts().length,
    };
  }
}
