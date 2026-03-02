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

  markdown: {
    mermaid: true,
  },

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
          editUrl: 'https://github.com/andrew-leo-2024/AgentCoders/edit/main/docs-site/',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        hashed: true,
        indexBlog: false,
        docsRouteBasePath: '/',
      },
    ],
  ],

  themeConfig: {
    colorMode: {
      respectPrefersColorScheme: true,
    },
    announcementBar: {
      id: 'e2e_integration',
      content: 'E2E Integration wired — JarvisCEO now delegates to real Agent instances with live GitHub commits. <a href="/AgentCoders/infrastructure/e2e-integration">Read more →</a>',
      backgroundColor: '#1E2761',
      textColor: '#CADCFC',
      isCloseable: true,
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
          href: 'https://github.com/andrew-leo-2024/AgentCoders',
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
        {
          title: 'Ecosystem',
          items: [
            { label: 'AINEFF Docs', href: 'https://andrew-leo-2024.github.io/aineff-docs/' },
            { label: 'AINEFF Architecture', href: 'https://andrew-leo-2024.github.io/aineff-docs/docs/architecture/overview' },
            { label: 'Agent Build Manifest', href: 'https://andrew-leo-2024.github.io/aineff-docs/docs/building/agent-build-manifest' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} AgentCoders — Part of the AINEFF Ecosystem. Built with Docusaurus.`,
    },
    mermaid: {
      theme: {
        light: 'base',
        dark: 'dark',
      },
      options: {
        themeVariables: {
          primaryColor: '#00D4AA',
          primaryTextColor: '#1E2761',
          primaryBorderColor: '#00B894',
          lineColor: '#CADCFC',
          secondaryColor: '#1E2761',
          tertiaryColor: '#0D1330',
        },
      },
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'yaml', 'json', 'sql'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
