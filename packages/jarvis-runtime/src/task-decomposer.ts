import { spawn, type ChildProcess } from 'node:child_process';
import type {
  Logger,
  ComplexityTier,
  AdoWorkItem,
} from '@agentcoders/shared';
import { AdoFields } from '@agentcoders/shared';

export interface SubTask {
  title: string;
  description: string;
  complexityTier: ComplexityTier;
  acceptanceCriteria: string;
}

export interface DecomposeResult {
  parentWorkItemId: number;
  subTasks: SubTask[];
  childWorkItemIds: number[];
}

interface AdoClientLike {
  createWorkItem(type: string, operations: Array<{ op: string; path: string; value?: unknown }>): Promise<AdoWorkItem>;
  updateWorkItem(id: number, operations: Array<{ op: string; path: string; value?: unknown }>): Promise<AdoWorkItem>;
  addComment(workItemId: number, text: string): Promise<void>;
}

export class TaskDecomposer {
  constructor(
    private readonly adoClient: AdoClientLike,
    private readonly adoProject: string,
    private readonly logger: Logger,
  ) {}

  async decompose(workItem: {
    id: number;
    title: string;
    description: string;
    vertical: string;
  }): Promise<DecomposeResult> {
    this.logger.info(
      { workItemId: workItem.id, title: workItem.title },
      'Decomposing work item into sub-tasks',
    );

    // Use Claude Haiku to break work item into sub-tasks
    const subTasks = await this.analyzeAndDecompose(workItem);

    if (subTasks.length === 0) {
      this.logger.info({ workItemId: workItem.id }, 'No decomposition needed — single task');
      return {
        parentWorkItemId: workItem.id,
        subTasks: [],
        childWorkItemIds: [],
      };
    }

    // Create child work items in ADO
    const childWorkItemIds: number[] = [];

    for (const subTask of subTasks) {
      try {
        const childWi = await this.adoClient.createWorkItem('Task', [
          { op: 'add', path: `/fields/${AdoFields.Title}`, value: subTask.title },
          { op: 'add', path: `/fields/${AdoFields.Description}`, value: subTask.description },
          {
            op: 'add',
            path: `/fields/${AdoFields.AreaPath}`,
            value: `${this.adoProject}\\${workItem.vertical}`,
          },
          {
            op: 'add',
            path: `/fields/${AdoFields.Tags}`,
            value: `ai-decomposed,complexity:${subTask.complexityTier}`,
          },
          {
            op: 'add',
            path: `/fields/${AdoFields.Priority}`,
            value: this.complexityToPriority(subTask.complexityTier),
          },
        ]);

        childWorkItemIds.push(childWi.id);

        // Link child to parent
        await this.adoClient.updateWorkItem(workItem.id, [
          {
            op: 'add',
            path: '/relations/-',
            value: {
              rel: 'System.LinkTypes.Hierarchy-Forward',
              url: childWi.url,
              attributes: { comment: 'AI-decomposed sub-task' },
            },
          },
        ]);

        this.logger.info(
          { parentId: workItem.id, childId: childWi.id, title: subTask.title, complexity: subTask.complexityTier },
          'Created child work item',
        );
      } catch (err) {
        this.logger.error(
          { err, subTaskTitle: subTask.title },
          'Failed to create child work item',
        );
      }
    }

    // Add comment to parent work item
    const summary = subTasks
      .map((st, i) => `${i + 1}. **${st.title}** [${st.complexityTier}]`)
      .join('\n');

    await this.adoClient.addComment(
      workItem.id,
      `Jarvis decomposed this work item into ${subTasks.length} sub-tasks:\n\n${summary}`,
    );

    this.logger.info(
      { workItemId: workItem.id, subTaskCount: subTasks.length, childIds: childWorkItemIds },
      'Work item decomposed successfully',
    );

    return {
      parentWorkItemId: workItem.id,
      subTasks,
      childWorkItemIds,
    };
  }

  private async analyzeAndDecompose(workItem: {
    id: number;
    title: string;
    description: string;
  }): Promise<SubTask[]> {
    const prompt = `You are a senior engineering manager AI. Break down this work item into smaller, independent sub-tasks that can each be completed by a single AI coding agent.

## Work Item #${workItem.id}
**Title:** ${workItem.title}
**Description:** ${workItem.description}

## Rules
- Each sub-task must be independently implementable (no circular dependencies between sub-tasks)
- Each sub-task should have a clear, testable acceptance criteria
- Assign a complexity tier to each: XS (trivial fix, <5min), S (small, <15min), M (medium, <30min), L (large, <45min), XL (major, <60min)
- If the work item is already small enough (XS or S), return an empty array
- Maximum 8 sub-tasks
- Order sub-tasks by dependency (things that must be done first come first)

## Response Format
Respond ONLY with a JSON array (no markdown fencing):
[
  {
    "title": "Sub-task title",
    "description": "Detailed description of what to implement",
    "complexityTier": "XS"|"S"|"M"|"L"|"XL",
    "acceptanceCriteria": "What defines done for this sub-task"
  }
]

If no decomposition is needed, respond with: []`;

    const output = await this.callClaude(prompt);

    try {
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.logger.warn({ workItemId: workItem.id, output }, 'No JSON array in decomposition output');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as SubTask[];

      // Validate structure
      return parsed.filter((task) => {
        if (!task.title || !task.description || !task.complexityTier) {
          this.logger.warn({ task }, 'Invalid sub-task structure — skipping');
          return false;
        }
        const validTiers: ComplexityTier[] = ['XS', 'S', 'M', 'L', 'XL'];
        if (!validTiers.includes(task.complexityTier)) {
          task.complexityTier = 'M'; // Default
        }
        return true;
      });
    } catch (err) {
      this.logger.error({ err, output }, 'Failed to parse decomposition result');
      return [];
    }
  }

  private callClaude(prompt: string): Promise<string> {
    return new Promise((resolve) => {
      const args = [
        '-p', prompt,
        '--output-format', 'text',
        '--max-turns', '1',
        '--model', 'claude-haiku-4-5-20251001',
      ];

      const proc: ChildProcess = spawn('claude', args, {
        stdio: 'pipe',
      });

      let output = '';

      proc.stdout?.on('data', (data: Buffer) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data: Buffer) => {
        this.logger.debug({ stderr: data.toString() }, 'Claude stderr (decomposer)');
      });

      const timer = setTimeout(() => {
        proc.kill('SIGTERM');
      }, 120_000);

      proc.on('close', () => {
        clearTimeout(timer);
        resolve(output.trim());
      });

      proc.on('error', (err: Error) => {
        clearTimeout(timer);
        this.logger.error({ err }, 'Claude process error in decomposer');
        resolve('[]');
      });
    });
  }

  private complexityToPriority(tier: ComplexityTier): number {
    const map: Record<ComplexityTier, number> = {
      XS: 4,
      S: 3,
      M: 2,
      L: 2,
      XL: 1,
    };
    return map[tier];
  }
}
