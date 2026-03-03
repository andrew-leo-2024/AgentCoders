import { z } from 'zod';
import { baseConfigSchema } from '@agentcoders/shared';

export const jarvisConfigSchema = baseConfigSchema.extend({
  TENANT_ID: z.string().uuid(),
  JARVIS_NAMESPACE: z.string().default('jarvis'),
  SCM_PROVIDER: z.enum(['ado', 'github']).default('ado'),
  // ADO (required when SCM_PROVIDER=ado)
  ADO_ORG_URL: z.string().url().optional(),
  ADO_PROJECT: z.string().optional(),
  ADO_PAT: z.string().optional(),
  // GitHub (required when SCM_PROVIDER=github)
  GITHUB_TOKEN: z.string().optional(),
  GITHUB_OWNER: z.string().optional(),
  GITHUB_REPO: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string(),
  POLL_INTERVAL_MS: z.coerce.number().int().min(5000).default(30_000),
  DAILY_SUMMARY_INTERVAL_MS: z.coerce.number().int().default(86_400_000), // 24h
  AGENT_IMAGE: z.string().default('agentcoders/agent-runtime:latest'),
});

export type JarvisEnvConfig = z.infer<typeof jarvisConfigSchema>;
