import { wallLengthMm, type Wall, type WallOpening } from './document';

// Rather than true CSG (cutting holes out of a solid wall), a wall is split
// into a run of solid box segments along its length: full-height segments
// between openings, plus a sill segment below and a header segment above
// each opening where applicable. This keeps door/window openings genuinely
// walkable/see-through in 3D without a boolean-geometry library.

export interface WallSegment {
  startOffsetMm: number;
  endOffsetMm: number;
  bottomMm: number;
  topMm: number;
}

export interface OpeningFixture {
  opening: WallOpening;
  startOffsetMm: number;
  endOffsetMm: number;
  bottomMm: number;
  topMm: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function buildWallSegments(
  wall: Wall,
  openings: WallOpening[],
): { segments: WallSegment[]; fixtures: OpeningFixture[] } {
  const length = wallLengthMm(wall);
  const ranges = openings
    .map((opening) => ({
      opening,
      start: clamp(opening.offsetMm - opening.widthMm / 2, 0, length),
      end: clamp(opening.offsetMm + opening.widthMm / 2, 0, length),
    }))
    .filter((r) => r.end > r.start)
    .sort((a, b) => a.start - b.start);

  const segments: WallSegment[] = [];
  const fixtures: OpeningFixture[] = [];
  let cursor = 0;

  for (const { opening, start, end } of ranges) {
    if (start > cursor) {
      segments.push({ startOffsetMm: cursor, endOffsetMm: start, bottomMm: 0, topMm: wall.heightMm });
    }

    if (opening.sillHeightMm > 0) {
      segments.push({ startOffsetMm: start, endOffsetMm: end, bottomMm: 0, topMm: opening.sillHeightMm });
    }

    const headerBottomMm = opening.sillHeightMm + opening.heightMm;
    if (headerBottomMm < wall.heightMm) {
      segments.push({ startOffsetMm: start, endOffsetMm: end, bottomMm: headerBottomMm, topMm: wall.heightMm });
    }

    fixtures.push({
      opening,
      startOffsetMm: start,
      endOffsetMm: end,
      bottomMm: opening.sillHeightMm,
      topMm: Math.min(headerBottomMm, wall.heightMm),
    });

    cursor = Math.max(cursor, end);
  }

  if (cursor < length) {
    segments.push({ startOffsetMm: cursor, endOffsetMm: length, bottomMm: 0, topMm: wall.heightMm });
  }

  return { segments, fixtures };
}
