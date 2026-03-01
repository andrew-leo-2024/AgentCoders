import type { ScmProvider, ScmProviderConfig, ProjectManagement } from '@agentcoders/shared';
import { AdoScmAdapter } from './adapters/ado-adapter.js';
import { GitHubScmAdapter } from './adapters/github-adapter.js';
import { AdoProjectManagement } from './adapters/ado-pm.js';
import { GitHubProjectManagement } from './adapters/github-pm.js';

export { AdoScmAdapter } from './adapters/ado-adapter.js';
export { GitHubScmAdapter } from './adapters/github-adapter.js';
export { AdoProjectManagement } from './adapters/ado-pm.js';
export { GitHubProjectManagement } from './adapters/github-pm.js';
export type {
  ScmProvider,
  ScmProviderConfig,
  ScmProviderType,
  ScmWorkItem,
  ScmPullRequest,
  ProjectManagement,
} from './scm-interface.js';
export type {} from './pm-interface.js';

export function createScmAdapter(config: ScmProviderConfig): ScmProvider {
  switch (config.type) {
    case 'ado': {
      if (!config.orgUrl || !config.project || !config.pat) {
        throw new Error(
          'ADO SCM adapter requires orgUrl, project, and pat in config',
        );
      }
      return new AdoScmAdapter(config.orgUrl, config.project, config.pat);
    }
    case 'github': {
      if (!config.token || !config.owner || !config.repo) {
        throw new Error(
          'GitHub SCM adapter requires token, owner, and repo in config',
        );
      }
      return new GitHubScmAdapter(config.token, config.owner, config.repo);
    }
    default: {
      const _exhaustive: never = config.type;
      throw new Error(`Unknown SCM provider type: ${_exhaustive}`);
    }
  }
}

export function createProjectManagement(
  config: ScmProviderConfig,
): ProjectManagement {
  switch (config.type) {
    case 'ado': {
      if (!config.orgUrl || !config.project || !config.pat) {
        throw new Error(
          'ADO project management requires orgUrl, project, and pat in config',
        );
      }
      return new AdoProjectManagement(config.orgUrl, config.project, config.pat);
    }
    case 'github': {
      if (!config.token || !config.owner || !config.repo) {
        throw new Error(
          'GitHub project management requires token, owner, and repo in config',
        );
      }
      return new GitHubProjectManagement(config.token, config.owner, config.repo);
    }
    default: {
      const _exhaustive: never = config.type;
      throw new Error(`Unknown SCM provider type: ${_exhaustive}`);
    }
  }
}
