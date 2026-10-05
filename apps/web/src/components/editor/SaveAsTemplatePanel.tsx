'use client';

import { useState } from 'react';

interface SaveAsTemplatePanelProps {
  projectId: string;
  projectName: string;
  saveAsTemplate: (projectId: string, name: string, description?: string) => Promise<void>;
}

export function SaveAsTemplatePanel({ projectId, projectName, saveAsTemplate }: SaveAsTemplatePanelProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(projectName);
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await saveAsTemplate(projectId, name.trim(), description.trim() || undefined);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the template.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
        Save as template
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            Save this design&apos;s current layout as a reusable starting point in your template gallery.
          </p>
          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
          <label className="mb-2 flex flex-col gap-1 text-xs text-neutral-500">
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm" />
          </label>
          <label className="mb-3 flex flex-col gap-1 text-xs text-neutral-500">
            Description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded border border-neutral-300 px-2 py-1 text-sm"
            />
          </label>
          <button
            onClick={submit}
            disabled={busy || !name.trim()}
            className="w-full rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saved ? 'Saved ✓' : busy ? 'Saving…' : 'Save template'}
          </button>
        </div>
      )}
    </div>
  );
}
