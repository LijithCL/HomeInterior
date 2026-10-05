'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import { estimateCost } from '@/lib/editor/cost-estimate';
import type { Proposal } from '@/lib/editor/proposal-types';
import type { Asset } from '@/lib/editor/asset-types';

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

const STATUS_LABEL: Record<Proposal['status'], string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  DECLINED: 'Declined',
};

interface ProposalsPanelProps {
  projectId: string;
  assets: Asset[];
  createProposal: (
    projectId: string,
    input: { title: string; notes?: string; designFeeCents?: number; lineItems: Proposal['lineItems'] },
  ) => Promise<Proposal>;
  listProposals: (projectId: string) => Promise<Proposal[]>;
  sendProposal: (projectId: string, id: string) => Promise<Proposal>;
  deleteProposal: (projectId: string, id: string) => Promise<void>;
}

export function ProposalsPanel({
  projectId,
  assets,
  createProposal,
  listProposals,
  sendProposal,
  deleteProposal,
}: ProposalsPanelProps) {
  const document = useEditorStore((s) => s.document);
  const [open, setOpen] = useState(false);
  const [proposals, setProposals] = useState<Proposal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [designFee, setDesignFee] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setProposals(await listProposals(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load proposals.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && proposals === null) await refresh();
  }

  async function create() {
    if (!title.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const estimate = estimateCost(document, assets);
      const lineItems = [...estimate.furnitureItems, ...estimate.wallItems, ...estimate.floorItems];
      const parsedFee = parseFloat(designFee);
      await createProposal(projectId, {
        title: title.trim(),
        notes: notes.trim() || undefined,
        designFeeCents: Number.isFinite(parsedFee) ? Math.round(parsedFee * 100) : undefined,
        lineItems,
      });
      setTitle('');
      setNotes('');
      setDesignFee('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the proposal.');
    } finally {
      setLoading(false);
    }
  }

  async function send(id: string) {
    setLoading(true);
    try {
      await sendProposal(projectId, id);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function remove(id: string) {
    setLoading(true);
    try {
      await deleteProposal(projectId, id);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function copyLink(proposal: Proposal) {
    if (!proposal.shareToken) return;
    const url = `${window.location.origin}/proposals/${proposal.shareToken}`;
    await navigator.clipboard.writeText(url);
    setCopiedId(proposal.id);
    setTimeout(() => setCopiedId((id) => (id === proposal.id ? null : id)), 1500);
  }

  return (
    <div className="relative">
      <button onClick={toggleOpen} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
        Proposals
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            Send the client a cost breakdown from the current design, plus your fee and notes.
          </p>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          <div className="mb-3 flex flex-col gap-1.5 rounded border border-neutral-200 p-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Proposal title, e.g. Living room refresh"
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes for the client (optional)"
              rows={2}
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
            <div className="flex items-center gap-1">
              <span className="text-xs text-neutral-400">Design fee $</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={designFee}
                onChange={(e) => setDesignFee(e.target.value)}
                placeholder="0.00"
                className="w-24 rounded border border-neutral-300 px-2 py-1 text-sm"
              />
            </div>
            <button
              onClick={create}
              disabled={loading || !title.trim()}
              className="mt-1 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Create from current cost estimate
            </button>
          </div>

          <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {proposals?.map((proposal) => (
              <li key={proposal.id} className="rounded border border-neutral-200 p-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-neutral-800">{proposal.title}</span>
                  <span className="text-neutral-400">{STATUS_LABEL[proposal.status]}</span>
                </div>
                <div className="mt-0.5 text-neutral-500">{formatUsd(proposal.totalCents)}</div>
                <div className="mt-1.5 flex gap-2">
                  {proposal.status === 'DRAFT' && (
                    <button onClick={() => send(proposal.id)} className="text-accent hover:underline">
                      Send
                    </button>
                  )}
                  {proposal.shareToken && (
                    <button onClick={() => copyLink(proposal)} className="text-neutral-600 hover:underline">
                      {copiedId === proposal.id ? 'Copied' : 'Copy client link'}
                    </button>
                  )}
                  <button onClick={() => remove(proposal.id)} className="text-red-500 hover:underline">
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {proposals?.length === 0 && <li className="text-xs text-neutral-400">No proposals yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
