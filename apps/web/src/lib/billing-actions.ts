'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from './api-client';
import { getAccessToken } from './session';
import type {
  BillingStatus,
  InvoiceSummary,
  PaidTier,
  PaymentMethodInfo,
  SubscriptionDetails,
} from './teams/types';

// Individual (non-team) billing — a solo user's own subscription for their
// personal projects. Mirrors apps/web/src/app/teams/actions.ts's billing
// functions one-for-one, just without a teamId (the API scopes these to
// the current user via the JWT instead).

export async function getPersonalBillingStatusAction(): Promise<BillingStatus> {
  const accessToken = await getAccessToken();
  return apiFetch<BillingStatus>('/billing', accessToken);
}

export async function getPersonalSubscriptionDetailsAction(): Promise<SubscriptionDetails> {
  const accessToken = await getAccessToken();
  return apiFetch<SubscriptionDetails>('/billing/subscription', accessToken);
}

export async function getPersonalPaymentMethodAction(): Promise<PaymentMethodInfo | null> {
  const accessToken = await getAccessToken();
  return apiFetch<PaymentMethodInfo | null>('/billing/payment-method', accessToken);
}

export async function getPersonalInvoicesAction(): Promise<InvoiceSummary[]> {
  const accessToken = await getAccessToken();
  return apiFetch<InvoiceSummary[]>('/billing/invoices', accessToken);
}

export async function startPersonalCheckoutAction(tier: PaidTier): Promise<{ url: string }> {
  const accessToken = await getAccessToken();
  return apiFetch<{ url: string }>('/billing/checkout', accessToken, {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });
}

export async function openPersonalBillingPortalAction(): Promise<{ url: string }> {
  const accessToken = await getAccessToken();
  return apiFetch<{ url: string }>('/billing/portal', accessToken, { method: 'POST' });
}

export async function cancelPersonalSubscriptionAction(): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch('/billing/cancel', accessToken, { method: 'POST' });
  revalidatePath('/billing');
}
