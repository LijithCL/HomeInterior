'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { DesignVersionFull, DesignVersionSummary } from '@/app/editor/[projectId]/actions';

interface VersionHistoryPanelProps {
  projectId: string;
  listVersions: (projectId: string) => Promise<DesignVersionSummary[]>;
  restoreVersion: (projectId: string, versionNum: number) => Promise<DesignVersionFull>;
}

export function VersionHistoryPanel({ projectId, listVersions, restoreVersion }: VersionHistoryPanelProps) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<DesignVersionSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [restoringNum, setRestoringNum] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loadDocument = useEditorStore((s) => s.loadDocument);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setVersions(await listVersions(projectId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load version history.');
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) await refresh();
  }

  async function restore(versionNum: number) {
    setRestoringNum(versionNum);
    setError(null);
    try {
      const restored = await restoreVersion(projectId, versionNum);
      loadDocument(restored.document);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore that version.');
    } finally {
      setRestoringNum(null);
    }
  }

  return (
    <div className="relative">
      <button onClick={toggleOpen} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
        History
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            Every save is kept. Restoring an older version saves it again as the newest — nothing is deleted.
          </p>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          {loading && <p className="text-xs text-neutral-400">Loading…</p>}

          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {versions?.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 rounded border border-neutral-200 p-2 text-xs">
                <div>
                  <p className="font-medium text-neutral-900">Version {v.versionNum}</p>
                  <p className="text-neutral-500">{new Date(v.createdAt).toLocaleString()}</p>
                </div>
                <button
                  onClick={() => restore(v.versionNum)}
                  disabled={restoringNum !== null}
                  className="rounded border border-neutral-300 px-2 py-1 text-neutral-700 disabled:opacity-40"
                >
                  {restoringNum === v.versionNum ? 'Restoring…' : 'Restore'}
                </button>
              </li>
            ))}
            {versions?.length === 0 && <li className="text-xs text-neutral-400">No saved versions yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
