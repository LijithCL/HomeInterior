'use client';

import { useState, type RefObject } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { Scene3DHandle } from './Scene3D';

interface PhotoPreviewPanelProps {
  sceneRef: RefObject<Scene3DHandle | null>;
}

interface CapturedPhoto {
  label: string;
  dataUrl: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function PhotoPreviewPanel({ sceneRef }: PhotoPreviewPanelProps) {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [busy, setBusy] = useState(false);
  const rooms = useEditorStore((s) => s.document.rooms);
  const activeFloorId = useEditorStore((s) => s.activeFloorId);
  const floorViewMode = useEditorStore((s) => s.floorViewMode);
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);
  const setFloorViewMode = useEditorStore((s) => s.setFloorViewMode);

  function captureCurrentView() {
    const dataUrl = sceneRef.current?.capture();
    if (!dataUrl) return;
    setPhotos((prev) => [...prev, { label: `Current view ${prev.length + 1}`, dataUrl }]);
  }

  async function captureAllRooms() {
    const scene = sceneRef.current;
    if (!scene || rooms.length === 0) return;
    setBusy(true);
    const previousFloorId = activeFloorId;
    const previousViewMode = floorViewMode;
    setFloorViewMode('current');
    const results: CapturedPhoto[] = [];
    try {
      for (const room of rooms) {
        setActiveFloor(room.floorId);
        const framed = scene.frameRoom(room.id);
        if (!framed) continue;
        // Give the store update (floor visibility) and the camera move a
        // couple of paints to actually land before reading the canvas back.
        await wait(300);
        const dataUrl = scene.capture();
        if (dataUrl) results.push({ label: room.name, dataUrl });
      }
    } finally {
      setActiveFloor(previousFloorId);
      setFloorViewMode(previousViewMode);
      scene.resetView();
      setBusy(false);
    }
    setPhotos((prev) => [...prev, ...results]);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
      >
        Photo Preview
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <div className="mb-3 flex gap-2">
            <button
              onClick={captureCurrentView}
              disabled={busy}
              className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:opacity-50"
            >
              Capture current view
            </button>
            <button
              onClick={captureAllRooms}
              disabled={busy || rooms.length === 0}
              className="flex-1 rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Capturing…' : 'Capture all rooms'}
            </button>
          </div>

          {photos.length === 0 && !busy && (
            <p className="text-xs text-neutral-400">
              Instant snapshots of the live 3D view — no waiting for a render job. Use this for quick design
              previews; use Render for a higher-quality export.
            </p>
          )}

          {photos.length > 0 && (
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
              {photos.map((photo, i) => (
                <a key={i} href={photo.dataUrl} download={`${photo.label.replace(/\s+/g, '-').toLowerCase()}.png`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- client-generated data URL, not a static asset */}
                  <img src={photo.dataUrl} alt={photo.label} className="w-full rounded border border-neutral-200" />
                  <p className="mt-1 truncate text-center text-xs text-neutral-600">{photo.label}</p>
                </a>
              ))}
            </div>
          )}

          {photos.length > 0 && (
            <button
              onClick={() => setPhotos([])}
              className="mt-2 w-full text-center text-xs text-neutral-400 hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
