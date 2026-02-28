import type { Logger, Database, InvoiceLineItem } from '@agentcoders/shared';
import { dwiRecords, invoices, workItemLog, tenants } from '@agentcoders/shared';
import { COMPLEXITY_HUMAN_EQUIVALENT } from '@agentcoders/shared';
import type { ComplexityTier } from '@agentcoders/shared';
import { eq, and, gte, lte } from 'drizzle-orm';
import { StripeService } from './stripe-integration.js';

// Human equivalent hourly rate assumption for savings calculation
const HUMAN_HOURLY_RATE = 150; // USD
const HUMAN_HOURS_PER_TIER: Record<ComplexityTier, number> = {
  XS: 0.5,
  S: 2,
  M: 8,
  L: 24,
  XL: 60,
};

/**
 * Generates value-focused invoices.
 *
 * Invoice format emphasizes:
 * - Work items delivered with complexity tiers
 * - Total cost
 * - Human equivalent cost
 * - Savings percentage
 *
 * NEVER shows: tokens, API calls, compute hours, AWU
 */
export class InvoiceGenerator {
  constructor(
    private readonly db: Database,
    private readonly stripe: StripeService,
    private readonly logger: Logger,
  ) {}

  /**
   * Generates an invoice for a tenant covering a specific billing period.
   * Only includes completed, billable DWIs.
   */
  async generateInvoice(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{
    invoiceId: string;
    stripeInvoiceId: string;
    totalDwis: number;
    totalUsd: number;
    totalSavingsUsd: number;
    savingsPercentage: number;
  }> {
    // Fetch all completed, billable DWIs for this period
    const completedDwis = await this.db
      .select()
      .from(dwiRecords)
      .where(
        and(
          eq(dwiRecords.tenantId, tenantId),
          eq(dwiRecords.isBillable, true),
          gte(dwiRecords.completedAt, periodStart),
          lte(dwiRecords.completedAt, periodEnd),
        ),
      );

    if (completedDwis.length === 0) {
      this.logger.info({ tenantId, periodStart, periodEnd }, 'No billable DWIs for period');
      throw new Error('No billable DWIs found for the specified period');
    }

    // Build line items with work item titles from the work item log
    const lineItems: InvoiceLineItem[] = [];
    let totalUsd = 0;
    let humanEquivalentTotal = 0;

    for (const dwi of completedDwis) {
      // Look up work item title from the log
      const wiLog = await this.db
        .select({ title: workItemLog.title })
        .from(workItemLog)
        .where(
          and(
            eq(workItemLog.tenantId, tenantId),
            eq(workItemLog.workItemId, dwi.workItemId),
          ),
        )
        .limit(1);

      const title = wiLog[0]?.title ?? `Work Item #${dwi.workItemId}`;
      const tier = dwi.complexityTier as ComplexityTier;
      const humanEquiv = COMPLEXITY_HUMAN_EQUIVALENT[tier];
      const humanHours = HUMAN_HOURS_PER_TIER[tier];
      const humanCost = humanHours * HUMAN_HOURLY_RATE;

      lineItems.push({
        dwiId: dwi.id,
        workItemTitle: title,
        complexityTier: tier,
        priceUsd: dwi.priceUsd,
        humanEquivalentUsd: humanEquiv,
      });

      totalUsd += dwi.priceUsd;
      humanEquivalentTotal += humanCost;
    }

    const totalSavingsUsd = humanEquivalentTotal - totalUsd;
    const savingsPercentage = humanEquivalentTotal > 0
      ? Math.round((totalSavingsUsd / humanEquivalentTotal) * 100)
      : 0;

    // Get Stripe customer ID for this tenant
    const tenant = await this.db
      .select({ billingConfig: tenants.billingConfig })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const stripeCustomerId = tenant[0]?.billingConfig?.stripeCustomerId;
    if (!stripeCustomerId) {
      throw new Error(`No Stripe customer ID found for tenant ${tenantId}`);
    }

    // Create Stripe invoice
    const stripeInvoiceId = await this.stripe.createInvoice(stripeCustomerId, lineItems);

    // Store invoice in database
    const [invoice] = await this.db.insert(invoices).values({
      tenantId,
      stripeInvoiceId,
      periodStart,
      periodEnd,
      totalDwis: completedDwis.length,
      totalUsd,
      totalSavingsUsd,
      lineItems,
      status: 'draft',
    }).returning({ id: invoices.id });

    this.logger.info({
      invoiceId: invoice!.id,
      stripeInvoiceId,
      tenantId,
      totalDwis: completedDwis.length,
      totalUsd,
      humanEquivalentTotal,
      totalSavingsUsd,
      savingsPercentage,
    }, 'Generated invoice');

    return {
      invoiceId: invoice!.id,
      stripeInvoiceId,
      totalDwis: completedDwis.length,
      totalUsd,
      totalSavingsUsd,
      savingsPercentage,
    };
  }

  /**
   * Formats invoice data for display (e.g., in Telegram or dashboard).
   * This is the customer-facing format — NO internal metrics are shown.
   */
  formatInvoiceSummary(invoice: {
    totalDwis: number;
    totalUsd: number;
    totalSavingsUsd: number;
    savingsPercentage: number;
    lineItems: InvoiceLineItem[];
  }): string {
    const lines: string[] = [
      '=== AgentCoders Invoice ===',
      '',
      'Work Items Delivered:',
    ];

    for (const item of invoice.lineItems) {
      lines.push(`  [${item.complexityTier}] ${item.workItemTitle} — $${item.priceUsd.toFixed(2)} (human equiv: ${item.humanEquivalentUsd})`);
    }

    lines.push('');
    lines.push(`Total: $${invoice.totalUsd.toFixed(2)}`);
    lines.push(`Human Equivalent: $${(invoice.totalUsd + invoice.totalSavingsUsd).toFixed(2)}`);
    lines.push(`You Saved: $${invoice.totalSavingsUsd.toFixed(2)} (${invoice.savingsPercentage}%)`);
    lines.push(`DWIs Delivered: ${invoice.totalDwis}`);

    return lines.join('\n');
  }
}
