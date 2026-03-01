import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    'intro',
    'getting-started',
    {
      type: 'category',
      label: 'Architecture',
      items: [
        'architecture/overview',
        'architecture/multi-tenant-model',
        'architecture/tech-stack',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'packages/shared',
        'packages/agent-runtime',
        'packages/jarvis-runtime',
        'packages/telegram-gateway',
        'packages/billing-service',
        'packages/tenant-manager',
        'packages/dashboard',
        'packages/model-router',
        'packages/enhancement-layer',
        'packages/governance',
        'packages/agent-memory',
        'packages/skill-registry',
        'packages/management-models',
        'packages/scm-adapters',
      ],
    },
    {
      type: 'category',
      label: 'Business Processes',
      items: [
        'processes/agent-work-lifecycle',
        'processes/jarvis-orchestration',
        'processes/tenant-onboarding',
        'processes/billing-dwi-lifecycle',
        'processes/telegram-commands',
        'processes/escalation-flow',
      ],
    },
    {
      type: 'category',
      label: 'Infrastructure',
      items: [
        'infrastructure/database-schema',
        'infrastructure/redis-channels',
        'infrastructure/environment-variables',
        'infrastructure/deployment',
        'infrastructure/testing',
      ],
    },
  ],
};

export default sidebars;
