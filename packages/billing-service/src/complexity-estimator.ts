import type { ComplexityTier } from '@agentcoders/shared';
import { COMPLEXITY_PRICING } from '@agentcoders/shared';
import { createLogger } from '@agentcoders/shared';

const logger = createLogger('complexity-estimator');

// Keyword heuristics — maps keywords to complexity tiers
const XS_KEYWORDS = ['typo', 'rename', 'label', 'color', 'text change', 'copy change', 'bump version', 'update readme'];
const S_KEYWORDS = ['add field', 'add column', 'fix bug', 'validation', 'unit test', 'simple endpoint', 'config change'];
const M_KEYWORDS = ['new endpoint', 'new component', 'refactor', 'migration', 'integration', 'crud', 'form', 'api route'];
const L_KEYWORDS = ['new service', 'authentication', 'authorization', 'database schema', 'workflow', 'pipeline', 'multi-step'];
const XL_KEYWORDS = ['architecture', 'microservice', 'real-time', 'event-driven', 'full redesign', 'cross-service', 'platform'];

function matchesKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

/**
 * Estimates the complexity tier of a work item based on heuristics.
 * Falls back to Claude Haiku API call for ambiguous cases.
 *
 * Pricing: XS=$5, S=$15, M=$50, L=$150, XL=$500
 */
export async function estimateComplexity(
  title: string,
  description: string,
  fileCount?: number,
  testCount?: number,
): Promise<{ tier: ComplexityTier; priceUsd: number; confidence: 'high' | 'medium' | 'low'; reason: string }> {
  const combined = `${title} ${description}`;

  // Score each tier by keyword matches
  const scores: Record<ComplexityTier, number> = {
    XS: matchesKeywords(combined, XS_KEYWORDS),
    S: matchesKeywords(combined, S_KEYWORDS),
    M: matchesKeywords(combined, M_KEYWORDS),
    L: matchesKeywords(combined, L_KEYWORDS),
    XL: matchesKeywords(combined, XL_KEYWORDS),
  };

  // Boost scores based on file and test counts
  if (fileCount !== undefined) {
    if (fileCount <= 1) scores.XS += 2;
    else if (fileCount <= 3) scores.S += 2;
    else if (fileCount <= 8) scores.M += 2;
    else if (fileCount <= 15) scores.L += 2;
    else scores.XL += 2;
  }

  if (testCount !== undefined) {
    if (testCount === 0) scores.XS += 1;
    else if (testCount <= 2) scores.S += 1;
    else if (testCount <= 5) scores.M += 1;
    else if (testCount <= 10) scores.L += 1;
    else scores.XL += 1;
  }

  // Description length heuristic
  const descLen = description.length;
  if (descLen < 50) scores.XS += 1;
  else if (descLen < 200) scores.S += 1;
  else if (descLen < 500) scores.M += 1;
  else if (descLen < 1500) scores.L += 1;
  else scores.XL += 1;

  // Find the top two tiers
  const sorted = (Object.entries(scores) as Array<[ComplexityTier, number]>)
    .sort((a, b) => b[1] - a[1]);
  const topScore = sorted[0]![1];
  const secondScore = sorted[1]![1];

  // If clear winner, return with high confidence
  if (topScore > 0 && topScore > secondScore + 1) {
    const tier = sorted[0]![0];
    return {
      tier,
      priceUsd: COMPLEXITY_PRICING[tier],
      confidence: 'high',
      reason: `Heuristic match: ${topScore} keyword/metric signals for ${tier}`,
    };
  }

  // Ambiguous — try Claude Haiku fallback
  if (process.env['ANTHROPIC_API_KEY']) {
    try {
      return await estimateWithClaude(title, description, fileCount, testCount);
    } catch (err) {
      logger.warn({ err }, 'Claude Haiku fallback failed, using heuristic result');
    }
  }

  // Default fallback: pick top scorer or M if no signals
  const tier = topScore > 0 ? sorted[0]![0] : 'M';
  return {
    tier,
    priceUsd: COMPLEXITY_PRICING[tier],
    confidence: topScore > 0 ? 'medium' : 'low',
    reason: topScore > 0
      ? `Ambiguous heuristic: top tier ${tier} with score ${topScore}`
      : 'No keyword signals — defaulting to M',
  };
}

async function estimateWithClaude(
  title: string,
  description: string,
  fileCount?: number,
  testCount?: number,
): Promise<{ tier: ComplexityTier; priceUsd: number; confidence: 'high' | 'medium' | 'low'; reason: string }> {
  const prompt = `You are a software complexity estimator. Given a work item, classify it into exactly one tier.

Tiers:
- XS: Trivial (typos, config tweaks, label changes). ~1 file, minutes of work.
- S: Small (simple bug fix, add validation, single endpoint). 1-3 files, <1 hour.
- M: Medium (new feature component, CRUD endpoint, refactoring). 3-8 files, 1-4 hours.
- L: Large (new service area, auth flow, multi-step workflow). 8-15 files, 4-12 hours.
- XL: Extra large (architecture change, cross-service redesign). 15+ files, days of work.

Work item:
Title: ${title}
Description: ${description}
${fileCount !== undefined ? `Estimated files: ${fileCount}` : ''}
${testCount !== undefined ? `Estimated tests: ${testCount}` : ''}

Respond with ONLY a JSON object: {"tier": "XS|S|M|L|XL", "reason": "brief explanation"}`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env['ANTHROPIC_API_KEY']!,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: string; text: string }>;
  };
  const text = data.content[0]?.text ?? '';
  const parsed = JSON.parse(text) as { tier: string; reason: string };

  const validTiers: ComplexityTier[] = ['XS', 'S', 'M', 'L', 'XL'];
  const tier = (validTiers.includes(parsed.tier as ComplexityTier) ? parsed.tier : 'M') as ComplexityTier;

  return {
    tier,
    priceUsd: COMPLEXITY_PRICING[tier],
    confidence: 'high',
    reason: `Claude Haiku: ${parsed.reason}`,
  };
}
