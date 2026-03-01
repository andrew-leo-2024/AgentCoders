import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('semantic-deduplicator');

interface ContentBlock {
  index: number;
  content: string;
  hash: string;
  type: 'text' | 'code' | 'heading';
}

export class SemanticDeduplicator implements EnhancementStage {
  readonly name = 'semantic-deduplicator';
  readonly type = 'codec' as const;

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info({ tenantId: context.tenantId }, 'Semantic deduplication executing');

    const blocks = this.splitIntoBlocks(input);
    const duplicates = this.findDuplicates(blocks);
    const nearDuplicates = this.findNearDuplicates(blocks);

    if (duplicates.length === 0 && nearDuplicates.length === 0) {
      return {
        content: input,
        modified: false,
        details: {
          blocksAnalyzed: blocks.length,
          duplicatesFound: 0,
          nearDuplicatesFound: 0,
          message: 'No duplicates detected',
        },
      };
    }

    // Remove exact duplicates, keep first occurrence
    const indicesToRemove = new Set<number>();
    for (const dup of duplicates) {
      // Keep the first, mark the rest for removal
      for (let i = 1; i < dup.indices.length; i++) {
        indicesToRemove.add(dup.indices[i]!);
      }
    }

    // For near-duplicates, merge by keeping the longer version
    for (const nearDup of nearDuplicates) {
      const blockA = blocks[nearDup.indexA];
      const blockB = blocks[nearDup.indexB];
      if (!blockA || !blockB) continue;

      // Keep whichever is longer (more complete)
      if (blockA.content.length >= blockB.content.length) {
        indicesToRemove.add(nearDup.indexB);
      } else {
        indicesToRemove.add(nearDup.indexA);
      }
    }

    // Reconstruct output without duplicates
    const deduplicatedBlocks = blocks.filter((_, i) => !indicesToRemove.has(i));
    const deduplicatedOutput = deduplicatedBlocks.map((b) => b.content).join('\n\n');

    logger.info(
      {
        originalBlocks: blocks.length,
        removedBlocks: indicesToRemove.size,
        duplicates: duplicates.length,
        nearDuplicates: nearDuplicates.length,
      },
      'Deduplication complete',
    );

    return {
      content: deduplicatedOutput,
      modified: true,
      details: {
        blocksAnalyzed: blocks.length,
        duplicatesFound: duplicates.length,
        nearDuplicatesFound: nearDuplicates.length,
        blocksRemoved: indicesToRemove.size,
        originalLength: input.length,
        deduplicatedLength: deduplicatedOutput.length,
        reductionPercent: Math.round((1 - deduplicatedOutput.length / input.length) * 100),
      },
    };
  }

  private splitIntoBlocks(input: string): ContentBlock[] {
    const blocks: ContentBlock[] = [];

    // Split by double newlines or code block boundaries
    const rawBlocks = input.split(/\n\n+/);

    for (let i = 0; i < rawBlocks.length; i++) {
      const content = rawBlocks[i]!.trim();
      if (content.length === 0) continue;

      let type: 'text' | 'code' | 'heading' = 'text';
      if (content.startsWith('```')) type = 'code';
      else if (/^#{1,6}\s/.test(content)) type = 'heading';

      blocks.push({
        index: i,
        content,
        hash: this.hashContent(content),
        type,
      });
    }

    return blocks;
  }

  private hashContent(content: string): string {
    // Simple hash based on normalized content
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

    // FNV-1a inspired hash
    let hash = 2166136261;
    for (let i = 0; i < normalized.length; i++) {
      hash ^= normalized.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16);
  }

  private findDuplicates(blocks: ContentBlock[]): Array<{ hash: string; indices: number[] }> {
    const hashMap = new Map<string, number[]>();

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i]!;
      const existing = hashMap.get(block.hash);
      if (existing) {
        existing.push(i);
      } else {
        hashMap.set(block.hash, [i]);
      }
    }

    return [...hashMap.entries()]
      .filter(([_, indices]) => indices.length > 1)
      .map(([hash, indices]) => ({ hash, indices }));
  }

  private findNearDuplicates(
    blocks: ContentBlock[],
  ): Array<{ indexA: number; indexB: number; similarity: number }> {
    const nearDups: Array<{ indexA: number; indexB: number; similarity: number }> = [];
    const similarityThreshold = 0.85;

    for (let i = 0; i < blocks.length; i++) {
      for (let j = i + 1; j < blocks.length; j++) {
        const blockA = blocks[i]!;
        const blockB = blocks[j]!;

        // Skip comparing different types
        if (blockA.type !== blockB.type) continue;

        // Skip very short blocks (would give false positives)
        if (blockA.content.length < 50 || blockB.content.length < 50) continue;

        // Skip if already exact duplicates
        if (blockA.hash === blockB.hash) continue;

        const similarity = this.computeSimilarity(blockA.content, blockB.content);
        if (similarity >= similarityThreshold) {
          nearDups.push({ indexA: i, indexB: j, similarity });
        }
      }
    }

    return nearDups;
  }

  private computeSimilarity(a: string, b: string): number {
    // Use token-based Jaccard similarity for efficiency
    const tokensA = this.tokenize(a);
    const tokensB = this.tokenize(b);

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    let intersection = 0;
    for (const token of setA) {
      if (setB.has(token)) intersection++;
    }

    const union = setA.size + setB.size - intersection;
    return union > 0 ? intersection / union : 0;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);
  }
}
