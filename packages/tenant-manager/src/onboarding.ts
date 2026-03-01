/**
 * OnboardingService — self-serve signup flow.
 *
 * Two-phase launch: DB record created immediately, K8s infra provisioned async.
 */

import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import type { Database, Logger } from '@agentcoders/shared';
import type {
  IsolationTier,
  SubscriptionPlan,
  TenantAdoConfig,
  TenantTelegramConfig,
  ResourceQuotas,
  Tenant,
} from '@agentcoders/shared';
import { tenants } from '@agentcoders/shared';

import { TenantProvisioner, type ProvisioningResult } from './tenant-provisioner.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScmProviderType = 'ado' | 'github';
export type ManagementModelType = 'spotify' | 'safe' | 'scrum-at-scale' | 'team-topologies';

export interface SignupParams {
  name: string;
  slug: string;
  isolationTier?: IsolationTier;
  subscriptionPlan?: SubscriptionPlan;
  resourceQuotas?: Partial<ResourceQuotas>;
  scmProvider?: ScmProviderType;
  managementModel?: ManagementModelType;
}

export interface ProvisioningStatus {
  tenantId: string;
  status: string;
  provisioningResult: ProvisioningResult | null;
}

// ---------------------------------------------------------------------------
// In-memory provisioning status tracker (MVP — will move to Redis/DB later)
// ---------------------------------------------------------------------------

const provisioningStatus = new Map<string, ProvisioningStatus>();

// ---------------------------------------------------------------------------
// OnboardingService
// ---------------------------------------------------------------------------

export class OnboardingService {
  private readonly provisioner: TenantProvisioner;

  constructor(
    private readonly db: Database,
    private readonly logger: Logger,
  ) {
    this.provisioner = new TenantProvisioner(logger);
  }

  /**
   * Phase 1: create DB record immediately.
   * Phase 2: trigger infra provisioning async (does NOT block the response).
   */
  async createTenantFromSignup(params: SignupParams): Promise<Tenant> {
    this.logger.info({ params }, 'Creating tenant from signup');

    // Validate slug uniqueness
    const existing = await this.db.select().from(tenants).where(eq(tenants.slug, params.slug));
    if (existing.length > 0) {
      throw new Error(`Slug "${params.slug}" is already taken`);
    }

    // Validate slug format
    if (!/^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/.test(params.slug)) {
      throw new Error('Slug must be 3-64 chars, lowercase alphanumeric + hyphens, cannot start/end with hyphen');
    }

    const defaultQuotas: ResourceQuotas = {
      maxAgents: 5,
      maxConcurrentTasks: 3,
      dailyBudgetUsd: 100,
    };

    const id = randomUUID();
    const now = new Date();

    const record = {
      id,
      name: params.name,
      slug: params.slug,
      isolationTier: params.isolationTier ?? 'namespace' as const,
      subscriptionPlan: params.subscriptionPlan ?? 'starter' as const,
      status: 'provisioning' as const,
      resourceQuotas: { ...defaultQuotas, ...params.resourceQuotas },
      verticals: [],
      createdAt: now,
      updatedAt: now,
    };

    await this.db.insert(tenants).values(record);

    this.logger.info({ tenantId: id, slug: params.slug }, 'Tenant DB record created');

    // Construct a Tenant object for the provisioner
    const tenant: Tenant = {
      ...record,
      adoConfig: { orgUrl: '', project: '', pat: '' },
      telegramConfig: { botToken: '', ownerChatId: '' },
      billingConfig: { stripeCustomerId: '', stripeSubscriptionId: '' },
    };

    // Phase 2: kick off provisioning asynchronously
    provisioningStatus.set(id, { tenantId: id, status: 'provisioning', provisioningResult: null });

    this.provisioner
      .provisionTenant(tenant)
      .then(async (result) => {
        provisioningStatus.set(id, { tenantId: id, status: result.success ? 'active' : 'failed', provisioningResult: result });

        if (result.success) {
          await this.db
            .update(tenants)
            .set({ status: 'active', updatedAt: new Date() })
            .where(eq(tenants.id, id));
          this.logger.info({ tenantId: id }, 'Tenant provisioning succeeded — status set to active');
        } else {
          this.logger.error({ tenantId: id, steps: result.steps }, 'Tenant provisioning failed');
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        provisioningStatus.set(id, {
          tenantId: id,
          status: 'failed',
          provisioningResult: { success: false, namespace: '', dbConnectionString: '', steps: [{ name: 'provision', success: false, durationMs: 0, error: message }] },
        });
        this.logger.error({ tenantId: id, err: message }, 'Tenant provisioning threw');
      });

    return tenant;
  }

  /**
   * Connect Azure DevOps to the tenant.
   */
  async connectAdo(tenantId: string, adoConfig: TenantAdoConfig): Promise<void> {
    this.logger.info({ tenantId }, 'Connecting ADO');

    // Validate PAT is non-empty
    if (!adoConfig.pat || adoConfig.pat.trim().length === 0) {
      throw new Error('ADO PAT is required');
    }
    if (!adoConfig.orgUrl || !adoConfig.project) {
      throw new Error('ADO orgUrl and project are required');
    }

    // Basic PAT format check (ADO PATs are base64-ish, 52+ chars)
    if (adoConfig.pat.length < 40) {
      throw new Error('ADO PAT appears too short — expected 52+ characters');
    }

    await this.db
      .update(tenants)
      .set({ adoConfig, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    this.logger.info({ tenantId, orgUrl: adoConfig.orgUrl, project: adoConfig.project }, 'ADO connected');
  }

  /**
   * Connect Telegram bot to the tenant.
   */
  async connectTelegram(tenantId: string, telegramConfig: TenantTelegramConfig): Promise<void> {
    this.logger.info({ tenantId }, 'Connecting Telegram');

    // Validate bot token format: <number>:<alphanumeric>
    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(telegramConfig.botToken)) {
      throw new Error('Invalid Telegram bot token format (expected <number>:<token>)');
    }

    if (!telegramConfig.ownerChatId) {
      throw new Error('ownerChatId is required');
    }

    await this.db
      .update(tenants)
      .set({ telegramConfig, updatedAt: new Date() })
      .where(eq(tenants.id, tenantId));

    this.logger.info({ tenantId }, 'Telegram connected');
  }

  /**
   * Return current provisioning progress for a tenant.
   */
  async getProvisioningStatus(tenantId: string): Promise<ProvisioningStatus> {
    // Check in-memory tracker first
    const tracked = provisioningStatus.get(tenantId);
    if (tracked) return tracked;

    // Fall back to DB status
    const rows = await this.db.select().from(tenants).where(eq(tenants.id, tenantId));
    const tenant = rows[0];
    if (!tenant) throw new Error(`Tenant ${tenantId} not found`);

    return {
      tenantId,
      status: tenant.status,
      provisioningResult: null,
    };
  }
}
