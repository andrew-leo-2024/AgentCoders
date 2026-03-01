CREATE TYPE "public"."agent_role" AS ENUM('coder', 'reviewer', 'tester', 'jarvis');--> statement-breakpoint
CREATE TYPE "public"."agent_status" AS ENUM('idle', 'polling', 'working', 'reviewing', 'blocked', 'offline', 'error');--> statement-breakpoint
CREATE TYPE "public"."audit_event_category" AS ENUM('agent', 'task', 'model', 'enhancement', 'security', 'billing', 'governance');--> statement-breakpoint
CREATE TYPE "public"."complexity_tier" AS ENUM('XS', 'S', 'M', 'L', 'XL');--> statement-breakpoint
CREATE TYPE "public"."dwi_status" AS ENUM('in_progress', 'pending_review', 'approved', 'merged', 'completed', 'failed', 'reverted');--> statement-breakpoint
CREATE TYPE "public"."failure_category" AS ENUM('model-error', 'timeout', 'validation', 'infrastructure', 'logic', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."failure_pattern_status" AS ENUM('active', 'resolved', 'suppressed');--> statement-breakpoint
CREATE TYPE "public"."insurance_policy_status" AS ENUM('active', 'expired', 'claimed', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."insurance_policy_type" AS ENUM('sla-guarantee', 'quality-guarantee', 'uptime-guarantee', 'data-protection');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('draft', 'sent', 'paid', 'void');--> statement-breakpoint
CREATE TYPE "public"."isolation_tier" AS ENUM('namespace', 'namespace-dedicated-db', 'dedicated-cluster');--> statement-breakpoint
CREATE TYPE "public"."management_model_type" AS ENUM('spotify', 'safe', 'scrum-at-scale', 'team-topologies');--> statement-breakpoint
CREATE TYPE "public"."memory_category" AS ENUM('project', 'area', 'resource', 'archive');--> statement-breakpoint
CREATE TYPE "public"."model_provider" AS ENUM('anthropic', 'openai', 'google', 'ollama');--> statement-breakpoint
CREATE TYPE "public"."routing_strategy" AS ENUM('cost-optimized', 'quality-optimized', 'latency-optimized', 'round-robin');--> statement-breakpoint
CREATE TYPE "public"."skill_category" AS ENUM('frontend', 'backend', 'devops', 'security', 'testing', 'design', 'general');--> statement-breakpoint
CREATE TYPE "public"."subscription_plan" AS ENUM('starter', 'growth', 'enterprise', 'custom');--> statement-breakpoint
CREATE TYPE "public"."tenant_status" AS ENUM('provisioning', 'active', 'suspended', 'deprovisioning');--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"action" varchar(100) NOT NULL,
	"work_item_id" integer,
	"pr_id" integer,
	"details" jsonb,
	"duration_ms" integer,
	"tokens_used" integer,
	"estimated_cost_usd" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agent_memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"category" "memory_category" DEFAULT 'resource' NOT NULL,
	"key" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"relevance_score" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "agent_skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"skill_id" uuid NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"vertical" varchar(50) NOT NULL,
	"role" "agent_role" DEFAULT 'coder' NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"status" "agent_status" DEFAULT 'offline' NOT NULL,
	"current_work_item_id" integer,
	"current_branch" varchar(255),
	"last_poll_at" timestamp,
	"last_heartbeat_at" timestamp,
	"tokens_used_today" bigint DEFAULT 0 NOT NULL,
	"cost_used_today_usd" real DEFAULT 0 NOT NULL,
	"work_items_completed_today" integer DEFAULT 0 NOT NULL,
	"config" jsonb NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "agents_agent_id_unique" UNIQUE("agent_id")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"category" "audit_event_category" NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"parent_event_id" uuid,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claude_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"work_item_id" integer,
	"model" varchar(100) NOT NULL,
	"mode" varchar(20) NOT NULL,
	"input_tokens" bigint DEFAULT 0 NOT NULL,
	"output_tokens" bigint DEFAULT 0 NOT NULL,
	"estimated_cost_usd" real DEFAULT 0 NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"exit_reason" varchar(50),
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "decision_provenance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"work_item_id" integer,
	"decision_type" varchar(100) NOT NULL,
	"model_used" varchar(100) NOT NULL,
	"prompt_hash" varchar(64) NOT NULL,
	"context_sources" jsonb DEFAULT '[]'::jsonb,
	"confidence_score" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dwi_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"work_item_id" integer NOT NULL,
	"pr_id" integer,
	"complexity_tier" "complexity_tier" NOT NULL,
	"price_usd" real NOT NULL,
	"status" "dwi_status" DEFAULT 'in_progress' NOT NULL,
	"work_item_exists" boolean DEFAULT true NOT NULL,
	"pr_linked" boolean DEFAULT false NOT NULL,
	"ci_passed" boolean DEFAULT false NOT NULL,
	"pr_approved" boolean DEFAULT false NOT NULL,
	"pr_merged" boolean DEFAULT false NOT NULL,
	"work_item_closed" boolean DEFAULT false NOT NULL,
	"is_billable" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "enhancement_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"work_item_id" integer,
	"pipeline_config" jsonb NOT NULL,
	"stages" jsonb DEFAULT '[]'::jsonb,
	"final_score" real,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "escalations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"work_item_id" integer,
	"sub_type" varchar(50) NOT NULL,
	"details" text NOT NULL,
	"resolution" text,
	"resolved_by" varchar(100),
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "failure_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pattern_hash" varchar(64) NOT NULL,
	"signature" text NOT NULL,
	"category" "failure_category" DEFAULT 'unknown' NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"resolution" text,
	"status" "failure_pattern_status" DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"incident_details" jsonb DEFAULT '{}'::jsonb,
	"resolution" text,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insurance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"policy_type" "insurance_policy_type" NOT NULL,
	"coverage_details" jsonb DEFAULT '{}'::jsonb,
	"sla_targets" jsonb DEFAULT '{}'::jsonb,
	"status" "insurance_policy_status" DEFAULT 'active' NOT NULL,
	"activated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stripe_invoice_id" varchar(255),
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_dwis" integer DEFAULT 0 NOT NULL,
	"total_usd" real DEFAULT 0 NOT NULL,
	"total_savings_usd" real DEFAULT 0 NOT NULL,
	"line_items" jsonb DEFAULT '[]'::jsonb,
	"status" "invoice_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"model_type" "management_model_type" NOT NULL,
	"topology" jsonb NOT NULL,
	"cadence" jsonb NOT NULL,
	"escalation_paths" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"channel" varchar(255) NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"reply_to_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_route_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"route_id" uuid NOT NULL,
	"input_tokens" bigint NOT NULL,
	"output_tokens" bigint NOT NULL,
	"latency_ms" integer NOT NULL,
	"quality_score" real,
	"cost_usd" real NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"provider" "model_provider" NOT NULL,
	"model_id" varchar(100) NOT NULL,
	"capabilities" jsonb NOT NULL,
	"pricing" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pr_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"pr_id" integer NOT NULL,
	"work_item_id" integer NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"repository_id" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"source_branch" varchar(255) NOT NULL,
	"target_branch" varchar(255) DEFAULT 'main' NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"merged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skill_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"skill_id" uuid NOT NULL,
	"task_type" varchar(100) NOT NULL,
	"quality_delta" real DEFAULT 0 NOT NULL,
	"sample_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(200) NOT NULL,
	"category" "skill_category" NOT NULL,
	"version" varchar(50) DEFAULT '1.0.0' NOT NULL,
	"description" text NOT NULL,
	"content" text NOT NULL,
	"is_builtin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "skills_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"stripe_customer_id" varchar(255) NOT NULL,
	"stripe_subscription_id" varchar(255),
	"plan" "subscription_plan" NOT NULL,
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "telemetry_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"metric_name" varchar(200) NOT NULL,
	"metric_value" real NOT NULL,
	"dimensions" jsonb DEFAULT '{}'::jsonb,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"isolation_tier" "isolation_tier" DEFAULT 'namespace' NOT NULL,
	"subscription_plan" "subscription_plan" DEFAULT 'starter' NOT NULL,
	"status" "tenant_status" DEFAULT 'provisioning' NOT NULL,
	"ado_config" jsonb,
	"telegram_config" jsonb,
	"verticals" jsonb DEFAULT '[]'::jsonb,
	"resource_quotas" jsonb NOT NULL,
	"billing_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "usage_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"session_id" uuid,
	"model" varchar(100) NOT NULL,
	"input_tokens" bigint NOT NULL,
	"output_tokens" bigint NOT NULL,
	"estimated_cost_usd" real NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_item_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"work_item_id" integer NOT NULL,
	"agent_id" varchar(100) NOT NULL,
	"title" text NOT NULL,
	"state" varchar(50) NOT NULL,
	"complexity_tier" "complexity_tier",
	"branch_name" varchar(255),
	"claimed_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_memories" ADD CONSTRAINT "agent_memories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_skills" ADD CONSTRAINT "agent_skills_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claude_sessions" ADD CONSTRAINT "claude_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_provenance" ADD CONSTRAINT "decision_provenance_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dwi_records" ADD CONSTRAINT "dwi_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "enhancement_runs" ADD CONSTRAINT "enhancement_runs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "escalations" ADD CONSTRAINT "escalations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "failure_patterns" ADD CONSTRAINT "failure_patterns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_policy_id_insurance_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."insurance_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insurance_policies" ADD CONSTRAINT "insurance_policies_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_configs" ADD CONSTRAINT "management_configs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_route_logs" ADD CONSTRAINT "model_route_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_route_logs" ADD CONSTRAINT "model_route_logs_route_id_model_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."model_routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_routes" ADD CONSTRAINT "model_routes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pr_log" ADD CONSTRAINT "pr_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_scores" ADD CONSTRAINT "skill_scores_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skill_scores" ADD CONSTRAINT "skill_scores_skill_id_skills_id_fk" FOREIGN KEY ("skill_id") REFERENCES "public"."skills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telemetry_records" ADD CONSTRAINT "telemetry_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_session_id_claude_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."claude_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_item_log" ADD CONSTRAINT "work_item_log_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;