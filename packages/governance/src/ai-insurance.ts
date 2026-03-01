import { eq, and } from 'drizzle-orm';
import {
  createLogger,
  getDb,
  insurancePolicies,
  insuranceClaims,
  type Database,
  type Logger,
  type InsurancePolicy,
  type InsuranceClaim,
  type InsurancePolicyType,
} from '@agentcoders/shared';

export class AIInsurance {
  private readonly db: Database;
  private readonly logger: Logger;

  constructor(db?: Database) {
    this.db = db ?? getDb();
    this.logger = createLogger('ai-insurance');
  }

  async createPolicy(
    tenantId: string,
    type: InsurancePolicyType,
    coverage: Record<string, unknown>,
    slaTargets: Record<string, number>,
    expiresAt: Date,
  ): Promise<InsurancePolicy> {
    const [inserted] = await this.db
      .insert(insurancePolicies)
      .values({
        tenantId,
        policyType: type,
        coverageDetails: coverage,
        slaTargets,
        status: 'active',
        activatedAt: new Date(),
        expiresAt,
      })
      .returning();

    const policy: InsurancePolicy = {
      id: inserted!.id,
      tenantId: inserted!.tenantId,
      policyType: inserted!.policyType,
      coverageDetails: (inserted!.coverageDetails ?? {}) as Record<string, unknown>,
      slaTargets: (inserted!.slaTargets ?? {}) as Record<string, number>,
      status: inserted!.status,
      activatedAt: inserted!.activatedAt,
      expiresAt: inserted!.expiresAt,
    };

    this.logger.info(
      { tenantId, policyId: policy.id, policyType: type },
      'Created insurance policy',
    );
    return policy;
  }

  async fileClaim(
    tenantId: string,
    policyId: string,
    incidentDetails: Record<string, unknown>,
  ): Promise<InsuranceClaim> {
    // Verify policy exists and is active
    const [policy] = await this.db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.id, policyId),
          eq(insurancePolicies.tenantId, tenantId),
        ),
      )
      .limit(1);

    if (!policy) {
      throw new Error(`Policy ${policyId} not found for tenant ${tenantId}`);
    }

    if (policy.status !== 'active') {
      throw new Error(`Policy ${policyId} is not active (status: ${policy.status})`);
    }

    // Mark policy as claimed
    await this.db
      .update(insurancePolicies)
      .set({ status: 'claimed' })
      .where(eq(insurancePolicies.id, policyId));

    // Insert claim
    const [inserted] = await this.db
      .insert(insuranceClaims)
      .values({
        tenantId,
        policyId,
        incidentDetails,
        createdAt: new Date(),
      })
      .returning();

    const claim: InsuranceClaim = {
      id: inserted!.id,
      tenantId: inserted!.tenantId,
      policyId: inserted!.policyId,
      incidentDetails: (inserted!.incidentDetails ?? {}) as Record<string, unknown>,
      resolution: inserted!.resolution ?? undefined,
      resolvedAt: inserted!.resolvedAt ?? undefined,
      createdAt: inserted!.createdAt,
    };

    this.logger.info(
      { tenantId, claimId: claim.id, policyId },
      'Filed insurance claim',
    );
    return claim;
  }

  async resolveClaim(claimId: string, resolution: string): Promise<void> {
    await this.db
      .update(insuranceClaims)
      .set({
        resolution,
        resolvedAt: new Date(),
      })
      .where(eq(insuranceClaims.id, claimId));

    this.logger.info({ claimId }, 'Resolved insurance claim');
  }

  async checkSlaCompliance(
    tenantId: string,
  ): Promise<{ compliant: boolean; violations: string[] }> {
    const policies = await this.getActivePolicies(tenantId);
    const violations: string[] = [];

    for (const policy of policies) {
      // Check if policy has expired
      if (policy.expiresAt < new Date()) {
        violations.push(
          `Policy ${policy.id} (${policy.policyType}) has expired at ${policy.expiresAt.toISOString()}`,
        );
        // Mark expired
        await this.db
          .update(insurancePolicies)
          .set({ status: 'expired' })
          .where(eq(insurancePolicies.id, policy.id));
        continue;
      }

      // Check SLA targets (compare actual vs target)
      const targets = policy.slaTargets;
      for (const [metric, targetValue] of Object.entries(targets)) {
        // SLA target checking requires telemetry data; here we flag policies
        // with targets that need monitoring. Full implementation would cross-reference
        // telemetry records.
        if (targetValue <= 0) {
          violations.push(
            `Policy ${policy.id}: SLA target '${metric}' has invalid value ${targetValue}`,
          );
        }
      }
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  async getActivePolicies(tenantId: string): Promise<InsurancePolicy[]> {
    const rows = await this.db
      .select()
      .from(insurancePolicies)
      .where(
        and(
          eq(insurancePolicies.tenantId, tenantId),
          eq(insurancePolicies.status, 'active'),
        ),
      );

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      policyType: row.policyType,
      coverageDetails: (row.coverageDetails ?? {}) as Record<string, unknown>,
      slaTargets: (row.slaTargets ?? {}) as Record<string, number>,
      status: row.status,
      activatedAt: row.activatedAt,
      expiresAt: row.expiresAt,
    }));
  }
}
