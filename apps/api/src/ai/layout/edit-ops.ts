import {
  DEFAULT_OBJECT_CONSTRUCTION_DAY,
  pointAlongWall,
  pointInPolygon,
  polygonAreaM2,
  polygonBounds,
  polygonCentroid,
  wallLengthMm,
  type DesignDocument,
  type Point,
  type Room,
  type SceneObject,
  type Wall,
} from '../document-types';
import type {
  AiCatalogAsset,
  EditOp,
} from '../providers/ai-provider.interface';
import { matchCatalogAsset } from './catalog-match';

export interface EditOpsResult {
  document: DesignDocument;
  changeSummary: string[];
}

function findObjectIndex(document: DesignDocument, name: string): number {
  const n = name.trim().toLowerCase();
  return document.objects.findIndex(
    (o) =>
      o.name.toLowerCase() === n ||
      o.name.toLowerCase().includes(n) ||
      n.includes(o.name.toLowerCase()),
  );
}

function findRoomIndex(document: DesignDocument, name: string): number {
  const n = name.trim().toLowerCase();
  return document.rooms.findIndex(
    (r) =>
      r.name.toLowerCase() === n ||
      r.name.toLowerCase().includes(n) ||
      n.includes(r.name.toLowerCase()),
  );
}

function roomContainingPoint(
  document: DesignDocument,
  floorId: string,
  point: Point,
): Room | undefined {
  return document.rooms.find(
    (r) => r.floorId === floorId && pointInPolygon(point, r.polygon),
  );
}

function largestRoom(document: DesignDocument): Room | undefined {
  return [...document.rooms].sort(
    (a, b) => polygonAreaM2(b.polygon) - polygonAreaM2(a.polygon),
  )[0];
}

// Resolves a "near the window" / "near the door" anchor to an actual point,
// by finding the nearest matching opening on the object's floor and
// offsetting inward from its wall — the AI never supplies raw coordinates
// for this, only the anchor keyword (see ai-provider.interface.ts).
function resolveOpeningAnchor(
  document: DesignDocument,
  floorId: string,
  openingType: 'DOOR' | 'WINDOW',
  objectFootprintMm: number,
): Point | undefined {
  const wallsById = new Map(document.walls.map((w) => [w.id, w]));
  const opening = document.openings.find((o) => {
    const wall = wallsById.get(o.wallId);
    return o.type === openingType && wall?.floorId === floorId;
  });
  if (!opening) return undefined;
  const wall = wallsById.get(opening.wallId);
  if (!wall) return undefined;

  const onWall = pointAlongWall(wall, opening.offsetMm);
  const length = wallLengthMm(wall) || 1;
  const dx = (wall.end.x - wall.start.x) / length;
  const dy = (wall.end.y - wall.start.y) / length;
  const offset = wall.thicknessMm / 2 + objectFootprintMm / 2 + 50;
  // Perpendicular to the wall, in both directions — pick whichever side
  // actually falls inside a room on this wall, so furniture ends up
  // indoors rather than through the wall.
  const candidates: Point[] = [
    { x: onWall.x - dy * offset, y: onWall.y + dx * offset },
    { x: onWall.x + dy * offset, y: onWall.y - dx * offset },
  ];
  const room = document.rooms.find(
    (r) => r.floorId === floorId && r.wallIds.includes(wall.id),
  );
  if (room) {
    const inside = candidates.find((p) => pointInPolygon(p, room.polygon));
    if (inside) return inside;
  }
  return candidates[0];
}

function resolveAnchorPoint(
  document: DesignDocument,
  object: Pick<SceneObject, 'floorId' | 'x' | 'y' | 'widthMm' | 'depthMm'>,
  anchor: EditOp['anchor'],
): Point | undefined {
  const footprint = Math.max(object.widthMm, object.depthMm);
  if (anchor === 'window' || anchor === 'door') {
    return resolveOpeningAnchor(
      document,
      object.floorId,
      anchor === 'window' ? 'WINDOW' : 'DOOR',
      footprint,
    );
  }
  if (anchor === 'room-center') {
    const room =
      roomContainingPoint(document, object.floorId, {
        x: object.x,
        y: object.y,
      }) ?? largestRoom(document);
    return room ? polygonCentroid(room.polygon) : undefined;
  }
  return undefined;
}

function wallByIdMap(document: DesignDocument): Map<string, Wall> {
  return new Map(document.walls.map((w) => [w.id, w]));
}

// Rebuilds a rectangular room's 4 perimeter walls at a new size, anchored
// at its current top-left corner — recycling the room's existing wall ids
// where possible so any openings on those walls stay attached, exactly
// like resizeRoom in apps/web's editor store.
function rebuildRoomWalls(
  document: DesignDocument,
  room: Room,
  widthMm: number,
  lengthMm: number,
): { walls: Wall[]; polygon: Point[] } {
  const bounds = polygonBounds(room.polygon);
  const thicknessMm =
    wallByIdMap(document).get(room.wallIds[0])?.thicknessMm ?? 150;
  const minX = bounds.minX;
  const minY = bounds.minY;
  const corners = [
    { x: minX, y: minY },
    { x: minX + widthMm, y: minY },
    { x: minX + widthMm, y: minY + lengthMm },
    { x: minX, y: minY + lengthMm },
  ];
  const idPool = [...room.wallIds];
  let extraCounter = 0;
  const walls: Wall[] = corners.map((start, i) => ({
    id: idPool.shift() ?? `ai-resize-${room.id}-${extraCounter++}`,
    floorId: room.floorId,
    start,
    end: corners[(i + 1) % corners.length],
    thicknessMm,
    heightMm: 2700,
    constructionDay: 20,
  }));
  return { walls, polygon: corners };
}

// Applies a list of AI-proposed edit operations to a cloned document.
// Never mutates the input — the caller decides whether/when to persist the
// result (see AiService.apply, which only writes a real DesignVersion once
// the user explicitly accepts the proposal).
export function applyEditOps(
  document: DesignDocument,
  ops: EditOp[],
  catalog: AiCatalogAsset[],
): EditOpsResult {
  let doc: DesignDocument = structuredClone(document);
  const changeSummary: string[] = [];

  for (const op of ops) {
    switch (op.op) {
      case 'move_object': {
        const idx = findObjectIndex(doc, op.targetName);
        if (idx < 0) {
          changeSummary.push(
            `Could not find an object named "${op.targetName}" to move.`,
          );
          break;
        }
        const object = doc.objects[idx];
        const point = resolveAnchorPoint(doc, object, op.anchor);
        if (!point) {
          changeSummary.push(
            `Could not resolve a position for "${object.name}".`,
          );
          break;
        }
        doc.objects[idx] = {
          ...object,
          x: Math.round(point.x),
          y: Math.round(point.y),
        };
        changeSummary.push(
          `Moved "${object.name}"${op.anchor && op.anchor !== 'none' ? ` near the ${op.anchor.replace('-', ' ')}` : ''}.`,
        );
        break;
      }
      case 'resize_object': {
        const idx = findObjectIndex(doc, op.targetName);
        if (idx < 0) {
          changeSummary.push(
            `Could not find an object named "${op.targetName}" to resize.`,
          );
          break;
        }
        const object = doc.objects[idx];
        const factor = op.scaleFactor ?? 1;
        const widthMm =
          op.widthMm ?? Math.max(50, Math.round(object.widthMm * factor));
        const depthMm =
          op.lengthMm ?? Math.max(50, Math.round(object.depthMm * factor));
        doc.objects[idx] = { ...object, widthMm, depthMm };
        changeSummary.push(`Resized "${object.name}".`);
        break;
      }
      case 'recolor_object': {
        const idx = findObjectIndex(doc, op.targetName);
        if (idx < 0 || !op.colorHex) {
          changeSummary.push(`Could not recolor "${op.targetName}".`);
          break;
        }
        doc.objects[idx] = { ...doc.objects[idx], color: op.colorHex };
        changeSummary.push(`Changed the color of "${doc.objects[idx].name}".`);
        break;
      }
      case 'add_object': {
        const asset = matchCatalogAsset(op.targetName, catalog);
        if (!asset) {
          changeSummary.push(
            `Could not find a catalog asset matching "${op.targetName}".`,
          );
          break;
        }
        const floor = doc.floors[0];
        const room = largestRoom(doc);
        const at = room ? polygonCentroid(room.polygon) : { x: 0, y: 0 };
        const jitter = doc.objects.length * 80;
        const newObject: SceneObject = {
          id: `ai-add-${doc.objects.length}-${Date.now().toString(36)}`,
          floorId: room?.floorId ?? floor?.id ?? 'floor-ground',
          assetId: asset.id,
          name: asset.name,
          x: Math.round(at.x + jitter),
          y: Math.round(at.y + jitter),
          rotationDeg: 0,
          widthMm: asset.defaultWidthMm,
          depthMm: asset.defaultDepthMm,
          color: asset.color,
          constructionDay: DEFAULT_OBJECT_CONSTRUCTION_DAY,
        };
        doc = { ...doc, objects: [...doc.objects, newObject] };
        changeSummary.push(`Added "${asset.name}".`);
        break;
      }
      case 'remove_object': {
        const idx = findObjectIndex(doc, op.targetName);
        if (idx < 0) {
          changeSummary.push(
            `Could not find an object named "${op.targetName}" to remove.`,
          );
          break;
        }
        const removedName = doc.objects[idx].name;
        doc = { ...doc, objects: doc.objects.filter((_, i) => i !== idx) };
        changeSummary.push(`Removed "${removedName}".`);
        break;
      }
      case 'rename_room': {
        const idx = findRoomIndex(doc, op.targetName);
        if (idx < 0 || !op.newName) {
          changeSummary.push(`Could not rename room "${op.targetName}".`);
          break;
        }
        const oldName = doc.rooms[idx].name;
        doc.rooms[idx] = { ...doc.rooms[idx], name: op.newName };
        changeSummary.push(`Renamed room "${oldName}" to "${op.newName}".`);
        break;
      }
      case 'resize_room': {
        const idx = findRoomIndex(doc, op.targetName);
        if (idx < 0 || !op.widthMm || !op.lengthMm) {
          changeSummary.push(`Could not resize room "${op.targetName}".`);
          break;
        }
        const room = doc.rooms[idx];
        const { walls: newWalls, polygon } = rebuildRoomWalls(
          doc,
          room,
          op.widthMm,
          op.lengthMm,
        );
        const newWallsById = new Map(newWalls.map((w) => [w.id, w]));
        doc = {
          ...doc,
          walls: doc.walls.map((w) => newWallsById.get(w.id) ?? w),
          rooms: doc.rooms.map((r, i) =>
            i === idx
              ? { ...r, polygon, wallIds: newWalls.map((w) => w.id) }
              : r,
          ),
        };
        changeSummary.push(`Resized room "${room.name}".`);
        break;
      }
      case 'set_construction_day': {
        if (op.constructionDay == null) {
          changeSummary.push(
            `Could not set construction day for "${op.targetName}" (no day provided).`,
          );
          break;
        }
        const objIdx = findObjectIndex(doc, op.targetName);
        if (objIdx >= 0) {
          doc.objects[objIdx] = {
            ...doc.objects[objIdx],
            constructionDay: op.constructionDay,
          };
          changeSummary.push(
            `Set construction day of "${doc.objects[objIdx].name}" to ${op.constructionDay}.`,
          );
          break;
        }
        const roomIdx = findRoomIndex(doc, op.targetName);
        if (roomIdx >= 0) {
          doc.rooms[roomIdx] = {
            ...doc.rooms[roomIdx],
            constructionDay: op.constructionDay,
          };
          changeSummary.push(
            `Set construction day of room "${doc.rooms[roomIdx].name}" to ${op.constructionDay}.`,
          );
          break;
        }
        changeSummary.push(
          `Could not find "${op.targetName}" to set its construction day.`,
        );
        break;
      }
      default:
        changeSummary.push(`Unrecognized operation, skipped.`);
    }
  }

  if (ops.length === 0) {
    changeSummary.push('No changes proposed.');
  }

  return { document: doc, changeSummary };
}
