'use client';

import { useState } from 'react';
import type Konva from 'konva';
import { jsPDF } from 'jspdf';
import {
  downloadDataUrl,
  exportFloorPlanPng,
  EXPORT_TARGET_HEIGHT_PX,
  EXPORT_TARGET_WIDTH_PX,
} from '@/lib/editor/export';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { CanvasStageRefs } from './Canvas';

interface ExportPanelProps {
  stageRefs: CanvasStageRefs | null;
  projectName: string;
}

export function ExportPanel({ stageRefs, projectName }: ExportPanelProps) {
  const document = useEditorStore((s) => s.document);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function withPng(stage: Konva.Stage, contentLayer: Konva.Layer): string | null {
    const dataUrl = exportFloorPlanPng(stage, contentLayer);
    if (!dataUrl) setError('Nothing to export yet — draw a room or wall first.');
    return dataUrl;
  }

  function exportPng() {
    if (!stageRefs) return;
    setError(null);
    const dataUrl = withPng(stageRefs.stage, stageRefs.contentLayer);
    if (dataUrl) downloadDataUrl(dataUrl, `${projectName}-floor-plan.png`);
    setOpen(false);
  }

  function exportPdf() {
    if (!stageRefs) return;
    setError(null);
    const dataUrl = withPng(stageRefs.stage, stageRefs.contentLayer);
    if (!dataUrl) return;
    const pdf = new jsPDF({
      orientation: EXPORT_TARGET_WIDTH_PX >= EXPORT_TARGET_HEIGHT_PX ? 'landscape' : 'portrait',
      unit: 'px',
      format: [EXPORT_TARGET_WIDTH_PX, EXPORT_TARGET_HEIGHT_PX],
    });
    pdf.addImage(dataUrl, 'PNG', 0, 0, EXPORT_TARGET_WIDTH_PX, EXPORT_TARGET_HEIGHT_PX);
    pdf.save(`${projectName}-floor-plan.pdf`);
    setOpen(false);
  }

  // The full design as data, not a picture of it — every wall/room/object
  // in mm, re-importable in principle, unlike the PNG/PDF snapshots above.
  function exportJson() {
    setError(null);
    const dataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(document, null, 2))}`;
    downloadDataUrl(dataUrl, `${projectName}-design.json`);
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
      >
        Export
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-neutral-200 bg-white p-2 shadow-lg">
          <button
            onClick={exportPng}
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Download PNG
          </button>
          <button
            onClick={exportPdf}
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Download PDF
          </button>
          <button
            onClick={exportJson}
            className="block w-full rounded px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100"
          >
            Download design (.json)
          </button>
          {error && <p className="mt-1 px-2 text-xs text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
