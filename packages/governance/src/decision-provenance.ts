import { eq, and, desc } from 'drizzle-orm';
import {
  createLogger,
  getDb,
  decisionProvenance,
  type Database,
  type Logger,
  type DecisionProvenance,
} from '@agentcoders/shared';

export class DecisionProvenanceTracker {
  private readonly db: Database;
  private readonly logger: Logger;

  constructor(db?: Database) {
    this.db = db ?? getDb();
    this.logger = createLogger('decision-provenance');
  }

  async record(provenance: Omit<DecisionProvenance, 'id'>): Promise<void> {
    await this.db.insert(decisionProvenance).values({
      tenantId: provenance.tenantId,
      agentId: provenance.agentId,
      workItemId: provenance.workItemId,
      decisionType: provenance.decisionType,
      modelUsed: provenance.modelUsed,
      promptHash: provenance.promptHash,
      contextSources: provenance.contextSources,
      confidenceScore: provenance.confidenceScore,
    });

    this.logger.debug(
      {
        tenantId: provenance.tenantId,
        agentId: provenance.agentId,
        decisionType: provenance.decisionType,
      },
      'Recorded decision provenance',
    );
  }

  async trace(
    tenantId: string,
    workItemId: number,
  ): Promise<DecisionProvenance[]> {
    const rows = await this.db
      .select()
      .from(decisionProvenance)
      .where(
        and(
          eq(decisionProvenance.tenantId, tenantId),
          eq(decisionProvenance.workItemId, workItemId),
        ),
      )
      .orderBy(desc(decisionProvenance.createdAt));

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      agentId: row.agentId,
      workItemId: row.workItemId ?? undefined,
      decisionType: row.decisionType,
      modelUsed: row.modelUsed,
      promptHash: row.promptHash,
      contextSources: (row.contextSources ?? []) as string[],
      confidenceScore: row.confidenceScore,
    }));
  }

  async getByAgent(
    tenantId: string,
    agentId: string,
    limit?: number,
  ): Promise<DecisionProvenance[]> {
    const rows = await this.db
      .select()
      .from(decisionProvenance)
      .where(
        and(
          eq(decisionProvenance.tenantId, tenantId),
          eq(decisionProvenance.agentId, agentId),
        ),
      )
      .orderBy(desc(decisionProvenance.createdAt))
      .limit(limit ?? 50);

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      agentId: row.agentId,
      workItemId: row.workItemId ?? undefined,
      decisionType: row.decisionType,
      modelUsed: row.modelUsed,
      promptHash: row.promptHash,
      contextSources: (row.contextSources ?? []) as string[],
      confidenceScore: row.confidenceScore,
    }));
  }
}
