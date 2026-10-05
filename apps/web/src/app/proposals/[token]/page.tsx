import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { PublicProposal } from '@/lib/editor/proposal-types';
import { ProposalViewer } from '@/components/proposals/ProposalViewer';

export default async function ProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let data: PublicProposal;
  try {
    // Deliberately no access token — a proposal link works for whoever the
    // designer sent it to, no account required (see ProposalsService.resolvePublic).
    data = await apiFetch<PublicProposal>(`/proposal-view/${token}`, undefined);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return <ProposalViewer token={token} proposal={data.proposal} projectName={data.projectName} />;
}
