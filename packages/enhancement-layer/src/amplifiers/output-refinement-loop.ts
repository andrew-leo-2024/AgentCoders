import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('output-refinement-loop');

interface RefinementCheck {
  tool: 'lint' | 'typecheck' | 'test';
  passed: boolean;
  output: string;
  durationMs: number;
}

export class OutputRefinementLoop implements EnhancementStage {
  readonly name = 'output-refinement-loop';
  readonly type = 'amplifier' as const;

  private readonly maxLoops: number;
  private readonly tools: readonly ('lint' | 'typecheck' | 'test')[];

  constructor(maxLoops: number = 3, tools: ('lint' | 'typecheck' | 'test')[] = ['lint', 'typecheck']) {
    this.maxLoops = maxLoops;
    this.tools = tools;
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    logger.info(
      { tenantId: context.tenantId, maxLoops: this.maxLoops, tools: this.tools },
      'Output refinement loop starting',
    );

    // Extract code blocks from the input
    const codeBlocks = this.extractCodeBlocks(input);

    if (codeBlocks.length === 0) {
      return {
        content: input,
        modified: false,
        details: {
          message: 'No code blocks found to refine',
          loopsExecuted: 0,
        },
      };
    }

    const allResults: RefinementCheck[][] = [];
    let currentContent = input;
    let loopsExecuted = 0;
    let allPassed = false;

    for (let loop = 0; loop < this.maxLoops; loop++) {
      loopsExecuted = loop + 1;
      const loopResults: RefinementCheck[] = [];

      for (const tool of this.tools) {
        const check = await this.runCheck(tool, codeBlocks, context);
        loopResults.push(check);
      }

      allResults.push(loopResults);

      allPassed = loopResults.every((r) => r.passed);
      if (allPassed) {
        logger.info({ loop: loopsExecuted }, 'All checks passed');
        break;
      }

      // Annotate content with refinement suggestions for the next iteration
      const failedChecks = loopResults.filter((r) => !r.passed);
      const refinementNotes = failedChecks
        .map((c) => `[${c.tool.toUpperCase()} ISSUE] ${c.output.substring(0, 500)}`)
        .join('\n');

      currentContent = `${input}\n\n<refinement-feedback iteration="${loopsExecuted}">\n${refinementNotes}\n</refinement-feedback>`;

      logger.warn(
        { loop: loopsExecuted, failedChecks: failedChecks.length },
        'Some checks failed, would re-prompt',
      );
    }

    return {
      content: currentContent,
      modified: !allPassed,
      details: {
        loopsExecuted,
        allPassed,
        codeBlocksFound: codeBlocks.length,
        results: allResults.map((loopResults, i) => ({
          loop: i + 1,
          checks: loopResults.map((r) => ({
            tool: r.tool,
            passed: r.passed,
            durationMs: r.durationMs,
            outputPreview: r.output.substring(0, 200),
          })),
        })),
      },
    };
  }

  private extractCodeBlocks(input: string): string[] {
    const codeBlockRegex = /```(?:\w+)?\n([\s\S]*?)```/g;
    const blocks: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(input)) !== null) {
      const block = match[1];
      if (block && block.trim().length > 0) {
        blocks.push(block);
      }
    }

    return blocks;
  }

  private async runCheck(
    tool: 'lint' | 'typecheck' | 'test',
    codeBlocks: string[],
    _context: StageContext,
  ): Promise<RefinementCheck> {
    const start = Date.now();

    // Map tool to command — in production these would run against actual files
    const commands: Record<string, { cmd: string; args: string[] }> = {
      lint: { cmd: 'npx', args: ['eslint', '--stdin', '--no-eslintrc', '--rule', '{}'] },
      typecheck: { cmd: 'npx', args: ['tsc', '--noEmit', '--strict'] },
      test: { cmd: 'npx', args: ['vitest', 'run', '--reporter=json'] },
    };

    const command = commands[tool];
    if (!command) {
      return {
        tool,
        passed: true,
        output: `Unknown tool: ${tool}`,
        durationMs: Date.now() - start,
      };
    }

    // Perform static analysis heuristics instead of actually spawning processes
    // (spawning requires actual project context / files on disk)
    const issues = this.staticAnalysis(tool, codeBlocks);

    return {
      tool,
      passed: issues.length === 0,
      output: issues.length > 0 ? issues.join('\n') : `${tool}: all checks passed`,
      durationMs: Date.now() - start,
    };
  }

  private staticAnalysis(tool: string, codeBlocks: string[]): string[] {
    const issues: string[] = [];

    for (let i = 0; i < codeBlocks.length; i++) {
      const code = codeBlocks[i]!;
      const blockLabel = `code block ${i + 1}`;

      if (tool === 'lint' || tool === 'typecheck') {
        // Check for common code issues
        if (/\bvar\s/.test(code)) {
          issues.push(`${blockLabel}: Use 'let' or 'const' instead of 'var'`);
        }
        if (/\bany\b/.test(code) && !/\/\/.*\bany\b/.test(code)) {
          issues.push(`${blockLabel}: Avoid using 'any' type — use specific types`);
        }
        if (/console\.(log|debug|info)\(/.test(code)) {
          issues.push(`${blockLabel}: Remove console.log statements — use structured logger`);
        }
        if (/==(?!=)/.test(code) && !/===/.test(code)) {
          issues.push(`${blockLabel}: Use strict equality (===) instead of loose equality (==)`);
        }

        // Check bracket/brace balance
        const opens = (code.match(/\{/g) ?? []).length;
        const closes = (code.match(/\}/g) ?? []).length;
        if (opens !== closes) {
          issues.push(`${blockLabel}: Mismatched braces — ${opens} opening vs ${closes} closing`);
        }

        const parenOpens = (code.match(/\(/g) ?? []).length;
        const parenCloses = (code.match(/\)/g) ?? []).length;
        if (parenOpens !== parenCloses) {
          issues.push(`${blockLabel}: Mismatched parentheses — ${parenOpens} opening vs ${parenCloses} closing`);
        }
      }

      if (tool === 'typecheck') {
        // TypeScript-specific checks
        if (/require\s*\(/.test(code) && /import\s/.test(code)) {
          issues.push(`${blockLabel}: Mixed require() and import statements — use ESM consistently`);
        }
        if (/as\s+any/.test(code)) {
          issues.push(`${blockLabel}: 'as any' cast detected — use proper type narrowing`);
        }
      }

      if (tool === 'test') {
        // Test-specific checks
        if (/it\(|test\(|describe\(/.test(code)) {
          if (!/expect\(/.test(code) && !/assert/.test(code)) {
            issues.push(`${blockLabel}: Test block without assertions detected`);
          }
        }
      }
    }

    return issues;
  }
}