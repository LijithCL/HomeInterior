'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import { documentCounts, type AiRequest } from '@/lib/editor/ai-types';
import type { DesignDocument } from '@/lib/editor/document';

type Mode = 'generate' | 'edit' | 'photo';

const MODE_LABELS: Record<Mode, string> = {
  generate: 'Generate',
  edit: 'Edit design',
  photo: 'From photo',
};

const MODE_PLACEHOLDERS: Record<Mode, string> = {
  generate: 'e.g. "Design a modern 3-bedroom house with a study and a garage"',
  edit: 'e.g. "Move the sofa near the window" or "make the sofa bigger"',
  photo: 'Optional note about the photo, e.g. "match this living room"',
};

interface AiPanelProps {
  projectId: string;
  requestGenerate: (projectId: string, prompt: string) => Promise<AiRequest>;
  requestEdit: (projectId: string, prompt: string, document: DesignDocument) => Promise<AiRequest>;
  requestImage: (projectId: string, prompt: string, document: DesignDocument, file: File) => Promise<AiRequest>;
  applyRequest: (projectId: string, id: string) => Promise<AiRequest>;
  rejectRequest: (projectId: string, id: string) => Promise<AiRequest>;
}

export function AiPanel({ projectId, requestGenerate, requestEdit, requestImage, applyRequest, rejectRequest }: AiPanelProps) {
  const document = useEditorStore((s) => s.document);
  const loadDocument = useEditorStore((s) => s.loadDocument);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>('generate');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [request, setRequest] = useState<AiRequest | null>(null);
  const [beforeCounts, setBeforeCounts] = useState<ReturnType<typeof documentCounts> | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setPrompt('');
    setFile(null);
    setRequest(null);
    setError(null);
  }

  async function submit() {
    if (mode === 'photo' && !file) {
      setError('Choose a photo first.');
      return;
    }
    if (mode !== 'photo' && prompt.trim().length < 3) {
      setError('Describe what you want in a bit more detail.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setBeforeCounts(documentCounts(document));
    try {
      const result =
        mode === 'generate'
          ? await requestGenerate(projectId, prompt)
          : mode === 'edit'
            ? await requestEdit(projectId, prompt, document)
            : await requestImage(projectId, prompt, document, file!);
      setRequest(result);
      if (result.status === 'FAILED') {
        setError(result.errorMessage ?? 'The AI could not complete this request.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI request failed.');
    } finally {
      setSubmitting(false);
    }
  }

  async function apply() {
    if (!request?.proposedDocument) return;
    setApplying(true);
    setError(null);
    try {
      await applyRequest(projectId, request.id);
      loadDocument(request.proposedDocument);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not apply this proposal.');
    } finally {
      setApplying(false);
    }
  }

  async function discard() {
    if (!request) return;
    setApplying(true);
    setError(null);
    try {
      await rejectRequest(projectId, request.id);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not discard this proposal.');
    } finally {
      setApplying(false);
    }
  }

  const proposal = request?.status === 'PROPOSED' ? request : null;
  const afterCounts = proposal?.proposedDocument ? documentCounts(proposal.proposedDocument) : null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-purple-300 bg-purple-50 px-3 py-1.5 text-sm font-medium text-purple-700"
      >
        ✦ AI
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="mb-3 flex gap-1 rounded bg-neutral-100 p-0.5">
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  reset();
                }}
                className={`flex-1 rounded px-2 py-1 text-xs font-semibold ${
                  mode === m ? 'bg-neutral-900 text-white' : 'text-neutral-600'
                }`}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>

          {!proposal && (
            <div className="flex flex-col gap-2">
              {mode === 'photo' && (
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="text-xs text-neutral-600"
                />
              )}
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={MODE_PLACEHOLDERS[mode]}
                rows={3}
                className="w-full resize-none rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900"
              />
              {error && <p className="text-xs text-red-600">{error}</p>}
              <button
                onClick={submit}
                disabled={submitting}
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? 'Thinking…' : mode === 'generate' ? 'Generate design' : mode === 'edit' ? 'Propose edit' : 'Suggest from photo'}
              </button>
              <p className="text-[11px] text-neutral-400">
                The AI never edits your design directly — you&apos;ll review a proposal first.
              </p>
            </div>
          )}

          {proposal && afterCounts && beforeCounts && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-600">{proposal.summary}</p>
              <dl className="grid grid-cols-4 gap-1 rounded bg-neutral-50 p-2 text-center text-[11px] text-neutral-500">
                <div>
                  <dt>Rooms</dt>
                  <dd className="font-semibold text-neutral-900">
                    {beforeCounts.rooms} → {afterCounts.rooms}
                  </dd>
                </div>
                <div>
                  <dt>Walls</dt>
                  <dd className="font-semibold text-neutral-900">
                    {beforeCounts.walls} → {afterCounts.walls}
                  </dd>
                </div>
                <div>
                  <dt>Objects</dt>
                  <dd className="font-semibold text-neutral-900">
                    {beforeCounts.objects} → {afterCounts.objects}
                  </dd>
                </div>
                <div>
                  <dt>Openings</dt>
                  <dd className="font-semibold text-neutral-900">
                    {beforeCounts.openings} → {afterCounts.openings}
                  </dd>
                </div>
              </dl>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-2">
                <button
                  onClick={discard}
                  disabled={applying}
                  className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:opacity-50"
                >
                  Discard
                </button>
                <button
                  onClick={apply}
                  disabled={applying}
                  className="flex-1 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  {applying ? 'Applying…' : 'Apply'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
