'use client';

import { useState } from 'react';
import { deleteProjectAction } from './actions';

export function DeleteProjectButton({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (!window.confirm(`Delete "${projectName}"? This can't be undone.`)) return;
    setBusy(true);
    try {
      await deleteProjectAction(projectId);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Could not delete the project.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={busy}
      title="Delete project"
      className="rounded-md border border-neutral-200 px-2 py-1.5 text-xs text-neutral-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
