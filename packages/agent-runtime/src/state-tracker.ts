import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger, type Logger } from '@agentcoders/shared';

export interface TaskState {
  workItemId: number;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  branch?: string;
  filesChanged: string[];
  error?: string;
}

export class StateTracker {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('agent:state-tracker');
  }

  async saveState(workDir: string, state: TaskState): Promise<void> {
    const planningDir = join(workDir, '.planning');
    await mkdir(planningDir, { recursive: true });

    const statePath = join(planningDir, `task-${state.workItemId}.json`);
    await writeFile(statePath, JSON.stringify(state, null, 2), 'utf-8');

    this.logger.debug({ workItemId: state.workItemId, status: state.status }, 'State saved');
  }

  async loadState(workDir: string, workItemId: number): Promise<TaskState | null> {
    try {
      const statePath = join(workDir, '.planning', `task-${workItemId}.json`);
      const content = await readFile(statePath, 'utf-8');
      return JSON.parse(content) as TaskState;
    } catch {
      return null;
    }
  }

  async markInProgress(workDir: string, workItemId: number, branch: string): Promise<void> {
    await this.saveState(workDir, {
      workItemId,
      status: 'in-progress',
      startedAt: new Date().toISOString(),
      branch,
      filesChanged: [],
    });
  }

  async markCompleted(workDir: string, workItemId: number, filesChanged: string[]): Promise<void> {
    const existing = await this.loadState(workDir, workItemId);
    await this.saveState(workDir, {
      workItemId,
      status: 'completed',
      startedAt: existing?.startedAt,
      completedAt: new Date().toISOString(),
      branch: existing?.branch,
      filesChanged,
    });
  }

  async markFailed(workDir: string, workItemId: number, error: string): Promise<void> {
    const existing = await this.loadState(workDir, workItemId);
    await this.saveState(workDir, {
      workItemId,
      status: 'failed',
      startedAt: existing?.startedAt,
      completedAt: new Date().toISOString(),
      branch: existing?.branch,
      filesChanged: existing?.filesChanged ?? [],
      error,
    });
  }
}
