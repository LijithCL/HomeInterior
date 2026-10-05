// All lengths/positions are stored as integer millimeters — never floats —
// so repeated edits and unit conversions (mm/cm/m/ft for display only)
// never drift. See docs/ARCHITECTURE.md §C.

export type OpeningType = 'DOOR' | 'WINDOW';

export const DEFAULT_WALL_HEIGHT_MM = 2700;
export const DEFAULT_WINDOW_SILL_MM = 900;
// Floor-to-floor height (wall height + slab/ceiling void) used to stack
// floors vertically in 3D — intentionally taller than DEFAULT_WALL_HEIGHT_MM.
export const DEFAULT_FLOOR_HEIGHT_MM = 3000;
export const GROUND_FLOOR_NAME = 'Ground Floor';

// 4D construction timeline (§5/§E in the architecture doc): each element
// carries the day it "appears" as the house is built, rather than 4D being
// a separate document — the timeline slider just filters this same
// document by day. Defaults roughly follow the example phases in the spec;
// day 40 (Roof) and day 80 (Interior) have no dedicated entity type yet, so
// nothing new appears at those ticks specifically — they're still valid
// scrub points on the timeline.
export const CONSTRUCTION_DAY_MIN = 1;
export const CONSTRUCTION_DAY_MAX = 120;
export const DEFAULT_ROOM_CONSTRUCTION_DAY = 1; // foundation/slab
export const DEFAULT_WALL_CONSTRUCTION_DAY = 20;
export const DEFAULT_OPENING_CONSTRUCTION_DAY = 60;
export const DEFAULT_OBJECT_CONSTRUCTION_DAY = 100;

export const CONSTRUCTION_PHASES: { day: number; label: string }[] = [
  { day: 1, label: 'Foundation' },
  { day: 20, label: 'Walls' },
  { day: 40, label: 'Roof' },
  { day: 60, label: 'Doors & Windows' },
  { day: 80, label: 'Interior' },
  { day: 100, label: 'Furniture' },
  { day: 120, label: 'Final' },
];

export interface Point {
  x: number;
  y: number;
}

export interface Floor {
  id: string;
  name: string;
  levelIndex: number; // 0 = ground, 1 = first, -1 = basement; also stacking/sort order
  heightMm: number;
  hidden?: boolean; // hidden when viewing "all floors" in 3D
  // A traced-over blueprint/photo shown as a 2D-only backdrop (§ CAD
  // import, scoped down to an image trace) — never rendered in 3D, and
  // never part of the actual design, just a drawing aid. `underlayImageKey`
  // is a storage key (see apps/api ProjectsService.uploadUnderlayImage),
  // resolved to a fresh signed URL client-side since signed URLs expire.
  underlayImageKey?: string;
  underlayWidthMm?: number; // displayed width; height follows the image's own aspect ratio
  underlayX?: number; // top-left corner, mm
  underlayY?: number;
  underlayOpacity?: number; // 0–1, default 0.5
}

export interface Wall {
  id: string;
  floorId: string;
  start: Point;
  end: Point;
  thicknessMm: number;
  heightMm: number;
  constructionDay: number;
  // Undefined means "use the view's default" (2D's schematic line color or
  // 3D's default drywall material) — only set once a user explicitly picks
  // a color, so existing designs keep looking the same.
  color?: string;
  // A textured finish (see lib/editor/materials.ts) rendered on the 3D wall
  // faces; `color` still drives the flat 2D line color either way, since a
  // wall's thin top-down stroke in 2D can't usefully show texture detail.
  materialId?: string;
  // Height above the floor (mm) the wall's base sits at — lets a wall float
  // above the floor (a raised parapet, a suspended partition, etc.) instead
  // of always starting at floor level. Undefined/absent means 0 (floor
  // level), backfilled by sanitizeDocument.
  elevationMm?: number;
  // Height (mm) at the `end` point, when different from `heightMm` at the
  // `start` point — makes the wall's top edge slope linearly between the two,
  // for gable ends and other pitched-roof walls. Undefined means "flat, same
  // height as `heightMm` all the way along" (the previous, and still default,
  // behavior), so every design saved before this feature keeps rendering
  // exactly as it did.
  endHeightMm?: number;
  // Elevation (mm) at the `end` point, when different from `elevationMm` at
  // the `start` point — makes the wall's base slope linearly between the
  // two (e.g. to follow a sloped floor/terrain), independent of the top-edge
  // slope from `endHeightMm`. Undefined means "flat, same elevation as
  // `elevationMm` all the way along".
  endElevationMm?: number;
}

export interface WallOpening {
  id: string;
  wallId: string;
  type: OpeningType;
  assetId: string;
  offsetMm: number; // distance along the wall from `start`, to the opening's center
  widthMm: number;
  heightMm: number;
  sillHeightMm: number; // height of the opening's bottom edge above the floor (0 for doors)
  constructionDay: number;
}

export interface Room {
  id: string;
  floorId: string;
  name: string;
  polygon: Point[]; // mm, closed implicitly (last point connects to first)
  wallIds: string[]; // walls created together with this room, for width/length resize
  constructionDay: number;
  ceilingColor?: string; // undefined -> render with the default ceiling color
  // Textured floor finish (see lib/editor/materials.ts), shown as the fill
  // pattern in the 2D room polygon and on the 3D floor mesh alike.
  floorMaterialId?: string;
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
  // Height above the floor (mm) — lets an object be raised off the ground
  // (mounted, stacked on another object, etc.) instead of always sitting
  // directly on the floor plane. Undefined/absent means 0 (floor level),
  // backfilled by sanitizeDocument.
  elevationMm?: number;
  // The object's own vertical size (mm), overriding its asset's
  // `defaultHeightMm` for this one placed instance. Left undefined for the
  // vast majority of objects, which just render at their asset's default
  // height — only set once a user explicitly resizes an instance's height,
  // so every design saved before this feature keeps rendering exactly as
  // it did (never backfilled by sanitizeDocument, unlike the other numeric
  // fields above, since there's no asset-independent fallback that would
  // be correct for every category).
  heightMm?: number;
  // A style variant for this one placed instance (e.g. a sofa's
  // 'straight' | 'l-shaped' | 'loveseat' silhouette) — see
  // lib/editor/object-variants.ts for which categories have real variants
  // and what their ids are. Undefined means "the asset's default shape",
  // so every design saved before this feature keeps rendering exactly as
  // it did.
  variant?: string;
  // Staircase-only: which side of the flight the handrail runs along, or
  // 'both' for a rail on each side. Undefined means 'right' (the previous,
  // and still default, behavior).
  railSide?: 'left' | 'right' | 'both';
  // Staircase-only: how far the handrail sits from the stair's edge (mm) —
  // negative tucks it in over the tread, 0 sits flush with the edge,
  // positive lets it float further out past the edge. Undefined means -30
  // (the previous, and still default, inset).
  railOffsetMm?: number;
  // Staircase-only: overrides the number of steps the asset would otherwise
  // compute from its own depth. Undefined means "auto, from depth" (the
  // previous, and still default, behavior).
  stepCount?: number;
  // Staircase-only: whether the handrail renders at all. Undefined means
  // true (the previous, and still default, behavior) — set to false to
  // remove it entirely.
  railEnabled?: boolean;
  // Staircase-only: the portion of the flight (0–100, percent along its
  // length) the handrail covers, for a partial rail instead of a full one
  // (e.g. skip the bottom steps near an open landing). Undefined means 0 and
  // 100 respectively (the previous, and still default, full-length rail).
  railStartPercent?: number;
  railEndPercent?: number;
  // Wall-like exterior objects only (e.g. Boundary Wall): height/elevation
  // at the End point, when different from `heightMm`/`elevationMm` (which
  // apply at the Start point) — slopes the wall's top edge and/or base
  // between the two, the same idea as Wall.endHeightMm/endElevationMm, for
  // a boundary wall that needs to follow sloped land or step up a gable.
  // Undefined means flat (matches heightMm/elevationMm all the way along),
  // the previous, and still default, behavior.
  endHeightMm?: number;
  endElevationMm?: number;
}

export interface DesignDocument {
  schemaVersion: 2;
  floors: Floor[];
  walls: Wall[];
  openings: WallOpening[];
  rooms: Room[];
  objects: SceneObject[];
}

export function createEmptyDocument(): DesignDocument {
  const groundFloor: Floor = {
    id: 'floor-ground',
    name: GROUND_FLOOR_NAME,
    levelIndex: 0,
    heightMm: DEFAULT_FLOOR_HEIGHT_MM,
  };
  return { schemaVersion: 2, floors: [groundFloor], walls: [], openings: [], rooms: [], objects: [] };
}

// Documents saved before multi-floor support (schemaVersion 1) have no
// `floors` array and no `floorId` on their walls/rooms/objects. Wrap
// everything into a single Ground Floor so those projects keep opening
// exactly as they looked, rather than erroring on a missing floor.
export function migrateDocument(doc: unknown): DesignDocument {
  const candidate = doc as Partial<DesignDocument> & { schemaVersion?: number };
  if (candidate.schemaVersion === 2 && Array.isArray(candidate.floors) && candidate.floors.length > 0) {
    return candidate as DesignDocument;
  }

  const groundFloorId = 'floor-ground';
  const groundFloor: Floor = {
    id: groundFloorId,
    name: GROUND_FLOOR_NAME,
    levelIndex: 0,
    heightMm: DEFAULT_FLOOR_HEIGHT_MM,
  };

  return {
    schemaVersion: 2,
    floors: [groundFloor],
    // constructionDay defaults are backfilled by sanitizeDocument, which
    // always runs after this — no need to duplicate that logic here.
    walls: (candidate.walls ?? []).map((w) => ({ ...w, floorId: groundFloorId })),
    openings: candidate.openings ?? [],
    rooms: (candidate.rooms ?? []).map((r) => ({ ...r, floorId: groundFloorId })),
    objects: (candidate.objects ?? []).map((o) => ({ ...o, floorId: groundFloorId })),
  };
}

function finite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

// Repairs any non-finite numbers a document may have picked up before the
// numeric property-panel inputs were guarded against NaN (a lone "-" or an
// emptied field used to be forwarded straight into the document). A NaN
// position/size reaching Three.js throws at the WebGL layer, so documents
// saved during that window need to self-heal on load rather than crash
// every time they're opened.
export function sanitizeDocument(doc: DesignDocument): DesignDocument {
  const floors = doc.floors.map((f, i) => ({
    ...f,
    levelIndex: Number.isFinite(f.levelIndex) ? f.levelIndex : i,
    heightMm: finite(f.heightMm, DEFAULT_FLOOR_HEIGHT_MM),
  }));
  const floorIds = new Set(floors.map((f) => f.id));
  const fallbackFloorId = floors[0]?.id ?? 'floor-ground';
  const floorIdOf = (id: string) => (floorIds.has(id) ? id : fallbackFloorId);

  const walls = doc.walls.map((w) => {
    // Computed once so the endHeightMm/endElevationMm fallbacks below read
    // the already-sanitized values — falling back to the raw w.heightMm/
    // w.elevationMm instead would let a NaN heightMm leak back in via
    // Math.max(300, finite(NaN, NaN)) === NaN when both fields are corrupt.
    const heightMm = finite(w.heightMm, DEFAULT_WALL_HEIGHT_MM);
    const elevationMm = Math.max(0, finite(w.elevationMm ?? 0, 0));
    return {
      ...w,
      floorId: floorIdOf(w.floorId),
      start: { x: finite(w.start.x, 0), y: finite(w.start.y, 0) },
      end: { x: finite(w.end.x, 0), y: finite(w.end.y, 0) },
      thicknessMm: finite(w.thicknessMm, 150),
      heightMm,
      constructionDay: finite(w.constructionDay, DEFAULT_WALL_CONSTRUCTION_DAY),
      elevationMm,
      endHeightMm: w.endHeightMm === undefined ? undefined : Math.max(300, finite(w.endHeightMm, heightMm)),
      endElevationMm:
        w.endElevationMm === undefined ? undefined : Math.max(0, finite(w.endElevationMm, elevationMm)),
    };
  });

  const openings = doc.openings.map((o) => ({
    ...o,
    offsetMm: finite(o.offsetMm, 0),
    widthMm: finite(o.widthMm, 900),
    heightMm: finite(o.heightMm, o.type === 'DOOR' ? 2100 : 1200),
    sillHeightMm: finite(o.sillHeightMm, o.type === 'DOOR' ? 0 : DEFAULT_WINDOW_SILL_MM),
    constructionDay: finite(o.constructionDay, DEFAULT_OPENING_CONSTRUCTION_DAY),
  }));

  const rooms = doc.rooms
    .map((r) => ({
      ...r,
      floorId: floorIdOf(r.floorId),
      polygon: r.polygon.map((p) => ({ x: finite(p.x, 0), y: finite(p.y, 0) })),
      constructionDay: finite(r.constructionDay, DEFAULT_ROOM_CONSTRUCTION_DAY),
    }))
    .filter((r) => r.polygon.length >= 3);

  const objects = doc.objects.map((o) => {
    // Computed once so the endHeightMm/endElevationMm fallbacks below read
    // already-sanitized values — same reasoning as the walls loop above.
    const elevationMm = Math.max(0, finite(o.elevationMm ?? 0, 0));
    const heightMm = o.heightMm === undefined ? undefined : Math.max(50, finite(o.heightMm, 800));
    return {
      ...o,
      floorId: floorIdOf(o.floorId),
      x: finite(o.x, 0),
      y: finite(o.y, 0),
      rotationDeg: finite(o.rotationDeg, 0),
      widthMm: finite(o.widthMm, 300),
      depthMm: finite(o.depthMm, 300),
      constructionDay: finite(o.constructionDay, DEFAULT_OBJECT_CONSTRUCTION_DAY),
      elevationMm,
      heightMm,
      // Wall-like-object slope fields (Boundary Wall/Hand Grill only, but
      // harmless on any other object since nothing reads them) — same
      // undefined-passthrough-else-sanitize pattern as Wall.endHeightMm/
      // endElevationMm, so a corrupted save can't push a NaN into the
      // sloped-geometry ExtrudeGeometry calls in asset-models.tsx.
      endHeightMm: o.endHeightMm === undefined ? undefined : Math.max(50, finite(o.endHeightMm, heightMm ?? 800)),
      endElevationMm:
        o.endElevationMm === undefined ? undefined : Math.max(0, finite(o.endElevationMm, elevationMm)),
      // Staircase-only fields — same reasoning: harmless on non-staircase
      // objects, but guarded so a corrupted value can't reach the handrail/
      // step-count math in asset-models.tsx.
      railSide: o.railSide === 'left' || o.railSide === 'right' || o.railSide === 'both' ? o.railSide : undefined,
      railOffsetMm: o.railOffsetMm === undefined ? undefined : finite(o.railOffsetMm, -30),
      stepCount:
        o.stepCount === undefined ? undefined : Math.max(2, Math.min(30, Math.round(finite(o.stepCount, 8)))),
      railEnabled: typeof o.railEnabled === 'boolean' ? o.railEnabled : undefined,
      railStartPercent:
        o.railStartPercent === undefined ? undefined : Math.max(0, Math.min(100, finite(o.railStartPercent, 0))),
      railEndPercent:
        o.railEndPercent === undefined ? undefined : Math.max(0, Math.min(100, finite(o.railEndPercent, 100))),
    };
  });

  return { ...doc, floors, walls, openings, rooms, objects };
}

// Builds the 4 perimeter walls for a rectangular room between two opposite
// corners. Wall ids are pre-generated (not via nanoid here) so callers can
// add both the walls and the room referencing those ids in one store batch.
export function buildRectRoomWalls(
  corner1: Point,
  corner2: Point,
  thicknessMm: number,
  floorId: string,
  makeId: () => string,
): { walls: Wall[]; polygon: Point[] } {
  const minX = Math.min(corner1.x, corner2.x);
  const maxX = Math.max(corner1.x, corner2.x);
  const minY = Math.min(corner1.y, corner2.y);
  const maxY = Math.max(corner1.y, corner2.y);

  const topLeft = { x: minX, y: minY };
  const topRight = { x: maxX, y: minY };
  const bottomRight = { x: maxX, y: maxY };
  const bottomLeft = { x: minX, y: maxY };

  const corners = [topLeft, topRight, bottomRight, bottomLeft];
  const walls: Wall[] = corners.map((start, i) => ({
    id: makeId(),
    floorId,
    start,
    end: corners[(i + 1) % corners.length],
    thicknessMm,
    heightMm: DEFAULT_WALL_HEIGHT_MM,
    constructionDay: DEFAULT_WALL_CONSTRUCTION_DAY,
  }));

  return { walls, polygon: corners };
}

export function wallLengthMm(wall: Wall): number {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
}

export function wallAngleRad(wall: Wall): number {
  return Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);
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
  return Math.abs(sum) / 2 / 1_000_000; // mm^2 -> m^2
}

export function polygonBounds(polygon: Point[]) {
  const xs = polygon.map((p) => p.x);
  const ys = polygon.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const maxX = Math.max(...xs);
  const maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, widthMm: maxX - minX, heightMm: maxY - minY };
}

// Vertical offset (mm, from ground level) at which a floor's geometry
// should sit when all floors are stacked and viewed together in 3D — the
// sum of every floor's height below this one's levelIndex.
export function floorStackOffsetMm(floors: Floor[], floorId: string): number {
  const target = floors.find((f) => f.id === floorId);
  if (!target) return 0;
  return floors
    .filter((f) => f.levelIndex < target.levelIndex)
    .reduce((sum, f) => sum + f.heightMm, 0);
}

export function polygonCentroid(polygon: Point[]): Point {
  const n = polygon.length || 1;
  const sum = polygon.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / n, y: sum.y / n };
}
