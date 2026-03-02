---
sidebar_position: 9
title: "@agentcoders/enhancement-layer"
---

# @agentcoders/enhancement-layer

20-stage prompt enhancement pipeline organized into 4 categories: Amplifiers, Stabilizers, Codecs, and Armours. Stages run sequentially via a fluent `PipelineBuilder`.

**Entry point:** `dist/pipeline.js`
**Source files:** 23

## Core Architecture

### Stage Interface (`stage-interface.ts`)

```typescript
interface EnhancementStage {
  name: string;
  type: 'amplifier' | 'stabilizer' | 'codec' | 'armour';
  execute(input: string, context: StageContext): Promise<StageOutput>;
}

interface StageContext {
  tenantId: string;
  agentId: string;
  workItemId?: number;
  metadata: Record<string, unknown>;
}

interface StageOutput {
  content: string;
  modified: boolean;
  details: Record<string, unknown>;
}
```

### EnhancementPipeline (`pipeline.ts`)

Executes stages sequentially, tracking timing and results:

```typescript
interface EnhancementResult {
  originalInput: string;
  enhancedOutput: string;
  stages: StageResult[];       // per-stage name, status, score, durationMs
  totalDurationMs: number;
  finalScore: number;
}
```

- Graceful failure handling — a failing stage doesn't abort the pipeline
- Per-stage timing recorded in milliseconds
- Results stored in `enhancementRuns` database table

### PipelineBuilder (`pipeline-builder.ts`)

Fluent API for composing pipelines:

```typescript
const pipeline = new PipelineBuilder()
  .addAmplifier(new RagInjector())
  .addStabilizer(new SchemaEnforcer())
  .addCodec(new PromptCompiler())
  .addArmour(new SecurityScanner())
  .build();
```

## Amplifiers (Boost Quality)

### 1. RAG Injector (`amplifiers/rag-injector.ts`)

Retrieves relevant context chunks to augment prompts:
- Maximum **5 chunks** per injection
- Relevance **threshold: 0.7** — only chunks above this score are included
- Sources: agent memory, project files, documentation

### 2. Chain of Verification (`amplifiers/chain-of-verification.ts`)

Verifies claims in generated content across **4 verification types:**
- `factual` — fact-checking assertions
- `code-correctness` — syntax and logic verification
- `dependency` — import and package validation
- `api-usage` — API call correctness

### 3. Ensemble Router (`amplifiers/ensemble-router.ts`)

Selects the best model combination by analyzing task profile:
- Routes code generation to specialized models
- Can split tasks across multiple models for ensemble results
- Considers task type, complexity, and domain

### 4. Domain Expert Prompts (`amplifiers/domain-expert-prompts.ts`)

Injects domain-specific expertise into prompts. **6 domains:**
- `fintech` — financial regulations, PCI compliance, transaction handling
- `healthcare` — HIPAA, medical data handling, HL7/FHIR
- `ecommerce` — payment flows, inventory, cart management
- `saas` — multi-tenancy, subscription models, API design
- `devtools` — CLI patterns, plugin systems, developer experience
- `iot` — device protocols, edge computing, telemetry

### 5. Output Refinement Loop (`amplifiers/output-refinement-loop.ts`)

Iterative refinement of generated code through **3 refinement types:**
- `lint` — style and formatting checks
- `typecheck` — TypeScript type verification
- `test` — test execution and coverage

Maximum iterations controlled by `MAX_REFINEMENT_LOOPS` (default: 3).

## Stabilizers (Ensure Consistency)

### 1. Schema Enforcer (`stabilizers/schema-enforcer.ts`)

JSON schema validation with **auto-fix capability:**
- Validates output against expected schema
- Attempts automatic correction of common schema violations
- Reports validation errors when auto-fix fails

### 2. Deterministic Validator (`stabilizers/deterministic-validator.ts`)

AST-based code analysis:
- **AST parsing** — verifies code is syntactically valid
- **Import checking** — validates all imports resolve to real packages
- Catches undefined references and missing dependencies

### 3. Confidence Scorer (`stabilizers/confidence-scorer.ts`)

Scores output quality across **6 signals:**

| Signal | What It Measures |
|--------|-----------------|
| `length` | Output completeness relative to task complexity |
| `code-structure` | Proper function/class/module structure |
| `completeness` | All requirements addressed |
| `hedging` | Absence of uncertain language ("maybe", "might") |
| `error-handling` | Try/catch, error boundaries, edge cases |
| `documentation` | Inline comments where needed |

Minimum threshold controlled by `CONFIDENCE_THRESHOLD` (default: 0.7).

### 4. Temperature Controller (`stabilizers/temperature-controller.ts`)

Dynamically adjusts model temperature based on task requirements:
- Lower temperature for deterministic tasks (bug fixes, refactors)
- Higher temperature for creative tasks (architecture, design)

### 5. Retry Escalator (`stabilizers/retry-escalator.ts`)

Escalates to more capable models on repeated failures:
- Tracks failure count per stage
- Upgrades model tier after threshold failures
- Prevents infinite retry loops

## Codecs (Format Transformation)

### 1. Prompt Compiler (`codecs/prompt-compiler.ts`)

Compiles prompts for target model formats:

| Target | Format |
|--------|--------|
| Claude | XML tags (`<task>`, `<context>`, `<instructions>`) |
| GPT | JSON structured prompts |
| Gemini | Markdown with headers |
| LLaMA | `[INST]...[/INST]` instruction format |

### 2. Context Compressor (`codecs/context-compressor.ts`)

Reduces context size while preserving semantic meaning:
- Removes redundant information
- Summarizes verbose content
- Prioritizes most relevant context

### 3. Output Normalizer (`codecs/output-normalizer.ts`)

Standardizes output format across providers:
- Strips provider-specific formatting artifacts
- Normalizes code blocks, headers, and structure
- Ensures consistent output regardless of model used

### 4. Code Formatter (`codecs/code-formatter.ts`)

Applies consistent code formatting:
- Language-aware formatting rules
- Consistent indentation, spacing, and style
- Removes unnecessary whitespace

### 5. Semantic Deduplicator (`codecs/semantic-deduplicator.ts`)

Removes semantically duplicate content:
- Detects repeated explanations or code blocks
- Merges overlapping content
- Preserves unique information

## Armours (Safety & Compliance)

### 1. Security Scanner (`armours/security-scanner.ts`)

Scans for security vulnerabilities — **70 detection patterns:**

| Category | Examples |
|----------|---------|
| XSS | `innerHTML`, `<script>` tags, `eval()` |
| SQL Injection | String concatenation in queries |
| Command Injection | Unsanitized `exec()`, `spawn()` calls |
| Secrets | API keys, AWS keys, private keys, passwords |

Configurable check selection — can enable/disable specific categories.

### 2. PII Detector (`armours/pii-detector.ts`)

Detects personally identifiable information:
- Email addresses, phone numbers, SSNs
- Names, addresses, dates of birth
- Financial information (credit card numbers)

### 3. License Checker (`armours/license-checker.ts`)

Open-source license compliance:
- Validates license compatibility
- Flags copyleft licenses in proprietary projects
- Checks attribution requirements

### 4. Cost Limiter (`armours/cost-limiter.ts`)

Per-enhancement cost ceiling enforcement:
- Controlled by `MAX_COST_PER_ENHANCEMENT_USD` (default: $5.00)
- Aborts pipeline if accumulated stage costs exceed limit
- Logs cost breakdown per stage

### 5. Human Escalation Gate (`armours/human-escalation-gate.ts`)

Routes high-risk outputs to human review:
- Triggers on security findings above threshold
- Triggers on low confidence scores
- Publishes escalation to Telegram for human decision
- Blocks pipeline until approved or rejected
