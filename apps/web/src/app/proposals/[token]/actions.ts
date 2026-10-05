'use server';

import { apiFetch } from '@/lib/api-client';
import type { Proposal } from '@/lib/editor/proposal-types';

// No access token — same anonymous model as the /share/[token] viewer (see
// ProposalsService.resolvePublic/respondPublic).
export async function respondToProposalAction(
  token: string,
  status: 'ACCEPTED' | 'DECLINED',
): Promise<Proposal> {
  return apiFetch<Proposal>(`/proposal-view/${token}/respond`, undefined, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}
