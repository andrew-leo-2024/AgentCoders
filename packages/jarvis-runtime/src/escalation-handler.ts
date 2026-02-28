import type {
  Logger,
  EscalationMessage,
  ComplexityTier,
} from '@agentcoders/shared';
import { RedisChannels } from '@agentcoders/shared';
import { Redis } from 'ioredis';
import type { SquadManager } from './squad-manager.js';

export type EscalationResolution =
  | { action: 'reassigned'; toAgentId: string }
  | { action: 'retried'; agentId: string }
  | { action: 'reclassified'; newTier: ComplexityTier }
  | { action: 'escalated-to-human'; reason: string }
  | { action: 'deferred'; reason: string };

export class EscalationHandler {
  constructor(
    private readonly tenantId: string,
    private readonly squadManager: SquadManager,
    private readonly pub: Redis,
    private readonly telegramChatId: string,
    private readonly logger: Logger,
  ) {}

  async handle(escalation: EscalationMessage): Promise<EscalationResolution> {
    this.logger.info(
      {
        subType: escalation.subType,
        agentId: escalation.agentId,
        workItemId: escalation.workItemId,
        details: escalation.details,
      },
      'Handling escalation',
    );

    switch (escalation.subType) {
      case 'merge-conflict':
        return this.handleMergeConflict(escalation);
      case 'test-failure':
        return this.handleTestFailure(escalation);
      case 'timeout':
        return this.handleTimeout(escalation);
      case 'budget-exceeded':
        return this.handleBudgetExceeded(escalation);
      case 'blocked':
        return this.handleBlocked(escalation);
      case 'quality-issue':
        return this.handleBlocked(escalation); // Same flow as blocked for now
      default:
        this.logger.warn({ subType: escalation.subType }, 'Unknown escalation subType');
        return this.escalateToHuman(escalation, `Unknown escalation type: ${escalation.subType}`);
    }
  }

  private async handleMergeConflict(escalation: EscalationMessage): Promise<EscalationResolution> {
    const { agentId, workItemId } = escalation;

    // Try reassigning to a different agent first
    const idleAgents = this.squadManager.getIdleAgents();
    const otherAgent = idleAgents.find((a) => a.agentId !== agentId);

    if (otherAgent) {
      this.logger.info(
        { fromAgent: agentId, toAgent: otherAgent.agentId, workItemId },
        'Reassigning merge-conflict work item to different agent',
      );

      const result = await this.squadManager.assignWorkItem(
        workItemId,
        'M',
        otherAgent.vertical,
        'Previous agent encountered a merge conflict. Pull latest changes and retry.',
      );

      if (result.assigned) {
        return { action: 'reassigned', toAgentId: result.agentId };
      }
    }

    // No other agents available — defer
    this.logger.info({ workItemId }, 'Deferring merge-conflict — no other agents available');
    return { action: 'deferred', reason: 'Merge conflict, no alternative agents available — will retry later' };
  }

  private async handleTestFailure(escalation: EscalationMessage): Promise<EscalationResolution> {
    const { agentId, workItemId, details } = escalation;

    // Retry with feedback — send a new task assignment with the test failure details
    const agent = this.squadManager.getAgent(agentId);
    if (agent && agent.status === 'idle') {
      const feedbackInstructions = [
        'Your previous attempt failed tests. Here is the test output:',
        '',
        details,
        '',
        'Please fix the failing tests and ensure all tests pass before submitting.',
      ].join('\n');

      const result = await this.squadManager.assignWorkItem(
        workItemId,
        'M',
        agent.vertical,
        feedbackInstructions,
      );

      if (result.assigned) {
        this.logger.info({ agentId, workItemId }, 'Retried test-failure with feedback');
        return { action: 'retried', agentId: result.agentId };
      }
    }

    // Agent not idle — try a different agent
    const idleAgents = this.squadManager.getIdleAgents();
    if (idleAgents.length > 0) {
      const result = await this.squadManager.assignWorkItem(
        workItemId,
        'M',
        undefined,
        `Previous agent's tests failed: ${details}`,
      );

      if (result.assigned) {
        return { action: 'reassigned', toAgentId: result.agentId };
      }
    }

    return this.escalateToHuman(escalation, 'Test failure could not be resolved by AI agents');
  }

  private async handleTimeout(escalation: EscalationMessage): Promise<EscalationResolution> {
    const { workItemId } = escalation;

    // Reclassify to a higher complexity tier so it gets more time
    const currentTier = this.extractComplexityFromDetails(escalation.details);
    const upgradedTier = this.upgradeTier(currentTier);

    if (upgradedTier === currentTier) {
      // Already at XL — escalate to human
      return this.escalateToHuman(escalation, 'Work item timed out at XL complexity — requires human intervention');
    }

    this.logger.info(
      { workItemId, from: currentTier, to: upgradedTier },
      'Reclassifying timed-out work item to higher complexity',
    );

    // Retry with upgraded tier
    const result = await this.squadManager.assignWorkItem(
      workItemId,
      upgradedTier,
      undefined,
      `Previous attempt timed out at ${currentTier}. Reclassified to ${upgradedTier} — you have more time.`,
    );

    if (result.assigned) {
      return { action: 'reclassified', newTier: upgradedTier };
    }

    return { action: 'deferred', reason: 'No idle agents — will retry with upgraded complexity later' };
  }

  private async handleBudgetExceeded(escalation: EscalationMessage): Promise<EscalationResolution> {
    // Always notify human for budget issues
    await this.notifyHuman(
      `Budget Alert for agent \`${escalation.agentId}\`:\n\n${escalation.details}\n\nWork Item: #${escalation.workItemId}`,
    );

    return { action: 'escalated-to-human', reason: 'Budget exceeded — human notified via Telegram' };
  }

  private async handleBlocked(escalation: EscalationMessage): Promise<EscalationResolution> {
    const { workItemId, details } = escalation;

    // Attempt to analyze the blocker
    const isEnvironmentIssue = /missing.*env|secret|credential|permission|auth|access denied/i.test(details);
    const isDependencyIssue = /depend|package|module.*not found|import.*error/i.test(details);

    if (isEnvironmentIssue) {
      return this.escalateToHuman(escalation, 'Environment/credentials issue — requires human configuration');
    }

    if (isDependencyIssue) {
      // Try reassigning — a different agent pod might have the dependency
      const result = await this.squadManager.assignWorkItem(
        workItemId,
        'M',
        undefined,
        `Previous attempt blocked by dependency issue: ${details}. Try installing missing dependencies first.`,
      );

      if (result.assigned) {
        return { action: 'reassigned', toAgentId: result.agentId };
      }
    }

    // Unknown blocker — escalate
    return this.escalateToHuman(escalation, `Agent blocked: ${details}`);
  }

  private async escalateToHuman(
    escalation: EscalationMessage,
    reason: string,
  ): Promise<EscalationResolution> {
    const message = [
      `Escalation from agent \`${escalation.agentId}\`:`,
      ``,
      `**Type:** ${escalation.subType}`,
      `**Work Item:** #${escalation.workItemId}`,
      `**Details:** ${escalation.details}`,
      ``,
      `**Reason for escalation:** ${reason}`,
    ].join('\n');

    await this.notifyHuman(message);

    return { action: 'escalated-to-human', reason };
  }

  private async notifyHuman(text: string): Promise<void> {
    const channel = RedisChannels.telegramOutbound(this.tenantId);
    await this.pub.publish(
      channel,
      JSON.stringify({
        type: 'telegram-outbound',
        tenantId: this.tenantId,
        chatId: this.telegramChatId,
        text,
        timestamp: new Date().toISOString(),
      }),
    );

    this.logger.info('Human notified via Telegram');
  }

  private extractComplexityFromDetails(details: string): ComplexityTier {
    const match = details.match(/\b(XS|XL|[SMLXL])\b/);
    if (match) {
      const tier = match[1] as string;
      if (['XS', 'S', 'M', 'L', 'XL'].includes(tier)) {
        return tier as ComplexityTier;
      }
    }
    return 'M';
  }

  private upgradeTier(tier: ComplexityTier): ComplexityTier {
    const upgrades: Record<ComplexityTier, ComplexityTier> = {
      XS: 'S',
      S: 'M',
      M: 'L',
      L: 'XL',
      XL: 'XL', // Can't go higher
    };
    return upgrades[tier];
  }
}
