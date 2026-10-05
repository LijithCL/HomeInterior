'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type {
  AnalyticsSummary,
  BillingStatus,
  InvoiceSummary,
  PaidTier,
  PaymentMethodInfo,
  SubscriptionDetails,
  TeamDetail,
} from '@/lib/teams/types';

export interface CreateTeamFormState {
  error?: string;
}

export async function createTeamAction(
  _prevState: CreateTeamFormState,
  formData: FormData,
): Promise<CreateTeamFormState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    return { error: 'Team name is required' };
  }

  const accessToken = await getAccessToken();
  try {
    await apiFetch('/teams', accessToken, { method: 'POST', body: JSON.stringify({ name }) });
  } catch {
    return { error: 'Could not create the team. Please try again.' };
  }

  revalidatePath('/teams');
  return {};
}

export async function getTeamAction(teamId: string): Promise<TeamDetail> {
  const accessToken = await getAccessToken();
  return apiFetch<TeamDetail>(`/teams/${teamId}`, accessToken);
}

export async function addTeamMemberAction(teamId: string, email: string, role: 'EDITOR' | 'VIEWER'): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/teams/${teamId}/members`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function updateTeamMemberRoleAction(
  teamId: string,
  userId: string,
  role: 'EDITOR' | 'VIEWER',
): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/teams/${teamId}/members/${userId}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ role }),
  });
}

export async function removeTeamMemberAction(teamId: string, userId: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/teams/${teamId}/members/${userId}`, accessToken, { method: 'DELETE' });
}

export async function getBillingStatusAction(teamId: string): Promise<BillingStatus> {
  const accessToken = await getAccessToken();
  return apiFetch<BillingStatus>(`/teams/${teamId}/billing`, accessToken);
}

export async function startCheckoutAction(teamId: string, tier: PaidTier): Promise<{ url: string }> {
  const accessToken = await getAccessToken();
  return apiFetch<{ url: string }>(`/teams/${teamId}/billing/checkout`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });
}

export async function openBillingPortalAction(teamId: string): Promise<{ url: string }> {
  const accessToken = await getAccessToken();
  return apiFetch<{ url: string }>(`/teams/${teamId}/billing/portal`, accessToken, { method: 'POST' });
}

export async function getAnalyticsSummaryAction(teamId?: string): Promise<AnalyticsSummary> {
  const accessToken = await getAccessToken();
  const qs = teamId ? `?teamId=${teamId}` : '';
  return apiFetch<AnalyticsSummary>(`/analytics/summary${qs}`, accessToken);
}

export async function getSubscriptionDetailsAction(teamId: string): Promise<SubscriptionDetails> {
  const accessToken = await getAccessToken();
  return apiFetch<SubscriptionDetails>(`/teams/${teamId}/billing/subscription`, accessToken);
}

export async function getPaymentMethodAction(teamId: string): Promise<PaymentMethodInfo | null> {
  const accessToken = await getAccessToken();
  return apiFetch<PaymentMethodInfo | null>(`/teams/${teamId}/billing/payment-method`, accessToken);
}

export async function getInvoicesAction(teamId: string): Promise<InvoiceSummary[]> {
  const accessToken = await getAccessToken();
  return apiFetch<InvoiceSummary[]>(`/teams/${teamId}/billing/invoices`, accessToken);
}

export async function cancelSubscriptionAction(teamId: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/teams/${teamId}/billing/cancel`, accessToken, { method: 'POST' });
  revalidatePath(`/teams/${teamId}/subscription`);
}
