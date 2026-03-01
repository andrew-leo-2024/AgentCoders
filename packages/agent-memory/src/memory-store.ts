import { eq, and, desc, like, lte } from 'drizzle-orm';
import { getDb, agentMemories } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';
import type { AgentMemoryEntry, MemoryCategory } from '@agentcoders/shared';

const logger = createLogger('agent-memory:store');

export class MemoryStore {
  private db: ReturnType<typeof getDb>;

  constructor(db?: ReturnType<typeof getDb>) {
    this.db = db ?? getDb();
  }

  async create(entry: Omit<AgentMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<AgentMemoryEntry> {
    const [result] = await this.db.insert(agentMemories).values({
      tenantId: entry.tenantId,
      agentId: entry.agentId,
      category: entry.category,
      key: entry.key,
      content: entry.content,
      relevanceScore: entry.relevanceScore,
      expiresAt: entry.expiresAt,
    }).returning();
    logger.info({ agentId: entry.agentId, key: entry.key, category: entry.category }, 'Memory created');
    return this.mapRow(result!);
  }

  async get(id: string): Promise<AgentMemoryEntry | null> {
    const [row] = await this.db.select().from(agentMemories).where(eq(agentMemories.id, id));
    return row ? this.mapRow(row) : null;
  }

  async getByAgent(tenantId: string, agentId: string, category?: MemoryCategory): Promise<AgentMemoryEntry[]> {
    const conditions = [
      eq(agentMemories.tenantId, tenantId),
      eq(agentMemories.agentId, agentId),
    ];
    if (category) {
      conditions.push(eq(agentMemories.category, category));
    }
    const rows = await this.db.select().from(agentMemories)
      .where(and(...conditions))
      .orderBy(desc(agentMemories.relevanceScore));
    return rows.map(r => this.mapRow(r));
  }

  async update(id: string, updates: Partial<Pick<AgentMemoryEntry, 'content' | 'relevanceScore' | 'category'>>): Promise<void> {
    await this.db.update(agentMemories)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(agentMemories.id, id));
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(agentMemories).where(eq(agentMemories.id, id));
  }

  async search(tenantId: string, agentId: string, query: string): Promise<AgentMemoryEntry[]> {
    const rows = await this.db.select().from(agentMemories)
      .where(and(
        eq(agentMemories.tenantId, tenantId),
        eq(agentMemories.agentId, agentId),
        like(agentMemories.key, `%${query}%`),
      ))
      .orderBy(desc(agentMemories.relevanceScore));
    return rows.map(r => this.mapRow(r));
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const expired = await this.db.delete(agentMemories)
      .where(and(
        lte(agentMemories.expiresAt, now),
      ))
      .returning();
    if (expired.length > 0) {
      logger.info({ count: expired.length }, 'Pruned expired memories');
    }
    return expired.length;
  }

  private mapRow(row: typeof agentMemories.$inferSelect): AgentMemoryEntry {
    return {
      id: row.id,
      tenantId: row.tenantId,
      agentId: row.agentId,
      category: row.category,
      key: row.key,
      content: row.content,
      relevanceScore: row.relevanceScore,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      expiresAt: row.expiresAt ?? undefined,
    };
  }
}
