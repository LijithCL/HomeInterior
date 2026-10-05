'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import { mmToDisplay, displayToMm } from '@/lib/editor/units';

export function FloorTabs() {
  const document = useEditorStore((s) => s.document);
  const activeFloorId = useEditorStore((s) => s.activeFloorId);
  const unit = useEditorStore((s) => s.unit);
  const viewMode = useEditorStore((s) => s.viewMode);
  const floorViewMode = useEditorStore((s) => s.floorViewMode);
  const setActiveFloor = useEditorStore((s) => s.setActiveFloor);
  const setFloorViewMode = useEditorStore((s) => s.setFloorViewMode);
  const addFloor = useEditorStore((s) => s.addFloor);
  const removeFloor = useEditorStore((s) => s.removeFloor);
  const renameFloor = useEditorStore((s) => s.renameFloor);
  const setFloorHeight = useEditorStore((s) => s.setFloorHeight);
  const duplicateFloor = useEditorStore((s) => s.duplicateFloor);
  const toggleFloorHidden = useEditorStore((s) => s.toggleFloorHidden);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameText, setRenameText] = useState('');

  const floors = [...document.floors].sort((a, b) => a.levelIndex - b.levelIndex);
  const activeFloor = floors.find((f) => f.id === activeFloorId);

  function commitRename() {
    if (renamingId && renameText.trim()) {
      renameFloor(renamingId, renameText.trim());
    }
    setRenamingId(null);
  }

  return (
    <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4 py-1.5">
      <div className="flex gap-1">
        {floors.map((floor) => (
          <div key={floor.id} className="flex items-center">
            {renamingId === floor.id ? (
              <input
                autoFocus
                value={renameText}
                onChange={(e) => setRenameText(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => e.key === 'Enter' && commitRename()}
                className="w-28 rounded border border-neutral-400 px-2 py-1 text-xs"
              />
            ) : (
              <button
                onClick={() => setActiveFloor(floor.id)}
                onDoubleClick={() => {
                  setRenamingId(floor.id);
                  setRenameText(floor.name);
                }}
                className={`rounded px-3 py-1 text-xs font-medium ${
                  activeFloorId === floor.id
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600 hover:bg-neutral-100'
                } ${floor.hidden ? 'opacity-40' : ''}`}
                title="Double-click to rename"
              >
                {floor.name}
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => addFloor()}
          className="rounded px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100"
          title="Add floor"
        >
          + Floor
        </button>
      </div>

      {activeFloor && (
        <div className="flex items-center gap-2 border-l border-neutral-300 pl-3">
          <label className="flex items-center gap-1 text-xs text-neutral-500">
            Height
            <input
              type="number"
              value={mmToDisplay(activeFloor.heightMm, unit)}
              onChange={(e) => setFloorHeight(activeFloor.id, displayToMm(Number(e.target.value), unit))}
              className="w-16 rounded border border-neutral-300 px-1 py-0.5"
            />
            {unit}
          </label>
          <button onClick={() => duplicateFloor(activeFloor.id)} className="text-xs text-neutral-500 hover:underline">
            Duplicate
          </button>
          <button onClick={() => toggleFloorHidden(activeFloor.id)} className="text-xs text-neutral-500 hover:underline">
            {activeFloor.hidden ? 'Show' : 'Hide'} in 3D
          </button>
          {floors.length > 1 && (
            <button
              onClick={() => removeFloor(activeFloor.id)}
              className="text-xs text-red-600 hover:underline"
            >
              Delete floor
            </button>
          )}
        </div>
      )}

      {viewMode === '3D' && (
        <div className="ml-auto flex gap-1 rounded bg-white p-0.5">
          {(['current', 'all'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFloorViewMode(mode)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                floorViewMode === mode ? 'bg-neutral-900 text-white' : 'text-neutral-500'
              }`}
            >
              {mode === 'current' ? 'This floor' : 'All floors'}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
