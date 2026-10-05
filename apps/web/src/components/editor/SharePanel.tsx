'use client';

import { useState } from 'react';
import type { ShareLink } from '@/lib/editor/share-types';

interface SharePanelProps {
  projectId: string;
  createShareLink: (projectId: string) => Promise<ShareLink>;
  listShareLinks: (projectId: string) => Promise<ShareLink[]>;
  revokeShareLink: (projectId: string, id: string) => Promise<ShareLink>;
}

function isActive(link: ShareLink): boolean {
  if (link.revokedAt) return false;
  if (link.expiresAt && new Date(link.expiresAt) < new Date()) return false;
  return true;
}

export function SharePanel({ projectId, createShareLink, listShareLinks, revokeShareLink }: SharePanelProps) {
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<ShareLink[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setLinks(await listShareLinks(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load share links.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && links === null) await refresh();
  }

  async function create() {
    setLoading(true);
    setError(null);
    try {
      await createShareLink(projectId);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a share link.');
    } finally {
      setLoading(false);
    }
  }

  async function revoke(id: string) {
    setLoading(true);
    try {
      await revokeShareLink(projectId, id);
      await refresh();
    } finally {
      setLoading(false);
    }
  }

  async function copy(link: ShareLink) {
    await navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId((id) => (id === link.id ? null : id)), 1500);
  }

  return (
    <div className="relative">
      <button onClick={toggleOpen} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
        Share
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            Anyone with a link below can view this design — no account needed. They can&apos;t edit or save anything.
          </p>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          <button
            onClick={create}
            disabled={loading}
            className="mb-2 w-full rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Working…' : 'Create view-only link'}
          </button>

          <ul className="flex max-h-56 flex-col gap-2 overflow-y-auto">
            {links?.map((link) => (
              <li key={link.id} className="flex items-center gap-2 rounded border border-neutral-200 p-2 text-xs">
                <span className="flex-1 truncate text-neutral-600">{link.url}</span>
                {isActive(link) ? (
                  <>
                    <button onClick={() => copy(link)} className="rounded border border-neutral-300 px-2 py-1 text-neutral-700">
                      {copiedId === link.id ? 'Copied' : 'Copy'}
                    </button>
                    <button onClick={() => revoke(link.id)} className="rounded border border-red-200 px-2 py-1 text-red-600">
                      Revoke
                    </button>
                  </>
                ) : (
                  <span className="text-neutral-400">Revoked</span>
                )}
              </li>
            ))}
            {links?.length === 0 && <li className="text-xs text-neutral-400">No share links yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
