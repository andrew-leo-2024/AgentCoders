import { createLogger, type Logger } from '@agentcoders/shared';

export interface GsdSpec {
  projectName: string;
  description: string;
  milestones: GsdMilestone[];
}

export interface GsdMilestone {
  id: string;
  name: string;
  description: string;
  tasks: GsdTask[];
  order: number;
}

export interface GsdTask {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string[];
  dependencies: string[];
  estimatedComplexity: 'XS' | 'S' | 'M' | 'L' | 'XL';
}

export class GsdPlanner {
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('jarvis:gsd-planner');
  }

  analyzeProject(epicTitle: string, epicDescription: string): GsdSpec {
    this.logger.info({ epicTitle }, 'Analyzing project for GSD decomposition');

    const spec: GsdSpec = {
      projectName: epicTitle,
      description: epicDescription,
      milestones: [],
    };

    // GSD pattern: decompose into milestones → atomic tasks
    const sections = this.extractSections(epicDescription);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]!;
      const milestone: GsdMilestone = {
        id: `ms-${i + 1}`,
        name: section.title,
        description: section.content,
        order: i + 1,
        tasks: this.decomposeMilestone(section, i),
      };
      spec.milestones.push(milestone);
    }

    this.logger.info({
      milestones: spec.milestones.length,
      totalTasks: spec.milestones.reduce((sum, ms) => sum + ms.tasks.length, 0),
    }, 'GSD spec generated');

    return spec;
  }

  private extractSections(description: string): Array<{ title: string; content: string }> {
    const lines = description.split('\n');
    const sections: Array<{ title: string; content: string }> = [];
    let currentTitle = 'Main';
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('## ') || line.startsWith('# ')) {
        if (currentContent.length > 0) {
          sections.push({ title: currentTitle, content: currentContent.join('\n') });
        }
        currentTitle = line.replace(/^#+\s*/, '');
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }
    if (currentContent.length > 0) {
      sections.push({ title: currentTitle, content: currentContent.join('\n') });
    }

    return sections.length > 0 ? sections : [{ title: 'Main', content: description }];
  }

  private decomposeMilestone(section: { title: string; content: string }, milestoneIdx: number): GsdTask[] {
    const tasks: GsdTask[] = [];
    const bulletPoints = section.content.split('\n').filter(l => l.trim().startsWith('- ') || l.trim().startsWith('* '));

    if (bulletPoints.length > 0) {
      for (let i = 0; i < bulletPoints.length; i++) {
        const point = bulletPoints[i]!.replace(/^[\s\-\*]+/, '').trim();
        tasks.push({
          id: `task-${milestoneIdx + 1}-${i + 1}`,
          title: point,
          description: `Implement: ${point}`,
          acceptanceCriteria: [`${point} is implemented and working`],
          dependencies: i > 0 ? [`task-${milestoneIdx + 1}-${i}`] : [],
          estimatedComplexity: this.estimateComplexity(point),
        });
      }
    } else {
      tasks.push({
        id: `task-${milestoneIdx + 1}-1`,
        title: section.title,
        description: section.content,
        acceptanceCriteria: [`${section.title} is complete`],
        dependencies: [],
        estimatedComplexity: 'M',
      });
    }

    return tasks;
  }

  private estimateComplexity(text: string): 'XS' | 'S' | 'M' | 'L' | 'XL' {
    const lower = text.toLowerCase();
    if (lower.includes('refactor') || lower.includes('redesign') || lower.includes('migrate')) return 'XL';
    if (lower.includes('implement') || lower.includes('create') || lower.includes('build')) return 'L';
    if (lower.includes('add') || lower.includes('integrate')) return 'M';
    if (lower.includes('update') || lower.includes('fix')) return 'S';
    return 'M';
  }
}
