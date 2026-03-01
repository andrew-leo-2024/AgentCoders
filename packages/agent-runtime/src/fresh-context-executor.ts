import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger, type Logger } from '@agentcoders/shared';

export interface TaskContext {
  workItemId: number;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  codebaseNotes: string[];
  relevantFiles: string[];
}

export class FreshContextExecutor {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('agent:fresh-context');
  }

  async prepareContext(workDir: string, task: TaskContext): Promise<string> {
    const claudeDir = join(workDir, '.claude');
    await mkdir(claudeDir, { recursive: true });

    const content = this.buildTaskClaudeMd(task);
    const claudeMdPath = join(claudeDir, 'TASK.md');
    await writeFile(claudeMdPath, content, 'utf-8');

    this.logger.info({ workItemId: task.workItemId, path: claudeMdPath }, 'Fresh context prepared');
    return claudeMdPath;
  }

  private buildTaskClaudeMd(task: TaskContext): string {
    const lines: string[] = [
      `# Task: ${task.title}`,
      '',
      `Work Item: #${task.workItemId}`,
      '',
      '## Description',
      task.description,
      '',
    ];

    if (task.acceptanceCriteria.length > 0) {
      lines.push('## Acceptance Criteria');
      for (const criterion of task.acceptanceCriteria) {
        lines.push(`- [ ] ${criterion}`);
      }
      lines.push('');
    }

    if (task.codebaseNotes.length > 0) {
      lines.push('## Codebase Notes');
      for (const note of task.codebaseNotes) {
        lines.push(`- ${note}`);
      }
      lines.push('');
    }

    if (task.relevantFiles.length > 0) {
      lines.push('## Relevant Files');
      for (const file of task.relevantFiles) {
        lines.push(`- ${file}`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
