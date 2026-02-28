import Stripe from 'stripe';
import type { Logger } from '@agentcoders/shared';
import type { Tenant, SubscriptionPlan, InvoiceLineItem } from '@agentcoders/shared';

export class StripeService {
  private stripe: Stripe;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
    private readonly logger: Logger,
  ) {
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia',
      typescript: true,
    });
  }

  /**
   * Creates a Stripe customer for a new tenant.
   */
  async createCustomer(tenant: Pick<Tenant, 'id' | 'name' | 'slug'>): Promise<string> {
    const customer = await this.stripe.customers.create({
      name: tenant.name,
      metadata: {
        tenantId: tenant.id,
        slug: tenant.slug,
      },
    });

    this.logger.info({ customerId: customer.id, tenantId: tenant.id }, 'Created Stripe customer');
    return customer.id;
  }

  /**
   * Creates a metered subscription for a customer.
   * Uses Stripe metered billing — charges are based on reported usage (DWIs completed).
   */
  async createSubscription(
    customerId: string,
    plan: SubscriptionPlan,
  ): Promise<{ subscriptionId: string; subscriptionItemId: string }> {
    // Look up or create the price for this plan
    const priceId = await this.getOrCreateMeteredPrice(plan);

    const subscription = await this.stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      metadata: { plan },
    });

    const subscriptionItemId = subscription.items.data[0]!.id;

    this.logger.info({
      subscriptionId: subscription.id,
      subscriptionItemId,
      customerId,
      plan,
    }, 'Created metered subscription');

    return {
      subscriptionId: subscription.id,
      subscriptionItemId,
    };
  }

  /**
   * Reports DWI completion as metered usage to Stripe.
   * Each DWI is a usage event with its price in USD cents.
   */
  async reportDwiUsage(
    subscriptionItemId: string,
    dwiCount: number,
    priceUsd: number,
  ): Promise<void> {
    // Stripe metered billing expects quantity; we report price in cents as the quantity
    // so each "unit" = 1 cent, and quantity = total cents
    const quantityCents = Math.round(priceUsd * 100);

    await this.stripe.subscriptionItems.createUsageRecord(subscriptionItemId, {
      quantity: quantityCents,
      timestamp: Math.floor(Date.now() / 1000),
      action: 'increment',
    });

    this.logger.info({
      subscriptionItemId,
      dwiCount,
      priceUsd,
      quantityCents,
    }, 'Reported DWI usage to Stripe');
  }

  /**
   * Creates an invoice for a tenant with specific line items.
   */
  async createInvoice(
    customerId: string,
    lineItems: InvoiceLineItem[],
  ): Promise<string> {
    const invoice = await this.stripe.invoices.create({
      customer: customerId,
      auto_advance: true,
      collection_method: 'send_invoice',
      days_until_due: 30,
      metadata: {
        dwiCount: String(lineItems.length),
      },
    });

    // Add each DWI as an invoice item
    for (const item of lineItems) {
      await this.stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount: Math.round(item.priceUsd * 100), // cents
        currency: 'usd',
        description: `[${item.complexityTier}] ${item.workItemTitle}`,
        metadata: {
          dwiId: item.dwiId,
          complexityTier: item.complexityTier,
          humanEquivalentUsd: item.humanEquivalentUsd,
        },
      });
    }

    this.logger.info({
      invoiceId: invoice.id,
      customerId,
      lineItemCount: lineItems.length,
    }, 'Created Stripe invoice');

    return invoice.id!;
  }

  /**
   * Processes incoming Stripe webhooks.
   * Returns the event type and relevant data for downstream processing.
   */
  async handleWebhook(
    payload: string | Buffer,
    signature: string,
  ): Promise<{ eventType: string; data: Record<string, unknown> }> {
    const event = this.stripe.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );

    this.logger.info({ eventType: event.type, eventId: event.id }, 'Received Stripe webhook');

    const data = event.data.object as unknown as Record<string, unknown>;

    switch (event.type) {
      case 'invoice.paid':
        this.logger.info({ invoiceId: data['id'] }, 'Invoice paid');
        break;
      case 'invoice.payment_failed':
        this.logger.warn({ invoiceId: data['id'] }, 'Invoice payment failed');
        break;
      case 'customer.subscription.deleted':
        this.logger.warn({ subscriptionId: data['id'] }, 'Subscription cancelled');
        break;
      case 'customer.subscription.updated':
        this.logger.info({ subscriptionId: data['id'] }, 'Subscription updated');
        break;
      default:
        this.logger.debug({ eventType: event.type }, 'Unhandled webhook event');
    }

    return { eventType: event.type, data };
  }

  /**
   * Gets or creates a Stripe metered price for the given plan tier.
   * In production these would be pre-created in the Stripe dashboard.
   */
  private async getOrCreateMeteredPrice(plan: SubscriptionPlan): Promise<string> {
    // Search for existing price by lookup_key
    const lookupKey = `agentcoders_dwi_${plan}`;
    const existingPrices = await this.stripe.prices.list({
      lookup_keys: [lookupKey],
      limit: 1,
    });

    if (existingPrices.data.length > 0) {
      return existingPrices.data[0]!.id;
    }

    // Create a product and metered price
    const product = await this.stripe.products.create({
      name: `AgentCoders DWI - ${plan}`,
      metadata: { plan },
    });

    const price = await this.stripe.prices.create({
      product: product.id,
      currency: 'usd',
      recurring: {
        interval: 'month',
        usage_type: 'metered',
      },
      unit_amount: 1, // 1 cent per unit; quantity = total cents
      lookup_key: lookupKey,
      metadata: { plan },
    });

    this.logger.info({ priceId: price.id, plan }, 'Created metered price in Stripe');
    return price.id;
  }
}
