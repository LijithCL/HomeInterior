'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { RefObject } from 'react';
import { useEditorStore, type GizmoMode, type Tool, type Unit, type ViewMode } from '@/lib/editor/editor-store';
import { RenderPanel } from './RenderPanel';
import { ExportPanel } from './ExportPanel';
import { AiPanel } from './AiPanel';
import { SharePanel } from './SharePanel';
import { VersionHistoryPanel } from './VersionHistoryPanel';
import { CostEstimatePanel } from './CostEstimatePanel';
import { CommentsPanel } from './CommentsPanel';
import { PrintPlanOverlay } from './PrintPlanOverlay';
import { UnderlayPanel } from './UnderlayPanel';
import { SaveAsTemplatePanel } from './SaveAsTemplatePanel';
import { PhotoPreviewPanel } from './PhotoPreviewPanel';
import { ProposalsPanel } from './ProposalsPanel';
import type { Scene3DHandle } from './Scene3D';
import type { Asset } from '@/lib/editor/asset-types';
import {
  requestRenderAction,
  getRenderJobAction,
  requestAiGenerateAction,
  requestAiEditAction,
  requestAiImageAction,
  applyAiRequestAction,
  rejectAiRequestAction,
  createShareLinkAction,
  listShareLinksAction,
  revokeShareLinkAction,
  listVersionsAction,
  restoreVersionAction,
  createCommentAction,
  resolveCommentAction,
  deleteCommentAction,
  uploadUnderlayImageAction,
  saveAsTemplateAction,
  createProposalAction,
  listProposalsAction,
  sendProposalAction,
  deleteProposalAction,
} from '@/app/editor/[projectId]/actions';
import type { CanvasStageRefs } from './Canvas';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'select', label: 'Select' },
  { id: 'wall', label: 'Wall' },
  { id: 'room', label: 'Room' },
  { id: 'door', label: 'Door' },
  { id: 'window', label: 'Window' },
  { id: 'measure', label: 'Measure' },
  { id: 'comment', label: 'Comment' },
];

const GIZMO_MODES: { id: GizmoMode; label: string }[] = [
  { id: 'move', label: 'Move' },
  { id: 'rotate', label: 'Rotate' },
  { id: 'scale', label: 'Scale' },
];

const VIEW_MODES: ViewMode[] = ['2D', '3D'];
const UNITS: Unit[] = ['mm', 'cm', 'm', 'ft'];

interface ToolbarProps {
  projectId: string;
  projectName: string;
  onSave: () => void;
  saving: boolean;
  lastSavedAt: Date | null;
  saveError: string | null;
  stageRefs: CanvasStageRefs | null;
  sceneRef: RefObject<Scene3DHandle | null>;
  assets: Asset[];
}

export function Toolbar({ projectId, projectName, onSave, saving, lastSavedAt, saveError, stageRefs, sceneRef, assets }: ToolbarProps) {
  const viewMode = useEditorStore((s) => s.viewMode);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const gizmoMode = useEditorStore((s) => s.gizmoMode);
  const setGizmoMode = useEditorStore((s) => s.setGizmoMode);
  const walkMode = useEditorStore((s) => s.walkMode);
  const toggleWalkMode = useEditorStore((s) => s.toggleWalkMode);
  const snapEnabled = useEditorStore((s) => s.snapEnabled);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const unit = useEditorStore((s) => s.unit);
  const setUnit = useEditorStore((s) => s.setUnit);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.past.length > 0);
  const canRedo = useEditorStore((s) => s.future.length > 0);
  const dirty = useEditorStore((s) => s.dirty);
  const [printOpen, setPrintOpen] = useState(false);

  const divider = <div className="h-6 w-px shrink-0 bg-neutral-200" aria-hidden />;

  return (
    <>
      {printOpen && <PrintPlanOverlay projectName={projectName} onClose={() => setPrintOpen(false)} />}
      <header className="flex flex-col border-b border-neutral-200 bg-white">
      <div className="flex items-center gap-3 px-4 py-2">
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
        ← Dashboard
      </Link>
      <span className="text-sm font-medium text-neutral-900">{projectName}</span>

      <div className="ml-2 flex gap-1 rounded bg-neutral-100 p-0.5">
        {VIEW_MODES.map((mode) => (
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

      {divider}

      <div className="flex gap-1">
        {viewMode === '2D'
          ? TOOLS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className={`rounded px-3 py-1.5 text-sm font-medium ${
                  tool === t.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {t.label}
              </button>
            ))
          : GIZMO_MODES.map((g) => (
              <button
                key={g.id}
                onClick={() => setGizmoMode(g.id)}
                disabled={walkMode}
                className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                  gizmoMode === g.id ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {g.label}
              </button>
            ))}
        {viewMode === '3D' && (
          <>
            <button
              onClick={() => setTool(tool === 'wall' ? 'select' : 'wall')}
              disabled={walkMode}
              title="Click points on the floor to draw wall segments; Escape ends the chain"
              className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                tool === 'wall' ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Wall
            </button>
            <button
              onClick={() => setTool(tool === 'measure' ? 'select' : 'measure')}
              disabled={walkMode}
              title="Click two points to measure the distance between them; Escape clears"
              className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                tool === 'measure' ? 'bg-amber-600 text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Measure
            </button>
            <button
              onClick={() => setTool(tool === 'comment' ? 'select' : 'comment')}
              disabled={walkMode}
              title="Click a spot on the design to drop a comment pin"
              className={`rounded px-3 py-1.5 text-sm font-medium disabled:opacity-40 ${
                tool === 'comment' ? 'bg-accent text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Comment
            </button>
            <button
              onClick={toggleWalkMode}
              title="Click the scene to look around; WASD/arrow keys to move; Escape to exit"
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                walkMode ? 'bg-sage text-white' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {walkMode ? 'Exit Walk' : 'Walk'}
            </button>
          </>
        )}
      </div>

      {divider}

      <div className="flex gap-1">
        <button
          onClick={undo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:opacity-40"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
          className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 disabled:opacity-40"
        >
          Redo
        </button>
      </div>

      {viewMode === '2D' && (
        <>
          {divider}
          <button
            onClick={toggleSnap}
            title="Snap new points to the grid and nearby walls"
            className={`rounded px-3 py-1.5 text-sm ${
              snapEnabled ? 'bg-blue-50 text-blue-700' : 'bg-neutral-100 text-neutral-500'
            }`}
          >
            Snap {snapEnabled ? 'On' : 'Off'}
          </button>
        </>
      )}

      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as Unit)}
        title="Display unit"
        className="rounded border border-neutral-300 px-2 py-1.5 text-sm text-neutral-700"
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>

      <div className="ml-auto flex items-center gap-3">
        <span className={`text-xs ${saveError ? 'text-red-600' : 'text-neutral-400'}`}>
          {saveError
            ? saveError
            : saving
              ? 'Saving…'
              : lastSavedAt
                ? `Saved ${lastSavedAt.toLocaleTimeString()}`
                : dirty
                  ? 'Unsaved changes'
                  : ''}
        </span>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
      </div>

      {/* Secondary tools, grouped by purpose — split into their own row
          (rather than crammed alongside the drawing tools above) so nothing
          gets clipped off the edge of the window, and related actions read
          as a group instead of a wall of identical-looking buttons. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-100 bg-neutral-50 px-4 py-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Export</span>
        {viewMode === '2D' && <ExportPanel stageRefs={stageRefs} projectName={projectName} />}
        {viewMode === '2D' && (
          <button onClick={() => setPrintOpen(true)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
            Print plan
          </button>
        )}
        {viewMode === '2D' && <UnderlayPanel projectId={projectId} uploadUnderlayImage={uploadUnderlayImageAction} />}
        {viewMode === '3D' && <PhotoPreviewPanel sceneRef={sceneRef} />}
        <RenderPanel projectId={projectId} requestRender={requestRenderAction} getRenderJob={getRenderJobAction} />
        <SaveAsTemplatePanel projectId={projectId} projectName={projectName} saveAsTemplate={saveAsTemplateAction} />

        {divider}

        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Collaborate</span>
        <SharePanel
          projectId={projectId}
          createShareLink={createShareLinkAction}
          listShareLinks={listShareLinksAction}
          revokeShareLink={revokeShareLinkAction}
        />
        <CommentsPanel
          projectId={projectId}
          createComment={createCommentAction}
          resolveComment={resolveCommentAction}
          deleteComment={deleteCommentAction}
        />
        <VersionHistoryPanel
          projectId={projectId}
          listVersions={listVersionsAction}
          restoreVersion={restoreVersionAction}
        />

        {divider}

        <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Business</span>
        <CostEstimatePanel assets={assets} />
        <ProposalsPanel
          projectId={projectId}
          assets={assets}
          createProposal={createProposalAction}
          listProposals={listProposalsAction}
          sendProposal={sendProposalAction}
          deleteProposal={deleteProposalAction}
        />

        {divider}

        <AiPanel
          projectId={projectId}
          requestGenerate={requestAiGenerateAction}
          requestEdit={requestAiEditAction}
          requestImage={requestAiImageAction}
          applyRequest={applyAiRequestAction}
          rejectRequest={rejectAiRequestAction}
        />
      </div>
      </header>
    </>
  );
}
