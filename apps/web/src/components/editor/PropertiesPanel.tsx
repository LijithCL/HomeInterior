'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import {
  CONSTRUCTION_DAY_MAX,
  CONSTRUCTION_DAY_MIN,
  polygonBounds,
  polygonAreaM2,
  wallLengthMm,
} from '@/lib/editor/document';
import { displayToMm, formatArea, mmToDisplay } from '@/lib/editor/units';
import { MATERIALS, getMaterialThumbnailUrl } from '@/lib/editor/materials';
import { autoArrangeRoom, objectsInRoom } from '@/lib/editor/auto-arrange';
import { findVariantsForAsset } from '@/lib/editor/object-variants';
import { isWallLikeAssetName, type Asset } from '@/lib/editor/asset-types';

function clampConstructionDay(day: number): number {
  return Math.min(CONSTRUCTION_DAY_MAX, Math.max(CONSTRUCTION_DAY_MIN, Math.round(day)));
}

// A wall-like object has no start/end points of its own — it's stored as a
// center (x, y), a length (widthMm) along its own rotated local X axis, and
// a rotationDeg — so its endpoints are derived the same way the renderer
// (Canvas.tsx's Rect, Scene3D's ObjectMesh) place the object, not stored
// separately. Editing an endpoint here works backwards: recompute the
// center/length/rotation that produce the requested pair of points.
function objectEndpoints(x: number, y: number, widthMm: number, rotationDeg: number) {
  const rad = (rotationDeg * Math.PI) / 180;
  const halfDx = (Math.cos(rad) * widthMm) / 2;
  const halfDy = (Math.sin(rad) * widthMm) / 2;
  return {
    startX: x - halfDx,
    startY: y - halfDy,
    endX: x + halfDx,
    endY: y + halfDy,
  };
}

function objectFromEndpoints(startX: number, startY: number, endX: number, endY: number) {
  return {
    x: (startX + endX) / 2,
    y: (startY + endY) / 2,
    widthMm: Math.max(50, Math.hypot(endX - startX, endY - startY)),
    rotationDeg: (Math.atan2(endY - startY, endX - startX) * 180) / Math.PI,
  };
}

function MaterialPicker({ label, value, onChange }: { label: string; value?: string; onChange: (id?: string) => void }) {
  return (
    <div className="flex flex-col gap-1 text-xs text-neutral-500">
      <span>{label}</span>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          title="None (flat color)"
          onClick={() => onChange(undefined)}
          className={`flex h-8 w-8 items-center justify-center rounded border text-[10px] text-neutral-400 ${
            !value ? 'border-accent ring-2 ring-accent-light' : 'border-neutral-300'
          }`}
        >
          None
        </button>
        {MATERIALS.map((m) => {
          const url = getMaterialThumbnailUrl(m.id);
          return (
            <button
              key={m.id}
              type="button"
              title={m.label}
              onClick={() => onChange(m.id)}
              style={url ? { backgroundImage: `url(${url})`, backgroundSize: '16px 16px' } : { backgroundColor: m.baseColor }}
              className={`h-8 w-8 rounded border ${value === m.id ? 'border-accent ring-2 ring-accent-light' : 'border-neutral-300'}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
}) {
  // Local text state lets the user type transient, not-yet-valid input (an
  // empty field, a lone "-" while entering a negative number) without ever
  // sending NaN into the document — Three.js geometry built from a NaN
  // position/size throws at the WebGL layer, not just misrenders. `value` is
  // tracked alongside so an external change (dragging the object, undo/redo,
  // switching selection) resyncs the text; adjusting state during render
  // like this — rather than in an effect — avoids an extra render pass. See
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [state, setState] = useState({ value, text: String(value) });
  if (state.value !== value) {
    setState({ value, text: String(value) });
  }
  const text = state.text;
  const setText = (next: string) => setState({ value, text: next });

  return (
    <label className="flex flex-col gap-1 text-xs text-neutral-500">
      {label}
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const parsed = Number(e.target.value);
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          onBlur={() => setText(String(value))}
          className="w-full rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
        />
        {suffix && <span className="text-xs text-neutral-400">{suffix}</span>}
      </div>
    </label>
  );
}

export function PropertiesPanel({ assets }: { assets: Asset[] }) {
  const document = useEditorStore((s) => s.document);
  const selection = useEditorStore((s) => s.selection);
  const unit = useEditorStore((s) => s.unit);
  const updateWall = useEditorStore((s) => s.updateWall);
  const updateRoom = useEditorStore((s) => s.updateRoom);
  const resizeRoom = useEditorStore((s) => s.resizeRoom);
  const updateOpening = useEditorStore((s) => s.updateOpening);
  const updateObject = useEditorStore((s) => s.updateObject);
  const removeSelected = useEditorStore((s) => s.removeSelected);
  const duplicateObject = useEditorStore((s) => s.duplicateObject);
  const duplicateWall = useEditorStore((s) => s.duplicateWall);
  const setSelection = useEditorStore((s) => s.setSelection);
  const activeFloorId = useEditorStore((s) => s.activeFloorId);
  const setViewMode = useEditorStore((s) => s.setViewMode);
  const setPendingRoomFocus = useEditorStore((s) => s.setPendingRoomFocus);

  const wall = selection?.type === 'wall' ? document.walls.find((w) => w.id === selection.id) : undefined;
  const room = selection?.type === 'room' ? document.rooms.find((r) => r.id === selection.id) : undefined;
  const opening = selection?.type === 'opening' ? document.openings.find((o) => o.id === selection.id) : undefined;
  const object = selection?.type === 'object' ? document.objects.find((o) => o.id === selection.id) : undefined;
  const objectAsset = object ? assets.find((a) => a.id === object.assetId) : undefined;
  const objectVariants = objectAsset ? findVariantsForAsset(objectAsset.name) : null;
  const objectAssetNameLower = objectAsset?.name.toLowerCase() ?? '';
  const isStaircaseObject = objectAssetNameLower.includes('staircase') || objectAssetNameLower.includes('stairs');
  // The interior (switchback) staircase's handrail runs down the shared
  // spine between its two flights, not along one outer edge, so side/offset
  // don't apply to it the way they do to the single-flight variants.
  const supportsRailSide = isStaircaseObject && !objectAssetNameLower.includes('interior staircase');
  // A wall-like exterior object (a straight run with a length and thickness)
  // is more naturally edited by its two endpoints than by center/width/
  // rotation — same reasoning as real Wall entities' Start/End fields.
  const isWallLikeObject = isWallLikeAssetName(objectAsset?.name ?? '', objectAsset?.category);

  // Switches to 3D (if not already there) and moves the camera inside the
  // room at eye height, looking across it — queued via the store rather
  // than called directly, since the 3D view may not be mounted yet at the
  // moment of this click (see pendingRoomFocusId).
  function enterRoomIn3D(roomId: string) {
    setViewMode('3D');
    setPendingRoomFocus(roomId);
  }

  return (
    <aside className="flex h-full w-72 flex-col gap-4 overflow-y-auto border-l border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Properties</h2>

      {!selection && (
        <div className="text-xs text-neutral-400">
          <p>Select a wall, room, opening, or object to edit its properties.</p>
          {/* Counts for the active floor only — not the whole project — since
              showing project-wide totals here reads as "this floor has N
              walls" and is actively misleading on a floor that's genuinely
              empty (e.g. a newly added floor) while other floors hold all
              the content. */}
          <p className="mt-4 font-medium text-neutral-500">
            On {document.floors.find((f) => f.id === activeFloorId)?.name ?? 'this floor'}
          </p>
          <dl className="mt-1 grid grid-cols-2 gap-y-1">
            <dt>Walls</dt>
            <dd>{document.walls.filter((w) => w.floorId === activeFloorId).length}</dd>
            <dt>Rooms</dt>
            <dd>{document.rooms.filter((r) => r.floorId === activeFloorId).length}</dd>
            <dt>Openings</dt>
            <dd>
              {
                document.openings.filter((o) =>
                  document.walls.some((w) => w.id === o.wallId && w.floorId === activeFloorId),
                ).length
              }
            </dd>
            <dt>Objects</dt>
            <dd>{document.objects.filter((o) => o.floorId === activeFloorId).length}</dd>
          </dl>
          {document.rooms.filter((r) => r.floorId === activeFloorId).length > 0 && (
            <div className="mt-4 flex flex-col gap-1">
              <p className="text-xs font-medium text-neutral-500">Room lengths</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-neutral-400">
                    <th className="pb-1 font-normal">Room</th>
                    <th className="pb-1 font-normal">Length</th>
                    <th className="pb-1 font-normal">Width</th>
                    <th className="pb-1 font-normal"></th>
                  </tr>
                </thead>
                <tbody>
                  {document.rooms
                    .filter((r) => r.floorId === activeFloorId)
                    .map((r) => {
                      const b = polygonBounds(r.polygon);
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setSelection({ type: 'room', id: r.id })}
                          className="cursor-pointer text-neutral-600 hover:bg-neutral-50"
                        >
                          <td className="py-0.5 pr-2">{r.name}</td>
                          <td className="py-0.5 pr-2">{mmToDisplay(b.heightMm, unit).toFixed(2)} {unit}</td>
                          <td className="py-0.5">{mmToDisplay(b.widthMm, unit).toFixed(2)} {unit}</td>
                          <td className="py-0.5 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                enterRoomIn3D(r.id);
                              }}
                              className="rounded border border-accent px-1.5 py-0.5 text-[10px] font-medium text-accent hover:bg-accent-light"
                              title="Step inside this room in 3D"
                            >
                              Enter
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {wall && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500">Wall</p>
          <Field
            label="Length"
            value={mmToDisplay(wallLengthMm(wall), unit)}
            suffix={unit}
            onChange={(v) => {
              const newLengthMm = Math.max(50, displayToMm(v, unit));
              const currentLengthMm = wallLengthMm(wall) || 1;
              const dirX = (wall.end.x - wall.start.x) / currentLengthMm;
              const dirY = (wall.end.y - wall.start.y) / currentLengthMm;
              updateWall(wall.id, {
                end: { x: wall.start.x + dirX * newLengthMm, y: wall.start.y + dirY * newLengthMm },
              });
            }}
          />
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Start X"
              value={mmToDisplay(wall.start.x, unit)}
              suffix={unit}
              onChange={(v) => updateWall(wall.id, { start: { ...wall.start, x: displayToMm(v, unit) } })}
            />
            <Field
              label="Start Y"
              value={mmToDisplay(wall.start.y, unit)}
              suffix={unit}
              onChange={(v) => updateWall(wall.id, { start: { ...wall.start, y: displayToMm(v, unit) } })}
            />
            <Field
              label="End X"
              value={mmToDisplay(wall.end.x, unit)}
              suffix={unit}
              onChange={(v) => updateWall(wall.id, { end: { ...wall.end, x: displayToMm(v, unit) } })}
            />
            <Field
              label="End Y"
              value={mmToDisplay(wall.end.y, unit)}
              suffix={unit}
              onChange={(v) => updateWall(wall.id, { end: { ...wall.end, y: displayToMm(v, unit) } })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field
              label="Thickness"
              value={mmToDisplay(wall.thicknessMm, 'mm')}
              suffix="mm"
              onChange={(v) => updateWall(wall.id, { thicknessMm: Math.max(50, v) })}
            />
            <Field
              label="Elevation (start)"
              value={mmToDisplay(wall.elevationMm ?? 0, 'mm')}
              suffix="mm"
              onChange={(v) => updateWall(wall.id, { elevationMm: Math.max(0, v) })}
            />
            <Field
              label="Elevation (end)"
              value={mmToDisplay(wall.endElevationMm ?? wall.elevationMm ?? 0, 'mm')}
              suffix="mm"
              onChange={(v) => updateWall(wall.id, { endElevationMm: Math.max(0, v) })}
            />
            <Field
              label="Height (start)"
              value={mmToDisplay(wall.heightMm, 'mm')}
              suffix="mm"
              onChange={(v) => updateWall(wall.id, { heightMm: Math.max(300, v) })}
            />
            <Field
              label="Height (end)"
              value={mmToDisplay(wall.endHeightMm ?? wall.heightMm, 'mm')}
              suffix="mm"
              onChange={(v) => updateWall(wall.id, { endHeightMm: Math.max(300, v) })}
            />
          </div>
          <p className="text-xs text-neutral-400">
            Different start/end heights slope the top edge (e.g. a gable end); different start/end
            elevations slope the base (e.g. to follow sloped terrain).
          </p>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Color
            <input
              type="color"
              value={wall.color ?? '#8a8f94'}
              onChange={(e) => updateWall(wall.id, { color: e.target.value })}
              className="h-8 w-full rounded border border-neutral-300"
            />
          </label>
          <MaterialPicker
            label="Material (3D)"
            value={wall.materialId}
            onChange={(materialId) => updateWall(wall.id, { materialId })}
          />
          <Field
            label="Construction day"
            value={wall.constructionDay}
            onChange={(v) => updateWall(wall.id, { constructionDay: clampConstructionDay(v) })}
          />
          <div className="flex gap-2">
            <button
              onClick={() => duplicateWall(wall.id)}
              className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700"
            >
              Duplicate
            </button>
            <button onClick={removeSelected} className="flex-1 rounded border border-red-200 px-3 py-1.5 text-xs text-red-600">
              Delete wall
            </button>
          </div>
        </div>
      )}

      {room && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Name
            <input
              type="text"
              value={room.name}
              onChange={(e) => updateRoom(room.id, { name: e.target.value })}
              className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
            />
          </label>
          {(() => {
            const bounds = polygonBounds(room.polygon);
            return (
              <>
                <Field
                  label="Width"
                  value={mmToDisplay(bounds.widthMm, unit)}
                  suffix={unit}
                  onChange={(v) => resizeRoom(room.id, displayToMm(v, unit), bounds.heightMm)}
                />
                <Field
                  label="Length"
                  value={mmToDisplay(bounds.heightMm, unit)}
                  suffix={unit}
                  onChange={(v) => resizeRoom(room.id, bounds.widthMm, displayToMm(v, unit))}
                />
              </>
            );
          })()}
          <p className="text-xs text-neutral-500">Area: {formatArea(polygonAreaM2(room.polygon), unit)}</p>
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Ceiling color
            <input
              type="color"
              value={room.ceilingColor ?? '#f7f4ec'}
              onChange={(e) => updateRoom(room.id, { ceilingColor: e.target.value })}
              className="h-8 w-full rounded border border-neutral-300"
            />
          </label>
          <MaterialPicker
            label="Floor material"
            value={room.floorMaterialId}
            onChange={(floorMaterialId) => updateRoom(room.id, { floorMaterialId })}
          />
          <Field
            label="Construction day"
            value={room.constructionDay}
            onChange={(v) => updateRoom(room.id, { constructionDay: clampConstructionDay(v) })}
          />
          <button
            onClick={() => enterRoomIn3D(room.id)}
            className="rounded border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-light"
          >
            Step inside (3D)
          </button>
          <button
            onClick={() => {
              const objects = objectsInRoom(room, document.objects);
              for (const arranged of autoArrangeRoom(room, objects)) {
                updateObject(arranged.id, { x: arranged.x, y: arranged.y, rotationDeg: arranged.rotationDeg });
              }
            }}
            className="rounded border border-accent px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-light"
          >
            Auto-arrange furniture
          </button>
          <button onClick={removeSelected} className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600">
            Delete room
          </button>
        </div>
      )}

      {opening && (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-neutral-500">{opening.type === 'DOOR' ? 'Door' : 'Window'}</p>
          <Field
            label="Width"
            value={mmToDisplay(opening.widthMm, 'mm')}
            suffix="mm"
            onChange={(v) => updateOpening(opening.id, { widthMm: Math.max(200, v) })}
          />
          <Field
            label="Position along wall"
            value={mmToDisplay(opening.offsetMm, 'mm')}
            suffix="mm"
            onChange={(v) => updateOpening(opening.id, { offsetMm: Math.max(0, v) })}
          />
          <Field
            label="Height"
            value={mmToDisplay(opening.heightMm, 'mm')}
            suffix="mm"
            onChange={(v) => updateOpening(opening.id, { heightMm: Math.max(200, v) })}
          />
          {opening.type === 'WINDOW' && (
            <Field
              label="Sill height"
              value={mmToDisplay(opening.sillHeightMm, 'mm')}
              suffix="mm"
              onChange={(v) => updateOpening(opening.id, { sillHeightMm: Math.max(0, v) })}
            />
          )}
          <Field
            label="Construction day"
            value={opening.constructionDay}
            onChange={(v) => updateOpening(opening.id, { constructionDay: clampConstructionDay(v) })}
          />
          <button onClick={removeSelected} className="rounded border border-red-200 px-3 py-1.5 text-xs text-red-600">
            Delete
          </button>
        </div>
      )}

      {object && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Name
            <input
              type="text"
              value={object.name}
              onChange={(e) => updateObject(object.id, { name: e.target.value })}
              className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <Field label="X" value={mmToDisplay(object.x, unit)} suffix={unit} onChange={(v) => updateObject(object.id, { x: displayToMm(v, unit) })} />
            <Field label="Y" value={mmToDisplay(object.y, unit)} suffix={unit} onChange={(v) => updateObject(object.id, { y: displayToMm(v, unit) })} />
            <Field
              label={isWallLikeObject ? 'Length' : 'Width'}
              value={mmToDisplay(object.widthMm, 'mm')}
              suffix="mm"
              onChange={(v) => {
                const newWidthMm = Math.max(50, v);
                if (!isWallLikeObject) {
                  updateObject(object.id, { widthMm: newWidthMm });
                  return;
                }
                // A wall-like object's Width doubles as its Length — resize
                // from the Start point (like a real Wall's Length field),
                // not symmetrically about the center, so editing it doesn't
                // also drag the Start point along with it.
                const { startX, startY } = objectEndpoints(object.x, object.y, object.widthMm, object.rotationDeg);
                const rad = (object.rotationDeg * Math.PI) / 180;
                updateObject(object.id, {
                  x: startX + (Math.cos(rad) * newWidthMm) / 2,
                  y: startY + (Math.sin(rad) * newWidthMm) / 2,
                  widthMm: newWidthMm,
                });
              }}
            />
            <Field label="Depth" value={mmToDisplay(object.depthMm, 'mm')} suffix="mm" onChange={(v) => updateObject(object.id, { depthMm: Math.max(50, v) })} />
            <Field
              label={isWallLikeObject ? 'Height (start)' : 'Height'}
              value={mmToDisplay(object.heightMm ?? objectAsset?.defaultHeightMm ?? 800, 'mm')}
              suffix="mm"
              onChange={(v) => updateObject(object.id, { heightMm: Math.max(50, v) })}
            />
            <Field label="Rotation" value={object.rotationDeg} suffix="°" onChange={(v) => updateObject(object.id, { rotationDeg: v % 360 })} />
            <Field
              label={isWallLikeObject ? 'Elevation (start)' : 'Elevation'}
              value={mmToDisplay(object.elevationMm ?? 0, 'mm')}
              suffix="mm"
              onChange={(v) => updateObject(object.id, { elevationMm: Math.max(0, v) })}
            />
            {isWallLikeObject && (
              <>
                <Field
                  label="Height (end)"
                  value={mmToDisplay(
                    object.endHeightMm ?? object.heightMm ?? objectAsset?.defaultHeightMm ?? 800,
                    'mm',
                  )}
                  suffix="mm"
                  onChange={(v) => updateObject(object.id, { endHeightMm: Math.max(50, v) })}
                />
                <Field
                  label="Elevation (end)"
                  value={mmToDisplay(object.endElevationMm ?? object.elevationMm ?? 0, 'mm')}
                  suffix="mm"
                  onChange={(v) => updateObject(object.id, { endElevationMm: Math.max(0, v) })}
                />
              </>
            )}
          </div>
          {isWallLikeObject &&
            (() => {
              const { startX, startY, endX, endY } = objectEndpoints(
                object.x,
                object.y,
                object.widthMm,
                object.rotationDeg,
              );
              const applyEndpoints = (next: { startX: number; startY: number; endX: number; endY: number }) =>
                updateObject(
                  object.id,
                  objectFromEndpoints(next.startX, next.startY, next.endX, next.endY),
                );
              return (
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    label="Start X"
                    value={mmToDisplay(startX, unit)}
                    suffix={unit}
                    onChange={(v) => applyEndpoints({ startX: displayToMm(v, unit), startY, endX, endY })}
                  />
                  <Field
                    label="Start Y"
                    value={mmToDisplay(startY, unit)}
                    suffix={unit}
                    onChange={(v) => applyEndpoints({ startX, startY: displayToMm(v, unit), endX, endY })}
                  />
                  <Field
                    label="End X"
                    value={mmToDisplay(endX, unit)}
                    suffix={unit}
                    onChange={(v) => applyEndpoints({ startX, startY, endX: displayToMm(v, unit), endY })}
                  />
                  <Field
                    label="End Y"
                    value={mmToDisplay(endY, unit)}
                    suffix={unit}
                    onChange={(v) => applyEndpoints({ startX, startY, endX, endY: displayToMm(v, unit) })}
                  />
                </div>
              );
            })()}
          {isWallLikeObject && (
            <p className="text-xs text-neutral-400">
              Different start/end heights slope the top edge (e.g. a stepped gable); different
              start/end elevations slope the base (e.g. to follow sloped land).
            </p>
          )}
          <button
            onClick={() => updateObject(object.id, { rotationDeg: ((object.rotationDeg + 180) % 360 + 360) % 360 })}
            className="rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
          >
            Flip 180° (swap front/back)
          </button>
          {objectVariants && (
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Style
              <select
                value={object.variant ?? objectVariants[0].id}
                onChange={(e) => updateObject(object.id, { variant: e.target.value })}
                className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
              >
                {objectVariants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {isStaircaseObject && (
            <div className="flex flex-col gap-3 rounded border border-neutral-200 p-2">
              <p className="text-xs text-neutral-500">Staircase</p>
              <Field
                label="Steps"
                value={object.stepCount ?? Math.max(6, Math.min(18, Math.round(object.depthMm / 1000 / 0.28)))}
                onChange={(v) => updateObject(object.id, { stepCount: Math.round(Math.max(2, Math.min(30, v))) })}
              />
              <label className="flex items-center gap-2 text-xs text-neutral-500">
                <input
                  type="checkbox"
                  checked={object.railEnabled ?? true}
                  onChange={(e) => updateObject(object.id, { railEnabled: e.target.checked })}
                />
                Handrail
              </label>
              {(object.railEnabled ?? true) && (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      label="Rail from"
                      value={object.railStartPercent ?? 0}
                      suffix="%"
                      onChange={(v) =>
                        updateObject(object.id, { railStartPercent: Math.round(Math.max(0, Math.min(100, v))) })
                      }
                    />
                    <Field
                      label="Rail to"
                      value={object.railEndPercent ?? 100}
                      suffix="%"
                      onChange={(v) =>
                        updateObject(object.id, { railEndPercent: Math.round(Math.max(0, Math.min(100, v))) })
                      }
                    />
                  </div>
                  <p className="text-xs text-neutral-400">
                    Coverage along the flight — 0% to 100% is the full run; narrow it to leave the rail
                    off part of the stairs (e.g. 30% to 100% skips the bottom steps).
                  </p>
                  {supportsRailSide && (
                    <>
                      <label className="flex flex-col gap-1 text-xs text-neutral-500">
                        Handrail side
                        <select
                          value={object.railSide ?? 'right'}
                          onChange={(e) =>
                            updateObject(object.id, { railSide: e.target.value as 'left' | 'right' | 'both' })
                          }
                          className="rounded border border-neutral-300 px-2 py-1 text-sm text-neutral-900"
                        >
                          <option value="right">Right</option>
                          <option value="left">Left</option>
                          <option value="both">Both sides</option>
                        </select>
                      </label>
                      <Field
                        label="Handrail offset"
                        value={mmToDisplay(object.railOffsetMm ?? -30, 'mm')}
                        suffix="mm"
                        onChange={(v) => updateObject(object.id, { railOffsetMm: v })}
                      />
                      <p className="text-xs text-neutral-400">
                        Negative tucks the rail in over the steps, positive lets it float out past the edge.
                      </p>
                    </>
                  )}
                </>
              )}
            </div>
          )}
          <label className="flex flex-col gap-1 text-xs text-neutral-500">
            Color
            <input
              type="color"
              value={object.color}
              onChange={(e) => updateObject(object.id, { color: e.target.value })}
              className="h-8 w-full rounded border border-neutral-300"
            />
          </label>
          <Field
            label="Construction day"
            value={object.constructionDay}
            onChange={(v) => updateObject(object.id, { constructionDay: clampConstructionDay(v) })}
          />
          {objectAsset?.vendorUrl && (
            <a
              href={objectAsset.vendorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-sage bg-sage-light px-3 py-1.5 text-center text-xs font-medium text-sage hover:underline"
            >
              Shop this item{objectAsset.vendorName ? ` at ${objectAsset.vendorName}` : ''} ↗
            </a>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => duplicateObject(object.id)}
              className="flex-1 rounded border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700"
            >
              Duplicate
            </button>
            <button onClick={removeSelected} className="flex-1 rounded border border-red-200 px-3 py-1.5 text-xs text-red-600">
              Delete
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
