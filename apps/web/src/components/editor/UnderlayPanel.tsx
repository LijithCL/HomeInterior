'use client';

import { useRef, useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';

interface UnderlayPanelProps {
  projectId: string;
  uploadUnderlayImage: (projectId: string, file: File) => Promise<{ key: string; url: string }>;
}

// Lets a user trace over an uploaded blueprint/photo in the 2D editor —
// the realistic, achievable version of "import a CAD file" (a real DXF
// vector parser is a much bigger undertaking than this session scopes to).
export function UnderlayPanel({ projectId, uploadUnderlayImage }: UnderlayPanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeFloorId = useEditorStore((s) => s.activeFloorId);
  const floor = useEditorStore((s) => s.document.floors.find((f) => f.id === activeFloorId));
  const updateFloorUnderlay = useEditorStore((s) => s.updateFloorUnderlay);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const { key } = await uploadUnderlayImage(projectId, file);
      updateFloorUnderlay(activeFloorId, {
        underlayImageKey: key,
        underlayWidthMm: 5000,
        underlayX: 0,
        underlayY: 0,
        underlayOpacity: 0.5,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload the image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
        Underlay
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-72 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            Upload a blueprint or floor plan photo to trace over on this floor with the Wall tool.
          </p>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="mb-3 w-full rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {busy ? 'Uploading…' : floor?.underlayImageKey ? 'Replace image' : 'Upload image'}
          </button>

          {floor?.underlayImageKey && (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-xs text-neutral-500">
                Width (mm)
                <input
                  type="number"
                  value={floor.underlayWidthMm ?? 5000}
                  onChange={(e) => updateFloorUnderlay(activeFloorId, { underlayWidthMm: Number(e.target.value) })}
                  className="rounded border border-neutral-300 px-2 py-1 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-neutral-500">
                  X (mm)
                  <input
                    type="number"
                    value={floor.underlayX ?? 0}
                    onChange={(e) => updateFloorUnderlay(activeFloorId, { underlayX: Number(e.target.value) })}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-neutral-500">
                  Y (mm)
                  <input
                    type="number"
                    value={floor.underlayY ?? 0}
                    onChange={(e) => updateFloorUnderlay(activeFloorId, { underlayY: Number(e.target.value) })}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm"
                  />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-xs text-neutral-500">
                Opacity
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={floor.underlayOpacity ?? 0.5}
                  onChange={(e) => updateFloorUnderlay(activeFloorId, { underlayOpacity: Number(e.target.value) })}
                />
              </label>
              <button
                onClick={() => updateFloorUnderlay(activeFloorId, { underlayImageKey: undefined })}
                className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600"
              >
                Remove underlay
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
