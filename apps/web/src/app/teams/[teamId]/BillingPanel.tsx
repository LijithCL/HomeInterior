'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { BillingStatus, PaidTier } from '@/lib/teams/types';
import { PLAN_CATALOG, TRIAL_DAYS } from '@/lib/plans';
import { openBillingPortalAction, startCheckoutAction } from '../actions';

interface BillingPanelProps {
  teamId: string;
  initialStatus: BillingStatus;
  isOwner: boolean;
}

export function BillingPanel({ teamId, initialStatus, isOwner }: BillingPanelProps) {
  const [status] = useState(initialStatus);
  const [busy, setBusy] = useState<PaidTier | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = PLAN_CATALOG.find((p) => p.tier === status.planTier);

  async function upgrade(tier: PaidTier) {
    setBusy(tier);
    setError(null);
    try {
      const { url } = await startCheckoutAction(teamId, tier);
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
      const { url } = await openBillingPortalAction(teamId);
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal.');
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-700">
          Current plan: <span className="font-medium text-neutral-900">{currentPlan?.name ?? status.planTier}</span>
          {status.subscriptionStatus && <span className="text-neutral-400"> · {status.subscriptionStatus}</span>}
        </p>
        <div className="flex gap-3 text-xs">
          <Link href={`/teams/${teamId}/subscription`} className="text-accent hover:underline">
            Subscription details
          </Link>
          <Link href={`/teams/${teamId}/payment`} className="text-accent hover:underline">
            Payment
          </Link>
        </div>
      </div>

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

              {status.configured && isOwner && isPaidTier && (
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

      {status.configured && isOwner && status.planTier !== 'FREE' && (
        <div>
          <p className="mb-1 text-xs text-neutral-500">Manage your subscription and payment methods:</p>
          <button
            onClick={manage}
            disabled={busy !== null}
            className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-400 disabled:opacity-50"
          >
            {busy === 'portal' ? 'Redirecting…' : 'Manage billing & payment methods'}
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
