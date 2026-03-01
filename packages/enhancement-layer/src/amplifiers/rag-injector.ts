import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('rag-injector');

export class RagInjector implements EnhancementStage {
  readonly name = 'rag-injector';
  readonly type = 'amplifier' as const;

  private readonly maxChunks: number;
  private readonly similarityThreshold: number;

  constructor(maxChunks: number = 5, similarityThreshold: number = 0.7) {
    this.maxChunks = maxChunks;
    this.similarityThreshold = similarityThreshold;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, maxChunks: this.maxChunks },
      'RAG injection stage executing',
    );

    // Extract key terms from the input for query construction
    const queryTerms = this.extractQueryTerms(input);

    // In production, this would call a vector DB (e.g., Pinecone, Weaviate, pgvector)
    // For now, we simulate the RAG pipeline with metadata
    const simulatedChunks = this.simulateKnowledgeBaseQuery(queryTerms, context);

    if (simulatedChunks.length === 0) {
      logger.debug('No relevant knowledge chunks found');
      return {
        content: input,
        modified: false,
        details: {
          queryTerms,
          chunksRetrieved: 0,
          maxChunks: this.maxChunks,
          similarityThreshold: this.similarityThreshold,
          message: 'No relevant knowledge chunks found — passthrough',
        },
      };
    }

    // Prepend retrieved context to the input
    const contextBlock = simulatedChunks
      .map((chunk, i) => `[Knowledge Chunk ${i + 1}] (similarity: ${chunk.score.toFixed(2)})\n${chunk.content}`)
      .join('\n\n');

    const augmentedContent = `<retrieved-context>\n${contextBlock}\n</retrieved-context>\n\n${input}`;

    logger.info({ chunksInjected: simulatedChunks.length }, 'RAG context injected');

    return {
      content: augmentedContent,
      modified: true,
      details: {
        queryTerms,
        chunksRetrieved: simulatedChunks.length,
        maxChunks: this.maxChunks,
        similarityThreshold: this.similarityThreshold,
        chunkScores: simulatedChunks.map((c) => c.score),
      },
    };
  }

  private extractQueryTerms(input: string): string[] {
    // Extract meaningful terms: remove common stop words, keep identifiers and technical terms
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'shall', 'to', 'of', 'in', 'for',
      'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
      'not', 'no', 'this', 'that', 'these', 'those', 'it', 'its', 'i', 'me',
      'my', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them', 'their',
      'what', 'which', 'who', 'when', 'where', 'how', 'all', 'each', 'every',
      'both', 'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just', 'because', 'if', 'then',
    ]);

    const words = input
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));

    // Deduplicate and take top terms by frequency
    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }

    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term]) => term);
  }

  private simulateKnowledgeBaseQuery(
    queryTerms: string[],
    context: StageContext,
  ): Array<{ content: string; score: number }> {
    // Simulate vector DB results based on context
    // In production: embed queryTerms, search vector DB, return top-k chunks
    const workItemId = context.workItemId;
    const tenantId = context.tenantId;

    if (queryTerms.length === 0) {
      return [];
    }

    // Simulate that we found relevant context for this tenant/work item
    const chunks: Array<{ content: string; score: number }> = [];

    if (workItemId !== undefined) {
      chunks.push({
        content: `[Tenant ${tenantId} / Work Item #${workItemId}] Historical context: Previous implementations related to "${queryTerms.slice(0, 3).join(', ')}" found in knowledge base.`,
        score: 0.85,
      });
    }

    if (queryTerms.some((t) => ['api', 'endpoint', 'rest', 'graphql', 'route'].includes(t))) {
      chunks.push({
        content: `[API Patterns] Tenant coding standards require: error handling middleware, request validation with zod, response envelope pattern { data, error, meta }.`,
        score: 0.78,
      });
    }

    if (queryTerms.some((t) => ['test', 'testing', 'spec', 'unit', 'integration'].includes(t))) {
      chunks.push({
        content: `[Testing Standards] Use vitest for unit tests, arrange-act-assert pattern, mock external dependencies, minimum 80% coverage target.`,
        score: 0.82,
      });
    }

    // Filter by similarity threshold and limit to maxChunks
    return chunks
      .filter((c) => c.score >= this.similarityThreshold)
      .slice(0, this.maxChunks);
  }
}
