import {
  DEFAULT_FLOOR_HEIGHT_MM,
  DEFAULT_OBJECT_CONSTRUCTION_DAY,
  DEFAULT_ROOM_CONSTRUCTION_DAY,
  DEFAULT_WALL_CONSTRUCTION_DAY,
  DEFAULT_WALL_HEIGHT_MM,
  type DesignDocument,
  type Floor,
  type Point,
  type Room,
  type SceneObject,
  type Wall,
  type WallOpening,
} from '../document-types';
import type {
  AiCatalogAsset,
  ProposedLayoutPlan,
} from '../providers/ai-provider.interface';
import { matchCatalogAsset } from './catalog-match';

const ROOM_GAP_MM = 300;
const ROW_MAX_WIDTH_MM = 11000;
const WALL_THICKNESS_MM = 150;
const FURNITURE_MARGIN_MM = 250;
const FURNITURE_GAP_MM = 150;

// Builds the 4 perimeter walls for a rectangular room, mirroring
// apps/web/src/lib/editor/document.ts buildRectRoomWalls exactly (same
// corner order: topLeft, topRight, bottomRight, bottomLeft) so the
// resulting document renders identically in the editor.
function buildRectRoomWalls(
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

  const corners = [
    { x: minX, y: minY },
    { x: maxX, y: minY },
    { x: maxX, y: maxY },
    { x: minX, y: maxY },
  ];
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

// Deterministically lays out a room program from the AI into real
// wall/room/object geometry — the AI proposes sizes and furniture
// keywords, this function does all the actual coordinate math. See the
// module comment on ai-provider.interface.ts.
export function buildDocumentFromPlan(
  plan: ProposedLayoutPlan,
  catalog: AiCatalogAsset[],
): DesignDocument {
  const floorId = 'floor-ai-ground';
  const floor: Floor = {
    id: floorId,
    name: 'Ground Floor',
    levelIndex: 0,
    heightMm: DEFAULT_FLOOR_HEIGHT_MM,
  };

  const walls: Wall[] = [];
  const openings: WallOpening[] = [];
  const rooms: Room[] = [];
  const objects: SceneObject[] = [];

  let idCounter = 0;
  const nextId = () => `ai-${idCounter++}`;
  const doorAsset = catalog.find((a) => a.category === 'DOOR');

  let cursorX = 0;
  let cursorY = 0;
  let rowHeight = 0;

  for (const room of plan.rooms) {
    if (cursorX > 0 && cursorX + room.widthMm > ROW_MAX_WIDTH_MM) {
      cursorX = 0;
      cursorY += rowHeight + ROOM_GAP_MM;
      rowHeight = 0;
    }

    const corner1: Point = { x: cursorX, y: cursorY };
    const corner2: Point = {
      x: cursorX + room.widthMm,
      y: cursorY + room.lengthMm,
    };
    const { walls: roomWalls, polygon } = buildRectRoomWalls(
      corner1,
      corner2,
      WALL_THICKNESS_MM,
      floorId,
      nextId,
    );
    walls.push(...roomWalls);

    const roomId = nextId();
    rooms.push({
      id: roomId,
      floorId,
      name: room.name,
      polygon,
      wallIds: roomWalls.map((w) => w.id),
      constructionDay: DEFAULT_ROOM_CONSTRUCTION_DAY,
    });

    // One door centered on the room's bottom wall (index 2: bottomRight ->
    // bottomLeft), so generated houses are at least nominally enterable.
    if (doorAsset) {
      const bottomWall = roomWalls[2];
      openings.push({
        id: nextId(),
        wallId: bottomWall.id,
        type: 'DOOR',
        assetId: doorAsset.id,
        offsetMm: Math.round(room.widthMm / 2),
        widthMm: doorAsset.defaultWidthMm,
        heightMm: doorAsset.defaultHeightMm,
        sillHeightMm: 0,
        constructionDay: DEFAULT_WALL_CONSTRUCTION_DAY + 40,
      });
    }

    placeFurniture(
      room.furniture,
      corner1,
      corner2,
      catalog,
      floorId,
      objects,
      nextId,
    );

    cursorX += room.widthMm + ROOM_GAP_MM;
    rowHeight = Math.max(rowHeight, room.lengthMm);
  }

  return { schemaVersion: 2, floors: [floor], walls, openings, rooms, objects };
}

function placeFurniture(
  furniture: string[],
  corner1: Point,
  corner2: Point,
  catalog: AiCatalogAsset[],
  floorId: string,
  objects: SceneObject[],
  nextId: () => string,
): void {
  const minX = Math.min(corner1.x, corner2.x);
  const minY = Math.min(corner1.y, corner2.y);
  const maxX = Math.max(corner1.x, corner2.x) - FURNITURE_MARGIN_MM;

  let cursorX = minX + FURNITURE_MARGIN_MM;
  let cursorY = minY + FURNITURE_MARGIN_MM;
  let rowDepth = 0;

  for (const keyword of furniture) {
    const asset = matchCatalogAsset(keyword, catalog);
    if (!asset) continue;

    const width = asset.defaultWidthMm;
    const depth = asset.defaultDepthMm;
    if (cursorX + width > maxX && cursorX > minX + FURNITURE_MARGIN_MM) {
      cursorX = minX + FURNITURE_MARGIN_MM;
      cursorY += rowDepth + FURNITURE_GAP_MM;
      rowDepth = 0;
    }

    objects.push({
      id: nextId(),
      floorId,
      assetId: asset.id,
      name: asset.name,
      x: cursorX + width / 2,
      y: cursorY + depth / 2,
      rotationDeg: 0,
      widthMm: width,
      depthMm: depth,
      color: asset.color,
      constructionDay: DEFAULT_OBJECT_CONSTRUCTION_DAY,
    });

    cursorX += width + FURNITURE_GAP_MM;
    rowDepth = Math.max(rowDepth, depth);
  }
}
