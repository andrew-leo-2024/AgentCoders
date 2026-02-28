import { z } from 'zod';
import { baseConfigSchema } from '@agentcoders/shared';

export const jarvisConfigSchema = baseConfigSchema.extend({
  TENANT_ID: z.string().uuid(),
  JARVIS_NAMESPACE: z.string().default('jarvis'),
  ADO_ORG_URL: z.string().url(),
  ADO_PROJECT: z.string(),
  ADO_PAT: z.string(),
  TELEGRAM_CHAT_ID: z.string(),
  POLL_INTERVAL_MS: z.coerce.number().int().min(5000).default(30_000),
  DAILY_SUMMARY_INTERVAL_MS: z.coerce.number().int().default(86_400_000), // 24h
  AGENT_IMAGE: z.string().default('agentcoders/agent-runtime:latest'),
});

export type JarvisEnvConfig = z.infer<typeof jarvisConfigSchema>;
