import { BillingService } from './billing.service';
import type { PrismaService } from '../prisma/prisma.service';

// getEffectivePlan is the one function standing between a FREE user and
// an HQ render they didn't pay for (see RenderService.create). No Stripe
// keys are involved in this logic at all — it's pure DB lookup — so it's
// tested directly rather than through a live Stripe test-mode call.
function makePrismaMock() {
  return {
    team: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };
}

// checkout.sessions.create / webhooks.constructEvent are the two Stripe
// calls whose *inputs and outputs* this suite cares about (trial eligibility,
// which price/tier gets billed, how plan state is derived from an event) —
// mocking the `stripe` package keeps these tests fast and offline while
// still exercising the real BillingService code path end to end.
const stripeMock = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  webhooks: { constructEvent: jest.fn() },
};
jest.mock('stripe', () => jest.fn(() => stripeMock));

interface CapturedCheckoutParams {
  subscription_data: {
    trial_period_days?: number;
    metadata?: Record<string, string>;
  };
  line_items: Array<{ price: string; quantity: number }>;
  metadata: Record<string, string>;
}

function lastCheckoutCall(): CapturedCheckoutParams {
  const calls = stripeMock.checkout.sessions.create.mock
    .calls as unknown as CapturedCheckoutParams[][];
  return calls[calls.length - 1][0];
}

describe('BillingService.getEffectivePlan', () => {
  it("uses the project's own team plan when the project belongs to a team", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({ id: 'team-1', planTier: 'PRO' });
    const service = new BillingService(prisma as unknown as PrismaService);

    const plan = await service.getEffectivePlan({
      teamId: 'team-1',
      ownerId: 'user-1',
    });
    expect(plan).toBe('PRO');
    expect(prisma.team.findFirst).not.toHaveBeenCalled();
  });

  it('treats a missing team record as FREE (defensive default)', async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue(null);
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(
      await service.getEffectivePlan({ teamId: 'team-1', ownerId: 'user-1' }),
    ).toBe('FREE');
  });

  it('falls back to a Pro team the owner owns, when the owner has no personal paid plan', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      planTier: 'FREE',
    });
    prisma.team.findFirst.mockResolvedValue({
      id: 'team-2',
      ownerId: 'user-1',
      planTier: 'PRO',
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    const plan = await service.getEffectivePlan({
      teamId: null,
      ownerId: 'user-1',
    });
    expect(plan).toBe('PRO');
    expect(prisma.team.findFirst).toHaveBeenCalledWith({
      where: { ownerId: 'user-1', planTier: { in: ['PRO', 'ULTIMATE'] } },
    });
  });

  it('falls back to an Ultimate team the owner owns (not just Pro)', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      planTier: 'FREE',
    });
    prisma.team.findFirst.mockResolvedValue({
      id: 'team-2',
      ownerId: 'user-1',
      planTier: 'ULTIMATE',
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(
      await service.getEffectivePlan({ teamId: null, ownerId: 'user-1' }),
    ).toBe('ULTIMATE');
  });

  it('is FREE for a personal project when the owner has no personal plan and owns no paid team', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      planTier: 'FREE',
    });
    prisma.team.findFirst.mockResolvedValue(null);
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(
      await service.getEffectivePlan({ teamId: null, ownerId: 'user-1' }),
    ).toBe('FREE');
  });

  it("prefers the owner's own personal plan over any team they own", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      planTier: 'ULTIMATE',
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    const plan = await service.getEffectivePlan({
      teamId: null,
      ownerId: 'user-1',
    });
    expect(plan).toBe('ULTIMATE');
    // Never even needs to check for an owned team once the owner has their
    // own paid plan.
    expect(prisma.team.findFirst).not.toHaveBeenCalled();
  });

  it("uses the project's own team plan when it is ULTIMATE", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUnique.mockResolvedValue({
      id: 'team-1',
      planTier: 'ULTIMATE',
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(
      await service.getEffectivePlan({ teamId: 'team-1', ownerId: 'user-1' }),
    ).toBe('ULTIMATE');
  });
});

describe('BillingService.configured', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it('is false with no STRIPE_SECRET_KEY set — the "not configured" fallback path', () => {
    delete process.env.STRIPE_SECRET_KEY;
    const service = new BillingService({} as unknown as PrismaService);
    expect(service.configured).toBe(false);
  });

  it('is true once a key is present', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_this_test_only';
    const service = new BillingService({} as unknown as PrismaService);
    expect(service.configured).toBe(true);
  });
});

describe('BillingService.createCheckoutSession', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_this_test_only';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
    process.env.STRIPE_ULTIMATE_PRICE_ID = 'price_ultimate';
    process.env.WEB_ORIGIN = 'https://app.example.test';
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.example/session',
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("grants a 30-day trial on a team's first Pro checkout", async () => {
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      id: 'team-1',
      name: 'Team 1',
      stripeCustomerId: 'cus_1',
      trialUsed: false,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.createCheckoutSession('user-1', 'team-1', 'PRO');

    const call = lastCheckoutCall();
    expect(call.subscription_data.trial_period_days).toBe(30);
    expect(call.subscription_data.metadata).toEqual({
      teamId: 'team-1',
      tier: 'PRO',
    });
    // Trial eligibility is only persisted once checkout completes (webhook),
    // never eagerly at session creation — an abandoned checkout shouldn't
    // burn the team's one-time trial.
    expect(prisma.team.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { trialUsed: true } }),
    );
  });

  it('does not grant a second trial once trialUsed is true', async () => {
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      id: 'team-1',
      name: 'Team 1',
      stripeCustomerId: 'cus_1',
      trialUsed: true,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.createCheckoutSession('user-1', 'team-1', 'PRO');

    const call = lastCheckoutCall();
    expect(call.subscription_data.trial_period_days).toBeUndefined();
  });

  it('never grants a trial for the Ultimate tier', async () => {
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      id: 'team-1',
      name: 'Team 1',
      stripeCustomerId: 'cus_1',
      trialUsed: false,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.createCheckoutSession('user-1', 'team-1', 'ULTIMATE');

    const call = lastCheckoutCall();
    expect(call.subscription_data.trial_period_days).toBeUndefined();
    expect(call.line_items).toEqual([{ price: 'price_ultimate', quantity: 1 }]);
  });

  it("throws when the tier's price id env var is not configured", async () => {
    delete process.env.STRIPE_ULTIMATE_PRICE_ID;
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      id: 'team-1',
      name: 'Team 1',
      stripeCustomerId: 'cus_1',
      trialUsed: false,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    await expect(
      service.createCheckoutSession('user-1', 'team-1', 'ULTIMATE'),
    ).rejects.toThrow(/STRIPE_ULTIMATE_PRICE_ID/);
  });
});

describe('BillingService.handleWebhookEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_this_test_only';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
  });

  it('sets the team to the checked-out tier and marks the trial used on checkout.session.completed', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { teamId: 'team-1', tier: 'ULTIMATE' },
          subscription: 'sub_1',
        },
      },
    });
    const prisma = makePrismaMock();
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.handleWebhookEvent(Buffer.from(''), 'sig');

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: {
        planTier: 'ULTIMATE',
        stripeSubscriptionId: 'sub_1',
        stripeSubscriptionStatus: 'active',
        trialUsed: true,
      },
    });
  });

  it('defaults to PRO when a session has no tier metadata (pre-Ultimate sessions)', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: { metadata: { teamId: 'team-1' }, subscription: 'sub_1' },
      },
    });
    const prisma = makePrismaMock();
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.handleWebhookEvent(Buffer.from(''), 'sig');

    /* eslint-disable @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining is untyped in @types/jest */
    expect(prisma.team.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planTier: 'PRO' }),
      }),
    );
    /* eslint-enable @typescript-eslint/no-unsafe-assignment */
  });

  it('downgrades to FREE (keeping no tier) when a subscription is cancelled', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_1',
          status: 'canceled',
          metadata: { tier: 'ULTIMATE' },
        },
      },
    });
    const prisma = makePrismaMock();
    prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.handleWebhookEvent(Buffer.from(''), 'sig');

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { planTier: 'FREE', stripeSubscriptionStatus: 'canceled' },
    });
  });

  it('keeps the metadata tier active while trialing', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: { id: 'sub_1', status: 'trialing', metadata: { tier: 'PRO' } },
      },
    });
    const prisma = makePrismaMock();
    prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.handleWebhookEvent(Buffer.from(''), 'sig');

    expect(prisma.team.update).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      data: { planTier: 'PRO', stripeSubscriptionStatus: 'trialing' },
    });
  });
});

// These three all back the dedicated Subscription/Payment pages. None of
// them should ever throw just because billing isn't configured or the team
// hasn't subscribed yet — the pages need a sensible empty state, not a 503.
describe('BillingService read-only billing details (unconfigured/no-subscription fallbacks)', () => {
  const originalKey = process.env.STRIPE_SECRET_KEY;
  afterEach(() => {
    if (originalKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = originalKey;
  });

  it('getSubscriptionDetails falls back to Team-table fields when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      planTier: 'PRO',
      stripeSubscriptionStatus: 'active',
      stripeSubscriptionId: 'sub_1',
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(await service.getSubscriptionDetails('team-1')).toEqual({
      planTier: 'PRO',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEnd: null,
      priceAmount: null,
      currency: null,
    });
  });

  it('getSubscriptionDetails falls back when configured but the team never subscribed', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_this_test_only';
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      planTier: 'FREE',
      stripeSubscriptionStatus: null,
      stripeSubscriptionId: null,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(await service.getSubscriptionDetails('team-1')).toEqual({
      planTier: 'FREE',
      status: null,
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      trialEnd: null,
      priceAmount: null,
      currency: null,
    });
  });

  it('getPaymentMethod returns null when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: 'cus_1',
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(await service.getPaymentMethod('team-1')).toBeNull();
  });

  it('getPaymentMethod returns null when the team has no Stripe customer yet', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_this_test_only';
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({ stripeCustomerId: null });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(await service.getPaymentMethod('team-1')).toBeNull();
  });

  it('listInvoices returns an empty list when Stripe is not configured', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      stripeCustomerId: 'cus_1',
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(await service.listInvoices('team-1')).toEqual([]);
  });

  it('cancelSubscription rejects a team with no active subscription', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_this_test_only';
    const prisma = makePrismaMock();
    prisma.team.findUniqueOrThrow.mockResolvedValue({
      stripeSubscriptionId: null,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    await expect(service.cancelSubscription('team-1')).rejects.toThrow(
      /no active subscription/,
    );
  });
});

// Personal (individual, non-team) billing — same mechanics as the team
// methods above, just against User instead of Team. Only the paths that
// differ from the team versions are covered here in depth; the shared
// Stripe-shape mapping is already exercised by the team tests.
describe('BillingService personal billing', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_key_for_this_test_only';
    process.env.STRIPE_PRO_PRICE_ID = 'price_pro';
    process.env.STRIPE_ULTIMATE_PRICE_ID = 'price_ultimate';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.WEB_ORIGIN = 'https://app.example.test';
    stripeMock.checkout.sessions.create.mockResolvedValue({
      url: 'https://checkout.example/session',
    });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("creates a Stripe customer under the user's own email on first personal checkout", async () => {
    const prisma = makePrismaMock();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      id: 'user-1',
      email: 'solo@example.com',
      name: 'Solo Designer',
      stripeCustomerId: null,
      trialUsed: false,
    });
    stripeMock.customers.create.mockResolvedValue({ id: 'cus_solo' });
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.createPersonalCheckoutSession('user-1', 'PRO');

    expect(stripeMock.customers.create).toHaveBeenCalledWith({
      email: 'solo@example.com',
      name: 'Solo Designer',
      metadata: { userId: 'user-1' },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { stripeCustomerId: 'cus_solo' },
    });
    const call = lastCheckoutCall();
    expect(call.subscription_data.trial_period_days).toBe(30);
    expect(call.subscription_data.metadata).toEqual({
      userId: 'user-1',
      tier: 'PRO',
    });
  });

  it('getPersonalBillingStatus reports the user-level plan fields', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      planTier: 'PRO',
      stripeSubscriptionStatus: 'active',
      trialUsed: true,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    expect(await service.getPersonalBillingStatus('user-1')).toEqual({
      configured: true,
      planTier: 'PRO',
      subscriptionStatus: 'active',
      trialUsed: true,
      trialAvailable: false,
    });
  });

  it('cancelPersonalSubscription rejects a user with no active subscription', async () => {
    const prisma = makePrismaMock();
    prisma.user.findUniqueOrThrow.mockResolvedValue({
      stripeSubscriptionId: null,
    });
    const service = new BillingService(prisma as unknown as PrismaService);

    await expect(service.cancelPersonalSubscription('user-1')).rejects.toThrow(
      /no active subscription/,
    );
  });

  it('webhook checkout.session.completed updates the User when metadata has userId (no teamId)', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          metadata: { userId: 'user-1', tier: 'ULTIMATE' },
          subscription: 'sub_solo',
        },
      },
    });
    const prisma = makePrismaMock();
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.handleWebhookEvent(Buffer.from(''), 'sig');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        planTier: 'ULTIMATE',
        stripeSubscriptionId: 'sub_solo',
        stripeSubscriptionStatus: 'active',
        trialUsed: true,
      },
    });
    expect(prisma.team.update).not.toHaveBeenCalled();
  });

  it('webhook subscription.updated falls back to updating the User when no team owns that subscription', async () => {
    stripeMock.webhooks.constructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: { id: 'sub_solo', status: 'active', metadata: { tier: 'PRO' } },
      },
    });
    const prisma = makePrismaMock();
    prisma.team.findFirst.mockResolvedValue(null);
    prisma.user.findFirst.mockResolvedValue({ id: 'user-1' });
    const service = new BillingService(prisma as unknown as PrismaService);

    await service.handleWebhookEvent(Buffer.from(''), 'sig');

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { planTier: 'PRO', stripeSubscriptionStatus: 'active' },
    });
  });
});
