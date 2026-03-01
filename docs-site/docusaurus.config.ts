import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'AgentCoders',
  tagline: 'Autonomous AI Development Teams for Rent',
  favicon: 'img/favicon.ico',

  url: 'https://andrew-leo-2024.github.io',
  baseUrl: '/AgentCoders/',

  organizationName: 'andrew-leo-2024',
  projectName: 'AgentCoders',
  trailingSlash: false,

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: 'AgentCoders',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Documentation',
        },
        {
          href: 'https://github.com/agentcoders/agentcoders',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Documentation',
          items: [
            { label: 'Getting Started', to: '/getting-started' },
            { label: 'Architecture', to: '/architecture/overview' },
            { label: 'Packages', to: '/packages/shared' },
          ],
        },
        {
          title: 'Operations',
          items: [
            { label: 'Deployment', to: '/infrastructure/deployment' },
            { label: 'Environment Variables', to: '/infrastructure/environment-variables' },
            { label: 'Database Schema', to: '/infrastructure/database-schema' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AgentCoders. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'sql'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
