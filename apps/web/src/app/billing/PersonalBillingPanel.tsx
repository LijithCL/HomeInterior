'use client';

import { useState } from 'react';
import type { BillingStatus, PaidTier, SubscriptionDetails } from '@/lib/teams/types';
import { PLAN_CATALOG, TRIAL_DAYS } from '@/lib/plans';
import {
  cancelPersonalSubscriptionAction,
  openPersonalBillingPortalAction,
  startPersonalCheckoutAction,
} from '@/lib/billing-actions';

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

interface PersonalBillingPanelProps {
  initialStatus: BillingStatus;
  subscription: SubscriptionDetails;
}

export function PersonalBillingPanel({ initialStatus, subscription }: PersonalBillingPanelProps) {
  const [status] = useState(initialStatus);
  const [busy, setBusy] = useState<PaidTier | 'portal' | 'cancel' | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = PLAN_CATALOG.find((p) => p.tier === status.planTier);
  const hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing';

  async function upgrade(tier: PaidTier) {
    setBusy(tier);
    setError(null);
    try {
      const { url } = await startPersonalCheckoutAction(tier);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setBusy(null);
    }
  }

  async function manage() {
    setBusy('portal');
    setError(null);
    try {
      const { url } = await openPersonalBillingPortalAction();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal.');
      setBusy(null);
    }
  }

  async function cancel() {
    if (!window.confirm('Cancel your subscription at the end of the current billing period?')) return;
    setBusy('cancel');
    setError(null);
    try {
      await cancelPersonalSubscriptionAction();
      setCancelled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the subscription.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-neutral-500">Current plan</p>
          <p className="text-2xl font-bold text-neutral-900">{currentPlan?.name ?? status.planTier}</p>
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

      {(subscription.trialEnd || subscription.currentPeriodEnd) && (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          {subscription.trialEnd && (
            <div>
              <dt className="text-neutral-500">Trial ends</dt>
              <dd className="font-medium text-neutral-900">{formatDate(subscription.trialEnd)}</dd>
            </div>
          )}
          {subscription.currentPeriodEnd && (
            <div>
              <dt className="text-neutral-500">{subscription.cancelAtPeriodEnd ? 'Access ends' : 'Renews'}</dt>
              <dd className="font-medium text-neutral-900">{formatDate(subscription.currentPeriodEnd)}</dd>
            </div>
          )}
        </dl>
      )}

      {(subscription.cancelAtPeriodEnd || cancelled) && (
        <p className="text-sm text-accent-dark">
          Your subscription will end at the current billing period&apos;s end.
        </p>
      )}

      {!status.configured && (
        <p className="text-xs text-neutral-400">
          Billing isn&apos;t configured in this environment yet — add Stripe test keys to apps/api/.env to enable it.
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PLAN_CATALOG.map((plan) => {
          const isCurrent = plan.tier === status.planTier;
          const isPaidTier = plan.tier === 'PRO' || plan.tier === 'ULTIMATE';
          return (
            <div
              key={plan.tier}
              className={`flex flex-col gap-3 rounded-lg border p-4 ${
                isCurrent ? 'border-accent bg-accent-light' : 'border-neutral-200'
              }`}
            >
              <div>
                <p className="font-semibold text-neutral-900">{plan.name}</p>
                <p className="text-xs text-neutral-500">{plan.tagline}</p>
              </div>
              <p className="text-2xl font-bold text-neutral-900">
                ${plan.priceMonthly}
                <span className="text-sm font-normal text-neutral-500">/mo</span>
              </p>
              <ul className="flex flex-col gap-1 text-xs text-neutral-600">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-accent">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>

              {status.configured && isPaidTier && (
                <button
                  onClick={() => upgrade(plan.tier as PaidTier)}
                  disabled={busy !== null || isCurrent}
                  className="mt-auto rounded bg-accent px-3 py-1.5 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
                >
                  {isCurrent
                    ? 'Current plan'
                    : busy === plan.tier
                      ? 'Redirecting…'
                      : plan.tier === 'PRO' && status.trialAvailable
                        ? `Start ${TRIAL_DAYS}-day free trial`
                        : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {status.configured && status.planTier !== 'FREE' && (
        <div className="flex items-center gap-3">
          <button
            onClick={manage}
            disabled={busy !== null}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-400 disabled:opacity-50"
          >
            {busy === 'portal' ? 'Redirecting…' : 'Manage billing & payment methods'}
          </button>
          {hasActiveSubscription && !subscription.cancelAtPeriodEnd && !cancelled && (
            <button
              onClick={cancel}
              disabled={busy !== null}
              className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              {busy === 'cancel' ? 'Cancelling…' : 'Cancel subscription'}
            </button>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
