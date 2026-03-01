import {
  createLogger,
  type Logger,
  type AuthorityGrant,
} from '@agentcoders/shared';
import { getGovernanceConfig } from './config.js';

export class AuthorityDecay {
  private readonly grants: Map<string, AuthorityGrant[]> = new Map();
  private readonly logger: Logger;
  private decayTimer: ReturnType<typeof setInterval> | null = null;
  private readonly checkIntervalMs: number;

  constructor() {
    const config = getGovernanceConfig();
    this.logger = createLogger('authority-decay');
    this.checkIntervalMs = config.AUTHORITY_DECAY_CHECK_INTERVAL_MS;
  }

  start(): void {
    this.decayTimer = setInterval(() => {
      const revoked = this.revokeExpired();
      if (revoked > 0) {
        this.logger.info({ revoked }, 'Auto-revoked expired authority grants');
      }
    }, this.checkIntervalMs);
    this.logger.info({ checkIntervalMs: this.checkIntervalMs }, 'Authority decay started');
  }

  stop(): void {
    if (this.decayTimer) {
      clearInterval(this.decayTimer);
      this.decayTimer = null;
    }
    this.logger.info('Authority decay stopped');
  }

  grant(grant: AuthorityGrant): void {
    const key = grant.agentId;
    const existing = this.grants.get(key) ?? [];
    existing.push(grant);
    this.grants.set(key, existing);
    this.logger.info(
      {
        agentId: grant.agentId,
        scope: grant.scope,
        expiresAt: grant.expiresAt.toISOString(),
        grantedBy: grant.grantedBy,
      },
      'Authority granted',
    );
  }

  checkAuthority(agentId: string, scope: string): boolean {
    const agentGrants = this.grants.get(agentId);
    if (!agentGrants) return false;

    const now = new Date();
    return agentGrants.some(
      (g) => g.scope === scope && g.expiresAt > now,
    );
  }

  revokeExpired(): number {
    const now = new Date();
    let revokedCount = 0;

    for (const [agentId, agentGrants] of this.grants.entries()) {
      const active: AuthorityGrant[] = [];
      for (const g of agentGrants) {
        if (g.expiresAt <= now) {
          revokedCount++;
          this.logger.debug(
            { agentId: g.agentId, scope: g.scope },
            'Revoked expired grant',
          );
        } else {
          active.push(g);
        }
      }

      if (active.length === 0) {
        this.grants.delete(agentId);
      } else {
        this.grants.set(agentId, active);
      }
    }

    return revokedCount;
  }
}
