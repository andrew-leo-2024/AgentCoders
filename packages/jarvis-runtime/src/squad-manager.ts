import type {
  Logger,
  AgentStatus,
  HeartbeatMessage,
  TaskAssignmentMessage,
  ComplexityTier,
  RedisMessage,
} from '@agentcoders/shared';
import { RedisChannels } from '@agentcoders/shared';
import { Redis } from 'ioredis';

export interface TrackedAgent {
  agentId: string;
  vertical: string;
  status: AgentStatus;
  currentWorkItemId: number | null;
  lastHeartbeatAt: Date;
  workItemsCompleted: number;
}

export interface AssignmentResult {
  agentId: string;
  workItemId: number;
  assigned: boolean;
  reason?: string;
}

export class SquadManager {
  private agents = new Map<string, TrackedAgent>();
  private stuckCheckTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly tenantId: string,
    private readonly pollIntervalMs: number,
    private readonly pub: Redis,
    private readonly logger: Logger,
  ) {}

  start(): void {
    // Check for stuck agents every 2x poll interval
    const checkIntervalMs = this.pollIntervalMs * 2;
    this.stuckCheckTimer = setInterval(() => {
      this.detectStuckAgents();
    }, checkIntervalMs);

    this.logger.info(
      { checkIntervalMs, pollIntervalMs: this.pollIntervalMs },
      'Squad manager started — monitoring agent heartbeats',
    );
  }

  stop(): void {
    if (this.stuckCheckTimer) {
      clearInterval(this.stuckCheckTimer);
      this.stuckCheckTimer = null;
    }
  }

  handleHeartbeat(msg: HeartbeatMessage): void {
    const existing = this.agents.get(msg.agentId);

    if (existing) {
      existing.status = msg.status;
      existing.currentWorkItemId = msg.currentWorkItemId ?? null;
      existing.lastHeartbeatAt = new Date(msg.timestamp);

      if (msg.status === 'idle' && existing.status === 'working') {
        existing.workItemsCompleted++;
      }
    } else {
      this.agents.set(msg.agentId, {
        agentId: msg.agentId,
        vertical: this.extractVertical(msg.agentId),
        status: msg.status,
        currentWorkItemId: msg.currentWorkItemId ?? null,
        lastHeartbeatAt: new Date(msg.timestamp),
        workItemsCompleted: 0,
      });
      this.logger.info({ agentId: msg.agentId, status: msg.status }, 'New agent registered');
    }
  }

  async assignWorkItem(
    workItemId: number,
    complexityTier: ComplexityTier,
    vertical?: string,
    instructions?: string,
  ): Promise<AssignmentResult> {
    // Find best available agent via load balancing
    const candidates = this.getIdleAgents(vertical);

    if (candidates.length === 0) {
      this.logger.warn(
        { workItemId, vertical },
        'No idle agents available for assignment',
      );
      return {
        agentId: '',
        workItemId,
        assigned: false,
        reason: 'No idle agents available',
      };
    }

    // Load balance: pick agent with fewest completed items (least busy overall)
    const sorted = candidates.sort((a, b) => a.workItemsCompleted - b.workItemsCompleted);
    const chosen = sorted[0]!;

    // Send task assignment via Redis
    const assignment: TaskAssignmentMessage = {
      type: 'task-assignment',
      targetAgentId: chosen.agentId,
      tenantId: this.tenantId,
      workItemId,
      complexityTier,
      instructions,
      timestamp: new Date().toISOString(),
    };

    const channel = RedisChannels.vertical(this.tenantId, chosen.vertical);
    await this.pub.publish(channel, JSON.stringify(assignment));

    // Update tracked state
    chosen.status = 'working';
    chosen.currentWorkItemId = workItemId;

    this.logger.info(
      { agentId: chosen.agentId, workItemId, complexityTier, vertical: chosen.vertical },
      'Assigned work item to agent',
    );

    return {
      agentId: chosen.agentId,
      workItemId,
      assigned: true,
    };
  }

  getIdleAgents(vertical?: string): TrackedAgent[] {
    const agents = Array.from(this.agents.values());
    return agents.filter((a) => {
      if (a.status !== 'idle') return false;
      if (vertical && a.vertical !== vertical) return false;
      return true;
    });
  }

  getWorkingAgents(vertical?: string): TrackedAgent[] {
    const agents = Array.from(this.agents.values());
    return agents.filter((a) => {
      if (a.status !== 'working') return false;
      if (vertical && a.vertical !== vertical) return false;
      return true;
    });
  }

  getAllAgents(): TrackedAgent[] {
    return Array.from(this.agents.values());
  }

  getAgent(agentId: string): TrackedAgent | undefined {
    return this.agents.get(agentId);
  }

  getStuckAgents(): TrackedAgent[] {
    const staleThresholdMs = this.pollIntervalMs * 2;
    const now = Date.now();

    return Array.from(this.agents.values()).filter((agent) => {
      if (agent.status === 'offline') return false;
      const timeSinceHeartbeat = now - agent.lastHeartbeatAt.getTime();
      return timeSinceHeartbeat > staleThresholdMs;
    });
  }

  async reassignWork(fromAgentId: string, reason: string): Promise<void> {
    const agent = this.agents.get(fromAgentId);
    if (!agent || !agent.currentWorkItemId) {
      this.logger.warn({ fromAgentId }, 'Cannot reassign — agent not found or no active work item');
      return;
    }

    const workItemId = agent.currentWorkItemId;

    // Mark agent as offline
    agent.status = 'offline';
    agent.currentWorkItemId = null;

    this.logger.info(
      { fromAgentId, workItemId, reason },
      'Reassigning work from stuck agent',
    );

    // Try to find another idle agent in the same vertical
    const result = await this.assignWorkItem(workItemId, 'M', agent.vertical);

    if (!result.assigned) {
      this.logger.warn(
        { workItemId, reason },
        'Could not reassign work item — no idle agents in vertical',
      );
    }
  }

  getStats(): {
    totalAgents: number;
    idleAgents: number;
    workingAgents: number;
    stuckAgents: number;
    offlineAgents: number;
  } {
    const agents = Array.from(this.agents.values());
    return {
      totalAgents: agents.length,
      idleAgents: agents.filter((a) => a.status === 'idle').length,
      workingAgents: agents.filter((a) => a.status === 'working').length,
      stuckAgents: this.getStuckAgents().length,
      offlineAgents: agents.filter((a) => a.status === 'offline').length,
    };
  }

  private detectStuckAgents(): void {
    const stuck = this.getStuckAgents();

    if (stuck.length === 0) return;

    this.logger.warn(
      { stuckCount: stuck.length, agentIds: stuck.map((a) => a.agentId) },
      'Detected stuck agents',
    );

    for (const agent of stuck) {
      void this.reassignWork(agent.agentId, 'No heartbeat received within threshold');
    }
  }

  private extractVertical(agentId: string): string {
    // Convention: agentId is "{vertical}-{role}-{timestamp}"
    const parts = agentId.split('-');
    return parts[0] ?? 'unknown';
  }
}
