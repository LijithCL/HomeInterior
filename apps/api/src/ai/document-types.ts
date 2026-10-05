// Mirrors apps/web/src/lib/editor/document.ts. Kept in sync by hand for now
// since the document schema isn't shared between apps/api and apps/web yet
// (see docs/ARCHITECTURE.md on packages/schema, and the same duplication in
// projects.service.ts's EMPTY_DESIGN_DOCUMENT). All lengths/positions are
// integer millimeters.

export type OpeningType = 'DOOR' | 'WINDOW';

export interface Point {
  x: number;
  y: number;
}

export interface Floor {
  id: string;
  name: string;
  levelIndex: number;
  heightMm: number;
  hidden?: boolean;
}

export interface Wall {
  id: string;
  floorId: string;
  start: Point;
  end: Point;
  thicknessMm: number;
  heightMm: number;
  constructionDay: number;
}

export interface WallOpening {
  id: string;
  wallId: string;
  type: OpeningType;
  assetId: string;
  offsetMm: number;
  widthMm: number;
  heightMm: number;
  sillHeightMm: number;
  constructionDay: number;
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  polygon: Point[];
  wallIds: string[];
  constructionDay: number;
}

export interface SceneObject {
  id: string;
  floorId: string;
  assetId: string;
  name: string;
  x: number;
  y: number;
  rotationDeg: number;
  widthMm: number;
  depthMm: number;
  color: string;
  locked?: boolean;
  constructionDay: number;
}

export interface DesignDocument {
  schemaVersion: 2;
  floors: Floor[];
  walls: Wall[];
  openings: WallOpening[];
  rooms: Room[];
  objects: SceneObject[];
}

export const DEFAULT_WALL_HEIGHT_MM = 2700;
export const DEFAULT_FLOOR_HEIGHT_MM = 3000;
export const DEFAULT_ROOM_CONSTRUCTION_DAY = 1;
export const DEFAULT_WALL_CONSTRUCTION_DAY = 20;
export const DEFAULT_OPENING_CONSTRUCTION_DAY = 60;
export const DEFAULT_OBJECT_CONSTRUCTION_DAY = 100;

export function polygonCentroid(polygon: Point[]): Point {
  const n = polygon.length || 1;
  const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / n, y: sum.y / n };
}

export function wallLengthMm(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

export function pointAlongWall(wall: Wall, offsetMm: number): Point {
  const length = wallLengthMm(wall) || 1;
  const t = offsetMm / length;
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * t,
    y: wall.start.y + (wall.end.y - wall.start.y) * t,
  };
}

export function polygonAreaM2(polygon: Point[]): number {
  if (polygon.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2 / 1_000_000;
}

// Ray-casting point-in-polygon test, used to figure out which room an
// anchor point (e.g. "near the window") actually falls inside.
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonBounds(polygon: Point[]) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return {
    minX,
    minY,
    maxX,
    maxY,
    widthMm: maxX - minX,
    heightMm: maxY - minY,
  };
}
