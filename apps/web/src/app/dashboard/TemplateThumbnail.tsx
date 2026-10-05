import { polygonBounds } from '@/lib/editor/document';
import type { TemplatePreview } from '@/lib/editor/template-types';

const MARGIN_MM = 400;

// A tiny top-down SVG rendered straight from the same wall/room geometry
// buildDocumentFromPlan() produces — same reasoning as PrintPlanOverlay:
// the thumbnail is provably what you'll get, not a hand-drawn stand-in.
export function TemplateThumbnail({ preview }: { preview: TemplatePreview }) {
  const { walls, rooms } = preview;
  if (walls.length === 0) {
    return <div className="flex h-24 w-full items-center justify-center bg-neutral-50 text-xs text-neutral-400">Blank</div>;
  }

  const bounds = polygonBounds(walls.flatMap((w) => [w.start, w.end]));
  const viewBox = `${bounds.minX - MARGIN_MM} ${bounds.minY - MARGIN_MM} ${bounds.widthMm + MARGIN_MM * 2} ${bounds.heightMm + MARGIN_MM * 2}`;

  return (
    <svg viewBox={viewBox} className="h-24 w-full bg-neutral-50">
      {rooms.map((room) => (
        <polygon key={room.id} points={room.polygon.map((p) => `${p.x},${p.y}`).join(' ')} fill="#f5e3d5" stroke="none" />
      ))}
      {walls.map((wall) => (
        <line
          key={wall.id}
          x1={wall.start.x}
          y1={wall.start.y}
          x2={wall.end.x}
          y2={wall.end.y}
          stroke="#3f3f46"
          strokeWidth={Math.max(wall.thicknessMm, 100)}
          strokeLinecap="square"
        />
      ))}
    </svg>
  );
}
