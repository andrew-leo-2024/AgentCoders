import { z } from 'zod';

export const baseConfigSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

export const agentConfigSchema = baseConfigSchema.extend({
  AGENT_ID: z.string(),
  TENANT_ID: z.string().uuid(),
  AGENT_VERTICAL: z.string(),
  AGENT_NAMESPACE: z.string(),
  ADO_ORG_URL: z.string().url(),
  ADO_PROJECT: z.string(),
  ADO_PAT: z.string(),
  ADO_REPOSITORY_ID: z.string().optional(),
  ANTHROPIC_API_KEY: z.string(),
  CLAUDE_MODEL_CODING: z.string().default('claude-sonnet-4-6'),
  CLAUDE_MODEL_TRIAGE: z.string().default('claude-haiku-4-5-20251001'),
  POLL_INTERVAL_MS: z.coerce.number().int().min(5000).default(30000),
  CLAUDE_CODE_TIMEOUT_MS: z.coerce.number().int().min(60000).default(900000),
  MAX_TURNS_CODING: z.coerce.number().int().min(1).default(25),
  MAX_TURNS_REVIEW: z.coerce.number().int().min(1).default(15),
  DAILY_BUDGET_USD: z.coerce.number().min(0).default(100),
  MONTHLY_BUDGET_USD: z.coerce.number().min(0).default(2000),
  HEALTH_PORT: z.coerce.number().int().default(8080),
});

export const telegramConfigSchema = baseConfigSchema.extend({
  TELEGRAM_BOT_TOKEN: z.string(),
  TELEGRAM_OWNER_CHAT_ID: z.string(),
});

export const billingConfigSchema = baseConfigSchema.extend({
  STRIPE_SECRET_KEY: z.string(),
  STRIPE_WEBHOOK_SECRET: z.string(),
  HEALTH_PORT: z.coerce.number().int().default(8081),
});

export const tenantManagerConfigSchema = baseConfigSchema.extend({
  STRIPE_SECRET_KEY: z.string(),
  API_KEY_SECRET: z.string().min(32),
  K8S_IN_CLUSTER: z.coerce.boolean().default(true),
  HEALTH_PORT: z.coerce.number().int().default(8082),
});

export function loadConfig<T extends z.ZodTypeAny>(schema: T): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.flatten();
    const missing = Object.entries(formatted.fieldErrors)
      .map(([key, errors]) => `  ${key}: ${(errors as string[]).join(', ')}`)
      .join('\n');
    throw new Error(`Invalid configuration:\n${missing}`);
  }
  return result.data;
}

export const modelRouterConfigSchema = baseConfigSchema.extend({
  DEFAULT_PROVIDER: z.enum(['anthropic', 'openai', 'google', 'ollama']).default('anthropic'),
  DEFAULT_STRATEGY: z.enum(['cost-optimized', 'quality-optimized', 'latency-optimized', 'round-robin']).default('quality-optimized'),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().default('http://localhost:11434'),
  RATE_LIMIT_RPM: z.coerce.number().int().default(60),
  HEALTH_PORT: z.coerce.number().int().default(8090),
});

export const governanceConfigSchema = baseConfigSchema.extend({
  AUDIT_FLUSH_INTERVAL_MS: z.coerce.number().int().default(5000),
  TELEMETRY_FLUSH_INTERVAL_MS: z.coerce.number().int().default(10000),
  FAILURE_PATTERN_WINDOW_MS: z.coerce.number().int().default(3600000),
  AUTHORITY_DECAY_CHECK_INTERVAL_MS: z.coerce.number().int().default(60000),
});

export const enhancementConfigSchema = baseConfigSchema.extend({
  MAX_REFINEMENT_LOOPS: z.coerce.number().int().default(3),
  CONFIDENCE_THRESHOLD: z.coerce.number().default(0.7),
  MAX_COST_PER_ENHANCEMENT_USD: z.coerce.number().default(5.0),
  SECURITY_SCAN_ENABLED: z.coerce.boolean().default(true),
  PII_DETECTION_ENABLED: z.coerce.boolean().default(true),
});

export type AgentEnvConfig = z.infer<typeof agentConfigSchema>;
export type TelegramEnvConfig = z.infer<typeof telegramConfigSchema>;
export type BillingEnvConfig = z.infer<typeof billingConfigSchema>;
export type TenantManagerEnvConfig = z.infer<typeof tenantManagerConfigSchema>;
export type ModelRouterEnvConfig = z.infer<typeof modelRouterConfigSchema>;
export type GovernanceEnvConfig = z.infer<typeof governanceConfigSchema>;
export type EnhancementEnvConfig = z.infer<typeof enhancementConfigSchema>;
