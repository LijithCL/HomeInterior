'use client';

import { useEffect, useRef, useState } from 'react';
import type { RenderJob, RenderTier } from '@/lib/editor/render-job';

interface RenderPanelProps {
  projectId: string;
  requestRender: (projectId: string, tier: RenderTier) => Promise<RenderJob>;
  getRenderJob: (projectId: string, jobId: string) => Promise<RenderJob>;
}

const POLL_INTERVAL_MS = 2000;

export function RenderPanel({ projectId, requestRender, getRenderJob }: RenderPanelProps) {
  const [open, setOpen] = useState(false);
  const [tier, setTier] = useState<RenderTier>('PREVIEW');
  const [job, setJob] = useState<RenderJob | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function clearPoll() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  useEffect(() => () => clearPoll(), []);

  async function startRender() {
    setRequesting(true);
    setError(null);
    try {
      const created = await requestRender(projectId, tier);
      setJob(created);
      clearPoll();
      pollRef.current = setInterval(async () => {
        try {
          const updated = await getRenderJob(projectId, created.id);
          setJob(updated);
          if (updated.status === 'DONE' || updated.status === 'FAILED') {
            clearPoll();
          }
        } catch (err) {
          clearPoll();
          setError(err instanceof Error ? err.message : 'Could not check the render status.');
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the render.');
    } finally {
      setRequesting(false);
    }
  }

  const isBusy = job?.status === 'QUEUED' || job?.status === 'PROCESSING';

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
      >
        Render
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="mb-3 flex gap-2">
            <select
              value={tier}
              onChange={(e) => setTier(e.target.value as RenderTier)}
              disabled={isBusy || requesting}
              className="flex-1 rounded border border-neutral-300 px-2 py-1.5 text-sm"
            >
              <option value="PREVIEW">Preview (fast)</option>
              <option value="HQ">High quality</option>
            </select>
            <button
              onClick={startRender}
              disabled={isBusy || requesting}
              className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {requesting ? 'Starting…' : 'Request'}
            </button>
          </div>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          {job && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-neutral-500">
                Status: <span className="font-medium text-neutral-800">{job.status}</span>
              </p>
              {isBusy && (
                <p className="text-xs text-neutral-400">Rendering the whole house — this usually takes a few seconds…</p>
              )}
              {job.status === 'FAILED' && <p className="text-xs text-red-600">{job.errorMessage}</p>}
              {job.status === 'DONE' && job.outputUrl && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL */}
                  <img src={job.outputUrl} alt="Rendered house" className="w-full rounded border border-neutral-200" />
                  <a
                    href={job.outputUrl}
                    download={`render-${job.id}.png`}
                    className="text-center text-xs font-medium text-blue-600 hover:underline"
                  >
                    Download image
                  </a>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
