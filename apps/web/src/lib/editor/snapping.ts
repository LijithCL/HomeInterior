import type { Point, Wall } from './document';

export function snapToGrid(point: Point, gridSizeMm: number): Point {
  return {
    x: Math.round(point.x / gridSizeMm) * gridSizeMm,
    y: Math.round(point.y / gridSizeMm) * gridSizeMm,
  };
}

// Snaps the angle of (start -> end) to the nearest multiple of `incrementDeg`
// while preserving the segment's length — used while drawing walls.
export function snapAngle(start: Point, end: Point, incrementDeg = 45): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return end;

  const angleRad = Math.atan2(dy, dx);
  const incrementRad = (incrementDeg * Math.PI) / 180;
  const snappedAngle = Math.round(angleRad / incrementRad) * incrementRad;

  return {
    x: start.x + Math.cos(snappedAngle) * length,
    y: start.y + Math.sin(snappedAngle) * length,
  };
}

// Nearest point on segment [a, b] to point p.
function closestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return a;

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

export interface WallSnapResult {
  point: Point;
  wallId: string;
}

// Finds the closest point on any wall within `thresholdMm`, for snapping a
// new wall's endpoint onto an existing wall, or a door/window placement.
export function snapPointToWalls(
  point: Point,
  walls: Wall[],
  thresholdMm: number,
  excludeWallId?: string,
): WallSnapResult | null {
  let best: WallSnapResult | null = null;
  let bestDist = thresholdMm;

  for (const wall of walls) {
    if (wall.id === excludeWallId) continue;
    const candidate = closestPointOnSegment(point, wall.start, wall.end);
    const dist = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (dist <= bestDist) {
      bestDist = dist;
      best = { point: candidate, wallId: wall.id };
    }
  }

  return best;
}

// Snaps a wall endpoint to another wall's endpoint (corner joins) within
// `thresholdMm`, falling back to null when nothing is close enough.
export function snapToWallEndpoints(point: Point, walls: Wall[], thresholdMm: number): Point | null {
  let best: Point | null = null;
  let bestDist = thresholdMm;

  for (const wall of walls) {
    for (const candidate of [wall.start, wall.end]) {
      const dist = Math.hypot(candidate.x - point.x, candidate.y - point.y);
      if (dist <= bestDist) {
        bestDist = dist;
        best = candidate;
      }
    }
  }

  return best;
}
