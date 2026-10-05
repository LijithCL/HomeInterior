import { polygonBounds, type Point, type Room, type SceneObject } from './document';

const MARGIN_MM = 250;
const GAP_MM = 150;

// Standard ray-casting point-in-polygon test. Rooms today are always
// axis-aligned rectangles (see addRectRoom/buildRectRoomWalls), but this
// doesn't assume that — it only assumes furniture centers, not footprints,
// decide room membership, same simplification the layout-builder's own
// placement logic makes.
function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function objectsInRoom(room: Room, objects: SceneObject[]): SceneObject[] {
  return objects.filter((o) => o.floorId === room.floorId && pointInPolygon({ x: o.x, y: o.y }, room.polygon));
}

export interface ArrangedObject {
  id: string;
  x: number;
  y: number;
  rotationDeg: number;
}

// Deterministic row-packing against the room's own bounds, reusing each
// object's already-set widthMm/depthMm — same row-flow shape as
// layout-builder.ts's placeFurniture(), just driven by objects that already
// exist instead of a catalog lookup. Rotation resets to 0 so the result is
// predictable; Undo is one click away if that's not what someone wanted.
export function autoArrangeRoom(room: Room, objects: SceneObject[]): ArrangedObject[] {
  const bounds = polygonBounds(room.polygon);
  const minX = bounds.minX + MARGIN_MM;
  const minY = bounds.minY + MARGIN_MM;
  const maxX = bounds.maxX - MARGIN_MM;

  let cursorX = minX;
  let cursorY = minY;
  let rowDepth = 0;
  const result: ArrangedObject[] = [];

  for (const object of objects) {
    if (cursorX + object.widthMm > maxX && cursorX > minX) {
      cursorX = minX;
      cursorY += rowDepth + GAP_MM;
      rowDepth = 0;
    }
    result.push({
      id: object.id,
      x: cursorX + object.widthMm / 2,
      y: cursorY + object.depthMm / 2,
      rotationDeg: 0,
    });
    cursorX += object.widthMm + GAP_MM;
    rowDepth = Math.max(rowDepth, object.depthMm);
  }
  return result;
}
