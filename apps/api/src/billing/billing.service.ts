import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';

export type PlanTier = 'FREE' | 'PRO' | 'ULTIMATE';
export type PaidTier = 'PRO' | 'ULTIMATE';

export interface SubscriptionDetails {
  planTier: PlanTier;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null; // unix seconds
  trialEnd: number | null; // unix seconds
  priceAmount: number | null; // smallest currency unit (e.g. cents)
  currency: string | null;
}

export interface PaymentMethodInfo {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
}

export interface InvoiceSummary {
  id: string;
  amountPaid: number;
  currency: string;
  status: string | null;
  created: number; // unix seconds
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
}

// Every feature gate that cares about "is this a paying team" (e.g. HQ
// rendering) should check `PAID_TIERS.includes(tier)` rather than comparing
// against 'PRO' directly, so Ultimate teams aren't accidentally excluded.
export const PAID_TIERS: PaidTier[] = ['PRO', 'ULTIMATE'];

const TRIAL_DAYS = 30;

const PRICE_ENV_BY_TIER: Record<PaidTier, string> = {
  PRO: 'STRIPE_PRO_PRICE_ID',
  ULTIMATE: 'STRIPE_ULTIMATE_PRICE_ID',
};

// Stripe in test mode (per the user's Phase 8 choice): every call below is
// a real Stripe API shape, so dropping test keys into apps/api/.env makes
// checkout/portal/webhooks work end-to-end with zero real charges, and
// swapping to live keys later is a config change, not a rewrite. With no
// STRIPE_SECRET_KEY set, `configured` is false and every mutating method
// throws a clear 503 instead of crashing on a missing key.
@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private readonly stripe: Stripe | null;

  constructor(private readonly prisma: PrismaService) {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
    if (!this.stripe) {
      this.logger.log(
        'No STRIPE_SECRET_KEY set — billing endpoints will report "not configured".',
      );
    }
  }

  get configured(): boolean {
    return this.stripe !== null;
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new ServiceUnavailableException(
        'Billing is not configured in this environment yet.',
      );
    }
    return this.stripe;
  }

  // A team-owned project always uses its team's plan. A personal (teamless)
  // project uses its owner's own individual subscription first — that's
  // the primary way a solo user unlocks paid features without ever
  // touching the Teams concept — and, only if the owner has no personal
  // paid plan, falls back to any Pro/Ultimate team they happen to own
  // (so a team owner's personal side-projects still benefit, per
  // docs/ARCHITECTURE.md §8 notes).
  async getEffectivePlan(project: {
    teamId: string | null;
    ownerId: string;
  }): Promise<PlanTier> {
    if (project.teamId) {
      const team = await this.prisma.team.findUnique({
        where: { id: project.teamId },
      });
      return team?.planTier ?? 'FREE';
    }
    const owner = await this.prisma.user.findUnique({
      where: { id: project.ownerId },
    });
    if (owner && owner.planTier !== 'FREE') {
      return owner.planTier;
    }
    const paidTeam = await this.prisma.team.findFirst({
      where: { ownerId: project.ownerId, planTier: { in: PAID_TIERS } },
    });
    return paidTeam?.planTier ?? 'FREE';
  }

  async getTeamBillingStatus(teamId: string) {
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    return {
      configured: this.configured,
      planTier: team.planTier,
      subscriptionStatus: team.stripeSubscriptionStatus,
      trialUsed: team.trialUsed,
      trialAvailable: !team.trialUsed,
    };
  }

  // Dedicated "Subscription details" page — plan, renewal/trial dates,
  // price, and whether it's set to cancel. Never throws when billing isn't
  // configured or the team has no subscription yet — just returns the
  // Team-table fields with everything Stripe-derived as null, so the page
  // can render a sensible "no active subscription" state instead of a 503.
  async getSubscriptionDetails(teamId: string): Promise<SubscriptionDetails> {
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    if (!this.stripe || !team.stripeSubscriptionId) {
      return this.toSubscriptionDetails(
        team.planTier,
        team.stripeSubscriptionStatus,
        null,
      );
    }
    const subscription = await this.stripe.subscriptions.retrieve(
      team.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    );
    return this.toSubscriptionDetails(
      team.planTier,
      team.stripeSubscriptionStatus,
      subscription,
    );
  }

  // Dedicated "Payment" page — the card Stripe will charge next, if any.
  // Returns null (never throws) when unconfigured/no customer/no card yet.
  async getPaymentMethod(teamId: string): Promise<PaymentMethodInfo | null> {
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    if (!this.stripe || !team.stripeCustomerId) return null;

    const methods = await this.stripe.paymentMethods.list({
      customer: team.stripeCustomerId,
      type: 'card',
    });
    return this.toPaymentMethodInfo(methods);
  }

  // Billing history for the Payment page. Returns [] rather than throwing
  // when unconfigured/no customer yet.
  async listInvoices(teamId: string): Promise<InvoiceSummary[]> {
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    if (!this.stripe || !team.stripeCustomerId) return [];

    const invoices = await this.stripe.invoices.list({
      customer: team.stripeCustomerId,
      limit: 12,
    });
    return this.toInvoiceSummaries(invoices);
  }

  // Cancels at the end of the current billing period rather than
  // immediately — the team keeps paid-tier access (and doesn't get a
  // refund) through what they already paid for. Owner-only, enforced by
  // the controller (same gate as checkout/portal).
  async cancelSubscription(teamId: string): Promise<void> {
    const stripe = this.requireStripe();
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    if (!team.stripeSubscriptionId) {
      throw new BadRequestException(
        'This team has no active subscription to cancel.',
      );
    }
    await stripe.subscriptions.update(team.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // ---- Personal (individual, non-team) billing ----
  // Mirrors the team methods above field-for-field, reading/writing User
  // instead of Team — a solo user can subscribe for their own personal
  // projects without ever creating a team (see getEffectivePlan).

  async getPersonalBillingStatus(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    return {
      configured: this.configured,
      planTier: user.planTier,
      subscriptionStatus: user.stripeSubscriptionStatus,
      trialUsed: user.trialUsed,
      trialAvailable: !user.trialUsed,
    };
  }

  async getPersonalSubscriptionDetails(
    userId: string,
  ): Promise<SubscriptionDetails> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!this.stripe || !user.stripeSubscriptionId) {
      return this.toSubscriptionDetails(
        user.planTier,
        user.stripeSubscriptionStatus,
        null,
      );
    }
    const subscription = await this.stripe.subscriptions.retrieve(
      user.stripeSubscriptionId,
      { expand: ['items.data.price'] },
    );
    return this.toSubscriptionDetails(
      user.planTier,
      user.stripeSubscriptionStatus,
      subscription,
    );
  }

  async getPersonalPaymentMethod(
    userId: string,
  ): Promise<PaymentMethodInfo | null> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!this.stripe || !user.stripeCustomerId) return null;

    const methods = await this.stripe.paymentMethods.list({
      customer: user.stripeCustomerId,
      type: 'card',
    });
    return this.toPaymentMethodInfo(methods);
  }

  async listPersonalInvoices(userId: string): Promise<InvoiceSummary[]> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!this.stripe || !user.stripeCustomerId) return [];

    const invoices = await this.stripe.invoices.list({
      customer: user.stripeCustomerId,
      limit: 12,
    });
    return this.toInvoiceSummaries(invoices);
  }

  async cancelPersonalSubscription(userId: string): Promise<void> {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.stripeSubscriptionId) {
      throw new BadRequestException(
        'You have no active subscription to cancel.',
      );
    }
    await stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  private toSubscriptionDetails(
    fallbackPlanTier: PlanTier,
    fallbackStatus: string | null,
    subscription: Stripe.Subscription | null,
  ): SubscriptionDetails {
    const fallback: SubscriptionDetails = {
      planTier: fallbackPlanTier,
      status: fallbackStatus,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEnd: null,
      priceAmount: null,
      currency: null,
    };
    if (!subscription) return fallback;
    const item = subscription.items.data[0];
    return {
      ...fallback,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: item?.current_period_end ?? null,
      trialEnd: subscription.trial_end,
      priceAmount: item?.price.unit_amount ?? null,
      currency: item?.price.currency ?? null,
    };
  }

  private toPaymentMethodInfo(
    methods: Stripe.ApiList<Stripe.PaymentMethod>,
  ): PaymentMethodInfo | null {
    const card = methods.data[0]?.card;
    if (!card) return null;
    return {
      brand: card.brand,
      last4: card.last4 ?? '',
      expMonth: card.exp_month,
      expYear: card.exp_year,
    };
  }

  private toInvoiceSummaries(
    invoices: Stripe.ApiList<Stripe.Invoice>,
  ): InvoiceSummary[] {
    return invoices.data.map((invoice) => ({
      id: invoice.id,
      amountPaid: invoice.amount_paid,
      currency: invoice.currency,
      status: invoice.status,
      created: invoice.created,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdf: invoice.invoice_pdf ?? null,
    }));
  }

  async createCheckoutSession(
    userId: string,
    teamId: string,
    tier: PaidTier,
  ): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const priceId = process.env[PRICE_ENV_BY_TIER[tier]];
    if (!priceId) {
      throw new ServiceUnavailableException(
        `${PRICE_ENV_BY_TIER[tier]} is not configured.`,
      );
    }

    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    let customerId = team.stripeCustomerId;
    if (!customerId) {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      const customer = await stripe.customers.create({
        email: user.email,
        name: team.name,
        metadata: { teamId },
      });
      customerId = customer.id;
      await this.prisma.team.update({
        where: { id: teamId },
        data: { stripeCustomerId: customerId },
      });
    }

    // A team gets exactly one 30-day Pro trial, ever. `trialUsed` is only
    // persisted once the checkout actually completes (see the webhook
    // handler below) — not here — so an abandoned/cancelled checkout
    // doesn't burn a trial the team never actually got.
    const startTrial = tier === 'PRO' && !team.trialUsed;

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { teamId, tier },
        ...(startTrial ? { trial_period_days: TRIAL_DAYS } : {}),
      },
      success_url: `${webOrigin}/teams/${teamId}?billing=success`,
      cancel_url: `${webOrigin}/teams/${teamId}?billing=cancelled`,
      metadata: { teamId, tier },
    });
    if (!session.url) {
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout URL.',
      );
    }
    return { url: session.url };
  }

  async createPortalSession(teamId: string): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const team = await this.prisma.team.findUniqueOrThrow({
      where: { id: teamId },
    });
    if (!team.stripeCustomerId) {
      throw new BadRequestException(
        'This team has no billing account yet — upgrade first.',
      );
    }
    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: team.stripeCustomerId,
      return_url: `${webOrigin}/teams/${teamId}`,
    });
    return { url: session.url };
  }

  async createPersonalCheckoutSession(
    userId: string,
    tier: PaidTier,
  ): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const priceId = process.env[PRICE_ENV_BY_TIER[tier]];
    if (!priceId) {
      throw new ServiceUnavailableException(
        `${PRICE_ENV_BY_TIER[tier]} is not configured.`,
      );
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name ?? undefined,
        metadata: { userId },
      });
      customerId = customer.id;
      await this.prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Same one-trial-ever rule as teams, and for the same reason: only
    // persisted once checkout actually completes (see the webhook below).
    const startTrial = tier === 'PRO' && !user.trialUsed;

    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { userId, tier },
        ...(startTrial ? { trial_period_days: TRIAL_DAYS } : {}),
      },
      success_url: `${webOrigin}/billing?billing=success`,
      cancel_url: `${webOrigin}/billing?billing=cancelled`,
      metadata: { userId, tier },
    });
    if (!session.url) {
      throw new ServiceUnavailableException(
        'Stripe did not return a checkout URL.',
      );
    }
    return { url: session.url };
  }

  async createPersonalPortalSession(userId: string): Promise<{ url: string }> {
    const stripe = this.requireStripe();
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.stripeCustomerId) {
      throw new BadRequestException(
        'You have no billing account yet — upgrade first.',
      );
    }
    const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${webOrigin}/billing`,
    });
    return { url: session.url };
  }

  // Raw signature verification, then sync Team.planTier from whatever
  // Stripe just told us — this is the only place plan state changes as a
  // result of a real payment event, never from the checkout redirect
  // itself (which the browser could reload/replay).
  async handleWebhookEvent(rawBody: Buffer, signature: string): Promise<void> {
    const stripe = this.requireStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET is not configured.',
      );
    }

    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret,
    );

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const teamId = session.metadata?.teamId;
        const userId = session.metadata?.userId;
        const tier = tierFromMetadata(session.metadata?.tier);
        if (typeof session.subscription !== 'string') break;

        if (teamId) {
          await this.prisma.team.update({
            where: { id: teamId },
            data: {
              planTier: tier,
              stripeSubscriptionId: session.subscription,
              stripeSubscriptionStatus: 'active',
              // First successful checkout of any paid tier retires trial
              // eligibility for this team, whether or not this particular
              // checkout was itself the trial.
              trialUsed: true,
            },
          });
        } else if (userId) {
          await this.prisma.user.update({
            where: { id: userId },
            data: {
              planTier: tier,
              stripeSubscriptionId: session.subscription,
              stripeSubscriptionStatus: 'active',
              trialUsed: true,
            },
          });
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const active =
          subscription.status === 'active' ||
          subscription.status === 'trialing';
        const tier = tierFromMetadata(subscription.metadata?.tier);

        const team = await this.prisma.team.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (team) {
          await this.prisma.team.update({
            where: { id: team.id },
            data: {
              planTier: active ? tier : 'FREE',
              stripeSubscriptionStatus: subscription.status,
            },
          });
          break;
        }

        const user = await this.prisma.user.findFirst({
          where: { stripeSubscriptionId: subscription.id },
        });
        if (user) {
          await this.prisma.user.update({
            where: { id: user.id },
            data: {
              planTier: active ? tier : 'FREE',
              stripeSubscriptionStatus: subscription.status,
            },
          });
        }
        break;
      }
      default:
        break;
    }
  }
}

// Metadata round-trips through Stripe as a plain string map — narrow it
// back to a known tier, defaulting to 'PRO' for older sessions/subscriptions
// created before the 'tier' metadata key existed.
function tierFromMetadata(value: string | undefined): PaidTier {
  return value === 'ULTIMATE' ? 'ULTIMATE' : 'PRO';
}
