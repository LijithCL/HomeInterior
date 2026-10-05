'use client';

import { useState } from 'react';
import type { Proposal } from '@/lib/editor/proposal-types';
import { respondToProposalAction } from '@/app/proposals/[token]/actions';

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const STATUS_LABEL: Record<Proposal['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Awaiting your response',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
};

interface ProposalViewerProps {
  token: string;
  proposal: Proposal;
  projectName: string;
}

export function ProposalViewer({ token, proposal: initial, projectName }: ProposalViewerProps) {
  const [proposal, setProposal] = useState(initial);
  const [responding, setResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(status: 'ACCEPTED' | 'DECLINED') {
    setResponding(true);
    setError(null);
    try {
      setProposal(await respondToProposalAction(token, status));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your response. Please try again.');
    } finally {
      setResponding(false);
    }
  }

  const lineItemsTotal = proposal.lineItems.reduce((sum, item) => sum + item.amountCents, 0);

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <div className="print:hidden mb-6 flex items-center justify-between">
        <span className="text-sm text-neutral-400">Proposal from {projectName}</span>
        <button
          onClick={() => window.print()}
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-8 shadow-sm print:border-0 print:shadow-none">
        <div className="mb-6 flex items-start justify-between border-b border-neutral-200 pb-6">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{proposal.title}</h1>
            <p className="mt-1 text-sm text-neutral-500">For &ldquo;{projectName}&rdquo;</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              proposal.status === 'ACCEPTED'
                ? 'bg-sage-light text-sage'
                : proposal.status === 'DECLINED'
                  ? 'bg-red-50 text-red-600'
                  : 'bg-accent-light text-accent'
            }`}
          >
            {STATUS_LABEL[proposal.status]}
          </span>
        </div>

        {proposal.notes && <p className="mb-6 whitespace-pre-wrap text-sm text-neutral-600">{proposal.notes}</p>}

        <table className="mb-4 w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-400">
              <th className="pb-2 font-medium">Item</th>
              <th className="pb-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {proposal.lineItems.map((item, i) => (
              <tr key={i} className="border-b border-neutral-100">
                <td className="py-2 text-neutral-700">
                  {item.label} <span className="text-neutral-400">({item.quantityLabel})</span>
                </td>
                <td className="py-2 text-right text-neutral-700">{formatUsd(item.amountCents)}</td>
              </tr>
            ))}
            {proposal.designFeeCents > 0 && (
              <tr className="border-b border-neutral-100">
                <td className="py-2 text-neutral-700">Design fee</td>
                <td className="py-2 text-right text-neutral-700">{formatUsd(proposal.designFeeCents)}</td>
              </tr>
            )}
            {proposal.lineItems.length === 0 && proposal.designFeeCents === 0 && (
              <tr>
                <td colSpan={2} className="py-4 text-center text-neutral-400">
                  No line items.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between border-t border-neutral-200 pt-4 text-base font-semibold text-neutral-900">
          <span>Total</span>
          <span>{formatUsd(lineItemsTotal + proposal.designFeeCents)}</span>
        </div>

        {proposal.status === 'SENT' && (
          <div className="print:hidden mt-8 flex items-center gap-3 border-t border-neutral-200 pt-6">
            <button
              onClick={() => respond('ACCEPTED')}
              disabled={responding}
              className="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-dark disabled:opacity-50"
            >
              Accept proposal
            </button>
            <button
              onClick={() => respond('DECLINED')}
              disabled={responding}
              className="rounded border border-neutral-300 px-4 py-2 text-sm text-neutral-700 disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        )}

        {proposal.status === 'ACCEPTED' && (
          <p className="print:hidden mt-8 text-sm text-sage">You accepted this proposal. Thank you!</p>
        )}
        {proposal.status === 'DECLINED' && (
          <p className="print:hidden mt-8 text-sm text-neutral-500">You declined this proposal.</p>
        )}
        {error && <p className="print:hidden mt-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
