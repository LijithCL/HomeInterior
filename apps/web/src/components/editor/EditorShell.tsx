'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useEditorStore, type Unit } from '@/lib/editor/editor-store';
import type { DesignDocument } from '@/lib/editor/document';
import type { Asset } from '@/lib/editor/asset-types';
import { Toolbar } from './Toolbar';
import { FloorTabs } from './FloorTabs';
import { AssetSidebar } from './AssetSidebar';
import { PropertiesPanel } from './PropertiesPanel';
import { Timeline } from './Timeline';
import type { CanvasStageRefs } from './Canvas';
import type { Scene3DHandle } from './Scene3D';
import { listCommentsAction, getUnderlayImageUrlAction } from '@/app/editor/[projectId]/actions';

const Canvas = dynamic(() => import('./Canvas'), { ssr: false });
const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false });

const AUTOSAVE_DELAY_MS = 4000;

const VALID_UNITS: Unit[] = ['mm', 'cm', 'm', 'ft'];

interface EditorShellProps {
  projectId: string;
  projectName: string;
  initialDocument: DesignDocument;
  assets: Asset[];
  saveAction: (projectId: string, document: DesignDocument) => Promise<void>;
  initialUnit?: string | null;
}

export function EditorShell({
  projectId,
  projectName,
  initialDocument,
  assets,
  saveAction,
  initialUnit,
}: EditorShellProps) {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const setReadOnly = useEditorStore((s) => s.setReadOnly);
  const setUnit = useEditorStore((s) => s.setUnit);
  const markSaved = useEditorStore((s) => s.markSaved);
  const setComments = useEditorStore((s) => s.setComments);
  const document = useEditorStore((s) => s.document);
  const underlayUrls = useEditorStore((s) => s.underlayUrls);
  const setUnderlayUrl = useEditorStore((s) => s.setUnderlayUrl);
  const dirty = useEditorStore((s) => s.dirty);
  const viewMode = useEditorStore((s) => s.viewMode);

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [stageRefs, setStageRefs] = useState<CanvasStageRefs | null>(null);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedRef = useRef(false);
  const sceneRef = useRef<Scene3DHandle>(null);

  useEffect(() => {
    // The store is a module-level singleton — if a client-side navigation
    // ever lands here right after the read-only /share/[token] viewer (see
    // ShareViewer), readOnly would otherwise still be true and silently
    // disable every editing interaction.
    setReadOnly(false);
    loadDocument(initialDocument);
    if (initialUnit && VALID_UNITS.includes(initialUnit as Unit)) {
      setUnit(initialUnit as Unit);
    }
    loadedRef.current = true;
    listCommentsAction(projectId).then(setComments).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function save() {
    setSaving(true);
    try {
      await saveAction(projectId, document);
      markSaved();
      setLastSavedAt(new Date());
      setSaveError(null);
    } catch (err) {
      // Left dirty (markSaved is never called) so the next edit's debounce
      // will try again regardless — this timer is just so a failure isn't
      // silently stuck until the user happens to touch the design again.
      setSaveError(err instanceof Error ? err.message : 'Save failed — retrying…');
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
      autosaveTimer.current = setTimeout(save, 5000);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    // Signed URLs expire (see StorageService's 1hr default), so this
    // re-resolves anything missing every time the floor list changes —
    // cheap since it's a no-op once every referenced key already has one.
    const keys = document.floors.map((f) => f.underlayImageKey).filter((k): k is string => !!k);
    for (const key of keys) {
      if (underlayUrls[key]) continue;
      getUnderlayImageUrlAction(projectId, key)
        .then(({ url }) => setUnderlayUrl(key, url))
        .catch(() => {});
    }
  }, [document.floors, underlayUrls, projectId, setUnderlayUrl]);

  useEffect(() => {
    if (!loadedRef.current || !dirty) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      save();
    }, AUTOSAVE_DELAY_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, dirty]);

  useEffect(() => {
    // The debounced autosave above is destroyed with the page if the tab
    // closes/reloads before its 4s timer fires — any edit made just before
    // closing was otherwise silently lost. `fetch(..., { keepalive: true })`
    // is the one thing the browser guarantees still completes after the
    // page starts unloading, so this fires an immediate save through a
    // plain Route Handler (not the server action, which has no keepalive
    // equivalent) whenever the tab is hidden or about to go away.
    function flush() {
      if (!dirty) return;
      fetch('/api/autosave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, document }),
        keepalive: true,
      })
        .then((res) => {
          if (res.ok) markSaved();
        })
        .catch(() => {});
    }
    function onVisibilityChange() {
      if (window.document.visibilityState === 'hidden') flush();
    }
    window.document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      window.document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, [projectId, document, dirty, markSaved]);

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        projectId={projectId}
        projectName={projectName}
        onSave={save}
        saving={saving}
        lastSavedAt={lastSavedAt}
        saveError={saveError}
        stageRefs={stageRefs}
        sceneRef={sceneRef}
        assets={assets}
      />
      <FloorTabs />
      <div className="flex flex-1 overflow-hidden">
        <AssetSidebar assets={assets} />
        <div className="relative flex-1">
          {viewMode === '2D' ? (
            <>
              <Canvas assets={assets} onStageReady={setStageRefs} />
              <p className="pointer-events-none absolute bottom-2 left-2 text-xs text-neutral-400">
                Scroll to pan · Ctrl/⌘+Scroll to zoom · Hold Space to drag-pan
              </p>
            </>
          ) : (
            <>
              <Scene3D ref={sceneRef} assets={assets} />
              <p className="pointer-events-none absolute bottom-2 left-2 text-xs text-neutral-500">
                Drag to orbit · Scroll to zoom · Side-scroll or right-drag to pan
              </p>
            </>
          )}
        </div>
        <PropertiesPanel assets={assets} />
      </div>
      {viewMode === '3D' && <Timeline />}
    </div>
  );
}
