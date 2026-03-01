import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@agentcoders/shared';
import type { SkillDefinition } from '@agentcoders/shared';

const logger = createLogger('skill-registry:loader');

export class SkillLoader {
  async writeToWorkspace(skills: SkillDefinition[], workspacePath: string): Promise<string[]> {
    const skillsDir = join(workspacePath, '.claude', 'skills');
    await mkdir(skillsDir, { recursive: true });

    const writtenPaths: string[] = [];
    for (const skill of skills) {
      const skillDir = join(skillsDir, skill.name);
      await mkdir(skillDir, { recursive: true });
      const filePath = join(skillDir, 'SKILL.md');
      await writeFile(filePath, skill.content, 'utf-8');
      writtenPaths.push(filePath);
    }

    logger.info({ count: skills.length, workspacePath }, 'Skills written to workspace');
    return writtenPaths;
  }

  async loadBuiltins(): Promise<Array<Omit<SkillDefinition, 'id' | 'createdAt'>>> {
    return BUILTIN_SKILLS;
  }
}

const BUILTIN_SKILLS: Array<Omit<SkillDefinition, 'id' | 'createdAt'>> = [
  {
    name: 'frontend-design',
    category: 'frontend',
    version: '1.0.0',
    description: 'UI/UX Pro Max — style rules and design system enforcement',
    isBuiltin: true,
    content: `# Frontend Design Skill

## Rules
- Use design tokens for all colors, spacing, typography
- Follow atomic design: atoms → molecules → organisms → templates → pages
- Responsive-first: mobile breakpoint as default, scale up
- Accessibility: WCAG 2.1 AA minimum, semantic HTML, ARIA labels
- Performance: lazy load images, code split routes, optimize bundle
- Consistency: component library first, custom only when justified
`,
  },
  {
    name: 'tdd-workflow',
    category: 'testing',
    version: '1.0.0',
    description: 'Test-Driven Development workflow for agent coding',
    isBuiltin: true,
    content: `# TDD Workflow Skill

## Process
1. Read the requirement carefully
2. Write a failing test FIRST that captures the expected behavior
3. Run the test — confirm it fails for the right reason
4. Write the MINIMUM code to make the test pass
5. Run all tests — confirm green
6. Refactor if needed, keeping tests green
7. Repeat for next requirement

## Rules
- Never write production code without a failing test
- One assertion per test when possible
- Test behavior, not implementation
- Name tests: "should [expected behavior] when [condition]"
`,
  },
  {
    name: 'security-audit',
    category: 'security',
    version: '1.0.0',
    description: 'Security review checklist for code changes',
    isBuiltin: true,
    content: `# Security Audit Skill

## Checklist
- Input validation: all user input sanitized and validated
- Authentication: proper auth checks on all endpoints
- Authorization: RBAC/ABAC enforced, no privilege escalation
- Injection: parameterized queries, no string concatenation for SQL/commands
- XSS: output encoding, CSP headers, no dangerouslySetInnerHTML
- Secrets: no hardcoded keys, use env vars or vault
- Dependencies: no known CVEs, lock file up to date
- Logging: no PII in logs, structured logging
- CORS: restrictive origin policy
- Rate limiting: on public endpoints
`,
  },
  {
    name: 'api-design',
    category: 'backend',
    version: '1.0.0',
    description: 'RESTful API design conventions and best practices',
    isBuiltin: true,
    content: `# API Design Skill

## Conventions
- RESTful resource naming: plural nouns (GET /users, POST /users)
- HTTP methods: GET (read), POST (create), PUT (replace), PATCH (update), DELETE (remove)
- Status codes: 200 (ok), 201 (created), 204 (no content), 400 (bad request), 401 (unauthorized), 403 (forbidden), 404 (not found), 409 (conflict), 500 (server error)
- Pagination: cursor-based preferred, offset-based acceptable
- Versioning: URL prefix (/v1/) or Accept header
- Error format: { "error": { "code": "string", "message": "string", "details": [] } }
- Request validation: Zod schemas at the boundary
- Response format: consistent envelope { "data": ..., "meta": ... }
`,
  },
  {
    name: 'devops-pipeline',
    category: 'devops',
    version: '1.0.0',
    description: 'CI/CD pipeline design and configuration',
    isBuiltin: true,
    content: `# DevOps Pipeline Skill

## Pipeline Stages
1. Lint — ESLint, Prettier check
2. Type Check — tsc --noEmit
3. Unit Tests — vitest/jest with coverage
4. Build — compile/bundle
5. Integration Tests — against test environment
6. Security Scan — dependency audit, SAST
7. Deploy — staged rollout (canary → full)

## Rules
- Pipeline must be fast: target < 10 minutes
- Fail fast: lint and type check before tests
- Cache dependencies between runs
- Pin versions in CI config
- Separate build and deploy stages
- Environment-specific configs via env vars, not code
`,
  },
  {
    name: 'code-review',
    category: 'general',
    version: '1.0.0',
    description: 'Code review checklist and standards',
    isBuiltin: true,
    content: `# Code Review Skill

## Review Checklist
- Does the code do what the task requires?
- Are edge cases handled?
- Is error handling appropriate?
- Are there security concerns?
- Is the code readable and maintainable?
- Are naming conventions followed?
- Is there adequate test coverage?
- Are there performance concerns?
- Is the change minimal (no unnecessary refactoring)?
- Are types properly defined (no \`any\`)?

## Review Style
- Be specific: point to exact lines
- Suggest fixes, don't just point out problems
- Distinguish blocking issues from nits
- Approve if no blocking issues remain
`,
  },
];
