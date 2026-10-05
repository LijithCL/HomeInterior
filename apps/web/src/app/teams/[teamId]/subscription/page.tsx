import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { BillingStatus, SubscriptionDetails, TeamDetail } from '@/lib/teams/types';
import { PLAN_CATALOG } from '@/lib/plans';
import { AccountNav } from '@/components/AccountNav';
import { PortalButton } from '../PortalButton';
import { CancelSubscriptionButton } from './CancelSubscriptionButton';

function formatDate(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function formatPrice(amount: number, currency: string): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount / 100);
}

export default async function SubscriptionPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  let team: TeamDetail;
  let billing: BillingStatus;
  let subscription: SubscriptionDetails;
  try {
    [team, billing, subscription] = await Promise.all([
      apiFetch<TeamDetail>(`/teams/${teamId}`, accessToken),
      apiFetch<BillingStatus>(`/teams/${teamId}/billing`, accessToken),
      apiFetch<SubscriptionDetails>(`/teams/${teamId}/billing/subscription`, accessToken),
    ]);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect('/login');
      if (err.status === 404) notFound();
    }
    throw err;
  }

  const isOwner = team.myRole === 'OWNER';
  const plan = PLAN_CATALOG.find((p) => p.tier === subscription.planTier);
  const hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing';

  return (
    <div className="min-h-screen bg-cream">
      <AccountNav active="/teams" />

      <div className="px-6 py-10 sm:px-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">Subscription — {team.name}</h1>
          <Link href={`/teams/${teamId}`} className="text-sm text-neutral-500 hover:text-accent">
            ← {team.name}
          </Link>
        </div>

        {!billing.configured && (
          <p className="mb-6 text-sm text-neutral-400">
            Billing isn&apos;t configured in this environment yet — add Stripe test keys to apps/api/.env to enable
            it.
          </p>
        )}

        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-500">Current plan</p>
                <p className="text-2xl font-bold text-neutral-900">{plan?.name ?? subscription.planTier}</p>
                {subscription.priceAmount !== null && subscription.currency && (
                  <p className="text-sm text-neutral-500">
                    {formatPrice(subscription.priceAmount, subscription.currency)}/mo
                  </p>
                )}
              </div>
              {subscription.status && (
                <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-medium text-accent-dark">
                  {subscription.status}
                </span>
              )}
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              {subscription.trialEnd && (
                <div>
                  <dt className="text-neutral-500">Trial ends</dt>
                  <dd className="font-medium text-neutral-900">{formatDate(subscription.trialEnd)}</dd>
                </div>
              )}
              {subscription.currentPeriodEnd && (
                <div>
                  <dt className="text-neutral-500">
                    {subscription.cancelAtPeriodEnd ? 'Access ends' : 'Renews'}
                  </dt>
                  <dd className="font-medium text-neutral-900">{formatDate(subscription.currentPeriodEnd)}</dd>
                </div>
              )}
            </dl>

            {subscription.cancelAtPeriodEnd && (
              <p className="mt-4 text-sm text-accent-dark">
                This subscription is set to cancel at the end of the current period.
              </p>
            )}

            {billing.configured && isOwner && (
              <div className="mt-6 flex items-center gap-3">
                <PortalButton teamId={teamId} label="Manage billing" />
                {hasActiveSubscription && !subscription.cancelAtPeriodEnd && (
                  <CancelSubscriptionButton teamId={teamId} />
                )}
                <Link href={`/teams/${teamId}/payment`} className="text-sm text-accent hover:underline">
                  Payment methods & invoices →
                </Link>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">All plans</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {PLAN_CATALOG.map((p) => (
                <div
                  key={p.tier}
                  className={`rounded-lg border p-4 ${
                    p.tier === subscription.planTier ? 'border-accent bg-accent-light' : 'border-neutral-200'
                  }`}
                >
                  <p className="font-semibold text-neutral-900">{p.name}</p>
                  <p className="text-lg font-bold text-neutral-900">
                    ${p.priceMonthly}
                    <span className="text-xs font-normal text-neutral-500">/mo</span>
                  </p>
                  <ul className="mt-2 flex flex-col gap-1 text-xs text-neutral-600">
                    {p.features.map((feature) => (
                      <li key={feature}>✓ {feature}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Link href={`/teams/${teamId}`} className="mt-4 inline-block text-sm text-accent hover:underline">
              Change plan on the team page →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}
