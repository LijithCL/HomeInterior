'use client';

import { useEditorStore } from '@/lib/editor/editor-store';
import { polygonAreaM2, polygonBounds, polygonCentroid, wallAngleRad, wallLengthMm } from '@/lib/editor/document';
import { formatArea, formatLength } from '@/lib/editor/units';
import type { Wall, WallOpening } from '@/lib/editor/document';

const MARGIN_MM = 800;

// Same gap-range math as buildWallSegments (wall-geometry.ts), simplified to
// just the horizontal ranges a top-down plan needs — a print sheet doesn't
// care about sill height, only "is there a gap in the wall line here".
function wallLineSegments(wall: Wall, openings: WallOpening[]): { startOffsetMm: number; endOffsetMm: number }[] {
  const length = wallLengthMm(wall);
  const gaps = openings
    .map((o) => ({
      start: Math.max(0, o.offsetMm - o.widthMm / 2),
      end: Math.min(length, o.offsetMm + o.widthMm / 2),
    }))
    .filter((g) => g.end > g.start)
    .sort((a, b) => a.start - b.start);

  const segments: { startOffsetMm: number; endOffsetMm: number }[] = [];
  let cursor = 0;
  for (const gap of gaps) {
    if (gap.start > cursor) segments.push({ startOffsetMm: cursor, endOffsetMm: gap.start });
    cursor = Math.max(cursor, gap.end);
  }
  if (cursor < length) segments.push({ startOffsetMm: cursor, endOffsetMm: length });
  return segments;
}

function pointAt(wall: Wall, offsetMm: number) {
  const length = wallLengthMm(wall) || 1;
  const t = offsetMm / length;
  return { x: wall.start.x + (wall.end.x - wall.start.x) * t, y: wall.start.y + (wall.end.y - wall.start.y) * t };
}

interface PrintPlanOverlayProps {
  projectName: string;
  onClose: () => void;
}

export function PrintPlanOverlay({ projectName, onClose }: PrintPlanOverlayProps) {
  const document = useEditorStore((s) => s.document);
  const activeFloorId = useEditorStore((s) => s.activeFloorId);
  const unit = useEditorStore((s) => s.unit);

  const floor = document.floors.find((f) => f.id === activeFloorId);
  const floorWalls = document.walls.filter((w) => w.floorId === activeFloorId);
  const floorWallIds = new Set(floorWalls.map((w) => w.id));
  const floorRooms = document.rooms.filter((r) => r.floorId === activeFloorId);
  const floorOpenings = document.openings.filter((o) => floorWallIds.has(o.wallId));

  const bounds = polygonBounds(floorWalls.length > 0 ? floorWalls.flatMap((w) => [w.start, w.end]) : [{ x: 0, y: 0 }]);
  const viewBox = `${bounds.minX - MARGIN_MM} ${bounds.minY - MARGIN_MM} ${bounds.widthMm + MARGIN_MM * 2} ${bounds.heightMm + MARGIN_MM * 2}`;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white">
      <div className="print:hidden sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-2 shadow-sm">
        <p className="text-sm font-medium text-neutral-900">Print preview — {floor?.name ?? 'Floor plan'}</p>
        <div className="ml-auto flex gap-2">
          <button onClick={() => window.print()} className="rounded bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white">
            Print / Save as PDF
          </button>
          <button onClick={onClose} className="rounded border border-neutral-300 px-4 py-1.5 text-sm text-neutral-700">
            Close
          </button>
        </div>
      </div>

      <div id="print-plan-root" className="mx-auto max-w-4xl p-8">
        <div className="mb-4 flex items-baseline justify-between border-b border-neutral-300 pb-2">
          <div>
            <h1 className="text-lg font-semibold text-neutral-900">{projectName}</h1>
            <p className="text-sm text-neutral-500">{floor?.name ?? 'Floor plan'}</p>
          </div>
          <p className="text-xs text-neutral-400">Printed {new Date().toLocaleDateString()}</p>
        </div>

        <svg viewBox={viewBox} className="w-full" style={{ aspectRatio: `${bounds.widthMm + MARGIN_MM * 2} / ${bounds.heightMm + MARGIN_MM * 2}` }}>
          {floorRooms.map((room) => {
            const centroid = polygonCentroid(room.polygon);
            const area = polygonAreaM2(room.polygon);
            return (
              <g key={room.id}>
                <polygon
                  points={room.polygon.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="rgba(0,0,0,0.03)"
                  stroke="none"
                />
                <text x={centroid.x} y={centroid.y} fontSize={140} textAnchor="middle" fill="#525252">
                  {room.name}
                </text>
                <text x={centroid.x} y={centroid.y + 170} fontSize={110} textAnchor="middle" fill="#8a8a8a">
                  {formatArea(area, unit)}
                </text>
              </g>
            );
          })}

          {floorWalls.map((wall) => {
            const openings = floorOpenings.filter((o) => o.wallId === wall.id);
            const segments = wallLineSegments(wall, openings);
            const angleDeg = (wallAngleRad(wall) * 180) / Math.PI;
            const mid = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
            return (
              <g key={wall.id}>
                {segments.map((seg, i) => {
                  const a = pointAt(wall, seg.startOffsetMm);
                  const b = pointAt(wall, seg.endOffsetMm);
                  return (
                    <line
                      key={i}
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#171717"
                      strokeWidth={Math.max(wall.thicknessMm, 60)}
                      strokeLinecap="square"
                    />
                  );
                })}
                <text
                  x={mid.x}
                  y={mid.y}
                  fontSize={110}
                  textAnchor="middle"
                  fill="#404040"
                  transform={`rotate(${angleDeg}, ${mid.x}, ${mid.y})`}
                  dy={-wall.thicknessMm / 2 - 60}
                >
                  {formatLength(wallLengthMm(wall), unit)}
                </text>
              </g>
            );
          })}
        </svg>

        <p className="mt-4 text-xs text-neutral-400">
          Wall lengths and room areas are labeled directly on the plan. Printed page scale is approximate — use the
          labeled dimensions for measurements, not a ruler against the page.
        </p>
      </div>
    </div>
  );
}
