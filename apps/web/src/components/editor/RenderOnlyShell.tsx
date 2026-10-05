'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { DesignDocument } from '@/lib/editor/document';
import type { Asset } from '@/lib/editor/asset-types';

const Scene3D = dynamic(() => import('./Scene3D'), { ssr: false });

interface RenderOnlyShellProps {
  document: DesignDocument;
  assets: Asset[];
}

// Mounted only by the headless render worker (apps/api RenderService) — no
// toolbar/sidebars/panels, just the 3D scene filling the viewport so a
// screenshot of the page is a clean render of the house.
export function RenderOnlyShell({ document, assets }: RenderOnlyShellProps) {
  const loadDocument = useEditorStore((s) => s.loadDocument);

  useEffect(() => {
    loadDocument(document);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="h-screen w-screen">
      <Scene3D assets={assets} />
    </div>
  );
}
