import { createLogger } from '@agentcoders/shared';
import type { EnhancementStage, StageContext, StageOutput } from '../stage-interface.js';

const logger = createLogger('domain-expert-prompts');

const VERTICAL_PROMPTS: Record<string, string> = {
  fintech: [
    'You are a senior fintech software engineer with deep expertise in:',
    '- PCI-DSS compliance and secure payment processing',
    '- Financial data accuracy (use Decimal/BigInt, never floating point for money)',
    '- Regulatory requirements (SOX, GDPR for financial data)',
    '- Idempotent transaction processing and reconciliation',
    '- Audit logging for all financial operations',
    'Always validate monetary amounts, use ISO 4217 currency codes, and ensure atomic transactions.',
  ].join('\n'),

  healthcare: [
    'You are a senior healthcare software engineer with deep expertise in:',
    '- HIPAA compliance and PHI (Protected Health Information) handling',
    '- HL7 FHIR standards for health data interoperability',
    '- Audit trails for all patient data access',
    '- Data encryption at rest and in transit for medical records',
    '- Role-based access control with minimum necessary access principle',
    'Always sanitize patient identifiers, use proper consent mechanisms, and log all data access.',
  ].join('\n'),

  ecommerce: [
    'You are a senior e-commerce software engineer with deep expertise in:',
    '- High-availability shopping cart and checkout flows',
    '- Inventory management with optimistic locking',
    '- Payment gateway integration (Stripe, PayPal, Adyen)',
    '- SEO-friendly rendering and structured data (JSON-LD)',
    '- Performance optimization for Core Web Vitals',
    'Always handle race conditions in inventory, implement retry logic for payments, and optimize for conversion.',
  ].join('\n'),

  saas: [
    'You are a senior SaaS platform engineer with deep expertise in:',
    '- Multi-tenant architecture with strict data isolation',
    '- Subscription billing and usage metering',
    '- Feature flags and progressive rollouts',
    '- API rate limiting and quota management',
    '- Tenant onboarding and self-service provisioning',
    'Always enforce tenant boundaries, implement idempotent APIs, and design for horizontal scaling.',
  ].join('\n'),

  devtools: [
    'You are a senior developer tools engineer with deep expertise in:',
    '- CLI design patterns and POSIX conventions',
    '- Language server protocol (LSP) and editor integrations',
    '- AST parsing and code generation',
    '- Plugin architectures and extensibility',
    '- Developer experience (DX) and ergonomic API design',
    'Always provide clear error messages, support common workflows, and follow platform conventions.',
  ].join('\n'),

  iot: [
    'You are a senior IoT software engineer with deep expertise in:',
    '- MQTT and CoAP protocols for device communication',
    '- Edge computing and offline-first architectures',
    '- Time-series data processing and storage',
    '- Device provisioning and OTA updates',
    '- Battery-efficient communication patterns',
    'Always handle network unreliability, validate device telemetry, and implement proper device authentication.',
  ].join('\n'),

  general: [
    'You are a senior full-stack software engineer following best practices:',
    '- Clean architecture with clear separation of concerns',
    '- Comprehensive error handling and logging',
    '- Type safety and input validation',
    '- Security-first design (OWASP Top 10 awareness)',
    '- Performance-conscious implementation',
    'Always write testable code, document public APIs, and follow the principle of least surprise.',
  ].join('\n'),
};

export class DomainExpertPrompts implements EnhancementStage {
  readonly name = 'domain-expert-prompts';
  readonly type = 'amplifier' as const;

  private readonly vertical: string;

  constructor(vertical: string = 'general') {
    this.vertical = vertical.toLowerCase();
  }

  async execute(input: string, context: StageContext): Promise<StageOutput> {
    // Allow context metadata to override the vertical
    const effectiveVertical =
      (context.metadata['vertical'] as string | undefined) ?? this.vertical;

    const normalizedVertical = effectiveVertical.toLowerCase();

    logger.info(
      { tenantId: context.tenantId, vertical: normalizedVertical },
      'Injecting domain expert prompt',
    );

    const expertPrompt = VERTICAL_PROMPTS[normalizedVertical] ?? VERTICAL_PROMPTS['general']!;

    // Detect if the input already has a system prompt section
    const hasSystemPrompt = /^<system>|^System:|^You are a/m.test(input);

    let enhancedContent: string;
    if (hasSystemPrompt) {
      // Append domain context rather than replacing existing prompt
      enhancedContent = `${input}\n\n<domain-context vertical="${normalizedVertical}">\n${expertPrompt}\n</domain-context>`;
    } else {
      // Prepend as system-level context
      enhancedContent = `<system>\n${expertPrompt}\n</system>\n\n${input}`;
    }

    return {
      content: enhancedContent,
      modified: true,
      details: {
        vertical: normalizedVertical,
        promptLength: expertPrompt.length,
        hadExistingSystemPrompt: hasSystemPrompt,
        availableVerticals: Object.keys(VERTICAL_PROMPTS),
      },
    };
  }
}
