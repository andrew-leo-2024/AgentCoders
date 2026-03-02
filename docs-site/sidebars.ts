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
        'processes/sop-tenant-onboarding',
        'processes/sop-agent-operations',
        'processes/bpmn-diagrams',
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
        'infrastructure/e2e-integration',
      ],
    },
    {
      type: 'category',
      label: 'Platform Roadmap',
      items: [
        'roadmap/approach-v1',
        'roadmap/oss-discovery-prompt',
        'roadmap/oss-catalog-v1',
      ],
    },
    {
      type: 'category',
      label: 'Tenant Integration Guide',
      items: [
        'tenant-guide/overview',
        'tenant-guide/aineff-onboarding',
      ],
    },
    {
      type: 'category',
      label: 'Agent Context',
      items: [
        'agent-context/resume-prompt',
      ],
    },
  ],
};

export default sidebars;
