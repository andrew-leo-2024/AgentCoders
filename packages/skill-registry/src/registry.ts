import { eq, and } from 'drizzle-orm';
import { getDb, skills, agentSkills } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import type { SkillDefinition, SkillCategory } from '@agentcoders/shared';

const logger = createLogger('skill-registry');

export class SkillRegistry {
  private db = getDb();

  async register(skill: Omit<SkillDefinition, 'id' | 'createdAt'>): Promise<SkillDefinition> {
    const [result] = await this.db.insert(skills).values({
      name: skill.name,
      category: skill.category,
      version: skill.version,
      description: skill.description,
      content: skill.content,
      isBuiltin: skill.isBuiltin,
    }).returning();
    logger.info({ name: skill.name, category: skill.category }, 'Skill registered');
    return this.mapRow(result!);
  }

  async getAll(category?: SkillCategory): Promise<SkillDefinition[]> {
    if (category) {
      const rows = await this.db.select().from(skills).where(eq(skills.category, category));
      return rows.map(r => this.mapRow(r));
    }
    const rows = await this.db.select().from(skills);
    return rows.map(r => this.mapRow(r));
  }

  async getByName(name: string): Promise<SkillDefinition | null> {
    const [row] = await this.db.select().from(skills).where(eq(skills.name, name));
    return row ? this.mapRow(row) : null;
  }

  async getById(id: string): Promise<SkillDefinition | null> {
    const [row] = await this.db.select().from(skills).where(eq(skills.id, id));
    return row ? this.mapRow(row) : null;
  }

  async activateForAgent(tenantId: string, agentId: string, skillId: string): Promise<void> {
    await this.db.insert(agentSkills).values({ tenantId, agentId, skillId });
    logger.info({ agentId, skillId }, 'Skill activated for agent');
  }

  async deactivateForAgent(tenantId: string, agentId: string, skillId: string): Promise<void> {
    await this.db.delete(agentSkills).where(
      and(
        eq(agentSkills.tenantId, tenantId),
        eq(agentSkills.agentId, agentId),
        eq(agentSkills.skillId, skillId),
      ),
    );
  }

  async getAgentSkills(tenantId: string, agentId: string): Promise<SkillDefinition[]> {
    const links = await this.db.select().from(agentSkills)
      .where(and(eq(agentSkills.tenantId, tenantId), eq(agentSkills.agentId, agentId)));
    const skillDefs: SkillDefinition[] = [];
    for (const link of links) {
      const skill = await this.getById(link.skillId);
      if (skill) skillDefs.push(skill);
    }
    return skillDefs;
  }

  private mapRow(row: typeof skills.$inferSelect): SkillDefinition {
    return {
      id: row.id,
      name: row.name,
      category: row.category,
      version: row.version,
      description: row.description,
      content: row.content,
      isBuiltin: row.isBuiltin,
      createdAt: row.createdAt,
    };
  }
}
