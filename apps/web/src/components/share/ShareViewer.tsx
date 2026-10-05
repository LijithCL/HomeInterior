'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { DesignDocument } from '@/lib/editor/document';
import type { Asset } from '@/lib/editor/asset-types';
import { Timeline } from '@/components/editor/Timeline';
import { PublicCommentsPanel } from './PublicCommentsPanel';
import { listPublicCommentsAction, createPublicCommentAction } from '@/app/share/[token]/actions';

const Canvas = dynamic(() => import('@/components/editor/Canvas'), { ssr: false });
const Scene3D = dynamic(() => import('@/components/editor/Scene3D'), { ssr: false });

interface ShareViewerProps {
  token: string;
  projectName: string;
  document: DesignDocument;
  assets: Asset[];
}

// The whole public /share/[token] page, deliberately independent of
// EditorShell — no Toolbar, AssetSidebar, or PropertiesPanel are mounted,
// so there is no UI path to a mutation even before readOnly is checked
// inside Canvas/Scene3D. 2D/3D toggle, the construction timeline, and the
// Comment tool are kept since none of them edit the design document itself
// — comments are a separate, anonymous-writable resource (see
// ShareViewController), gated by the share token rather than readOnly.
export function ShareViewer({ token, projectName, document, assets }: ShareViewerProps) {
  const loadDocument = useEditorStore((s) => s.loadDocument);
  const setReadOnly = useEditorStore((s) => s.setReadOnly);
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);

  useEffect(() => {
    setReadOnly(true);
    loadDocument(document);
  }, [document, loadDocument, setReadOnly]);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2">
        <span className="text-sm font-medium text-neutral-900">{projectName}</span>
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-500">View only</span>
        <div className="flex gap-1 rounded bg-neutral-100 p-0.5">
          {(['2D', '3D'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded px-3 py-1 text-sm font-semibold ${
                viewMode === mode ? 'bg-neutral-900 text-white' : 'text-neutral-600'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <button
          onClick={() => setTool(tool === 'comment' ? 'select' : 'comment')}
          title="Click a spot on the design to drop a comment pin"
          className={`rounded px-3 py-1.5 text-sm font-medium ${
            tool === 'comment' ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
          }`}
        >
          Comment
        </button>
        <div className="ml-auto">
          <PublicCommentsPanel token={token} listComments={listPublicCommentsAction} createComment={createPublicCommentAction} />
        </div>
      </header>
      <div className="relative flex-1">
        {viewMode === '2D' ? <Canvas assets={assets} /> : <Scene3D assets={assets} />}
      </div>
      {viewMode === '3D' && <Timeline />}
    </div>
  );
}
