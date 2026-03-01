import { eq, and } from 'drizzle-orm';
import { getDb, skillScores } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import type { SkillScoreRecord } from '@agentcoders/shared';

const logger = createLogger('skill-registry:scorer');

export class SkillScorer {
  private db = getDb();

  async recordScore(tenantId: string, skillId: string, taskType: string, qualityDelta: number): Promise<void> {
    const [existing] = await this.db.select().from(skillScores)
      .where(and(
        eq(skillScores.tenantId, tenantId),
        eq(skillScores.skillId, skillId),
        eq(skillScores.taskType, taskType),
      ));

    if (existing) {
      const newCount = existing.sampleCount + 1;
      const newDelta = ((existing.qualityDelta * existing.sampleCount) + qualityDelta) / newCount;
      await this.db.update(skillScores)
        .set({ qualityDelta: newDelta, sampleCount: newCount, updatedAt: new Date() })
        .where(eq(skillScores.id, existing.id));
    } else {
      await this.db.insert(skillScores).values({
        tenantId,
        skillId,
        taskType,
        qualityDelta,
        sampleCount: 1,
      });
    }

    logger.debug({ skillId, taskType, qualityDelta }, 'Skill score recorded');
  }

  async getScores(tenantId: string, skillId: string): Promise<SkillScoreRecord[]> {
    const rows = await this.db.select().from(skillScores)
      .where(and(eq(skillScores.tenantId, tenantId), eq(skillScores.skillId, skillId)));
    return rows.map(r => ({
      id: r.id,
      tenantId: r.tenantId,
      skillId: r.skillId,
      taskType: r.taskType,
      qualityDelta: r.qualityDelta,
      sampleCount: r.sampleCount,
      updatedAt: r.updatedAt,
    }));
  }

  async getTopSkills(tenantId: string, taskType: string, limit = 5): Promise<SkillScoreRecord[]> {
    const rows = await this.db.select().from(skillScores)
      .where(and(eq(skillScores.tenantId, tenantId), eq(skillScores.taskType, taskType)));
    return rows
      .sort((a, b) => b.qualityDelta - a.qualityDelta)
      .slice(0, limit)
      .map(r => ({
        id: r.id,
        tenantId: r.tenantId,
        skillId: r.skillId,
        taskType: r.taskType,
        qualityDelta: r.qualityDelta,
        sampleCount: r.sampleCount,
        updatedAt: r.updatedAt,
      }));
  }
}
