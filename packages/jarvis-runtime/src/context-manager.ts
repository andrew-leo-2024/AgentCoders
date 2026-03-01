import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger, type Logger } from '@agentcoders/shared';

export interface PlanningConfig {
  projectName: string;
  currentMilestone: string;
  completedTasks: string[];
  pendingTasks: string[];
  contextRotThreshold: number;
}

export class ContextManager {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('jarvis:context-manager');
  }

  async initializePlanning(workDir: string, config: PlanningConfig): Promise<void> {
    const planningDir = join(workDir, '.planning');
    await mkdir(planningDir, { recursive: true });

    const configPath = join(planningDir, 'config.json');
    await writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    this.logger.info({ workDir, project: config.projectName }, 'Planning context initialized');
  }

  async loadPlanningConfig(workDir: string): Promise<PlanningConfig | null> {
    try {
      const configPath = join(workDir, '.planning', 'config.json');
      const content = await readFile(configPath, 'utf-8');
      return JSON.parse(content) as PlanningConfig;
    } catch {
      return null;
    }
  }

  async updateProgress(workDir: string, completedTaskId: string): Promise<void> {
    const config = await this.loadPlanningConfig(workDir);
    if (!config) {
      this.logger.warn({ workDir }, 'No planning config found');
      return;
    }

    config.completedTasks.push(completedTaskId);
    config.pendingTasks = config.pendingTasks.filter(t => t !== completedTaskId);

    const planningDir = join(workDir, '.planning');
    await writeFile(join(planningDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');

    this.logger.info({ completedTaskId, remaining: config.pendingTasks.length }, 'Progress updated');
  }

  checkContextRot(config: PlanningConfig): boolean {
    const completionRatio = config.completedTasks.length /
      Math.max(config.completedTasks.length + config.pendingTasks.length, 1);
    return completionRatio > config.contextRotThreshold;
  }
}
