import { describe, expect, it } from 'vitest';
import {
  buildRectRoomWalls,
  createEmptyDocument,
  floorStackOffsetMm,
  migrateDocument,
  pointAlongWall,
  polygonAreaM2,
  polygonBounds,
  polygonCentroid,
  sanitizeDocument,
  wallAngleRad,
  wallLengthMm,
  type DesignDocument,
  type Wall,
} from './document';

describe('migrateDocument', () => {
  it('leaves an already-v2 document untouched', () => {
    const doc = createEmptyDocument();
    expect(migrateDocument(doc)).toEqual(doc);
  });

  it('wraps a v1 document (no floors array) into a single Ground Floor', () => {
    const v1 = {
      walls: [{ id: 'w1', start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thicknessMm: 150, heightMm: 2700 }],
      rooms: [],
      objects: [{ id: 'o1', assetId: 'a1', name: 'Chair', x: 0, y: 0, rotationDeg: 0, widthMm: 400, depthMm: 400, color: '#fff' }],
      openings: [],
    };
    const migrated = migrateDocument(v1);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.floors).toHaveLength(1);
    const floorId = migrated.floors[0].id;
    expect(migrated.walls[0].floorId).toBe(floorId);
    expect(migrated.objects[0].floorId).toBe(floorId);
  });

  it('treats a v2 document with an empty floors array as needing migration too', () => {
    const malformed = { schemaVersion: 2, floors: [], walls: [], rooms: [], objects: [], openings: [] };
    const migrated = migrateDocument(malformed);
    expect(migrated.floors.length).toBeGreaterThan(0);
  });
});

describe('sanitizeDocument', () => {
  it('repairs NaN wall coordinates and non-finite thickness/height', () => {
    const doc: DesignDocument = {
      ...createEmptyDocument(),
      walls: [
        {
          id: 'w1',
          floorId: 'floor-ground',
          start: { x: NaN, y: 0 },
          end: { x: 100, y: NaN },
          thicknessMm: NaN,
          heightMm: NaN,
          constructionDay: NaN,
        },
      ],
    };
    const sanitized = sanitizeDocument(doc);
    const wall = sanitized.walls[0];
    expect(Number.isFinite(wall.start.x)).toBe(true);
    expect(Number.isFinite(wall.start.y)).toBe(true);
    expect(Number.isFinite(wall.end.x)).toBe(true);
    expect(Number.isFinite(wall.end.y)).toBe(true);
    expect(Number.isFinite(wall.thicknessMm)).toBe(true);
    expect(Number.isFinite(wall.heightMm)).toBe(true);
    expect(Number.isFinite(wall.constructionDay)).toBe(true);
  });

  it('drops rooms with a degenerate polygon (fewer than 3 points)', () => {
    const doc: DesignDocument = {
      ...createEmptyDocument(),
      rooms: [
        { id: 'r1', floorId: 'floor-ground', name: 'Bad', polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }], wallIds: [], constructionDay: 1 },
        {
          id: 'r2',
          floorId: 'floor-ground',
          name: 'Good',
          polygon: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: 1000 }],
          wallIds: [],
          constructionDay: 1,
        },
      ],
    };
    const sanitized = sanitizeDocument(doc);
    expect(sanitized.rooms).toHaveLength(1);
    expect(sanitized.rooms[0].id).toBe('r2');
  });

  it('reassigns any element referencing a nonexistent floorId to the first real floor', () => {
    const doc: DesignDocument = {
      ...createEmptyDocument(),
      objects: [
        { id: 'o1', floorId: 'floor-does-not-exist', assetId: 'a1', name: 'Lamp', x: 0, y: 0, rotationDeg: 0, widthMm: 300, depthMm: 300, color: '#fff', constructionDay: 100 },
      ],
    };
    const sanitized = sanitizeDocument(doc);
    expect(sanitized.objects[0].floorId).toBe(sanitized.floors[0].id);
  });
});

describe('buildRectRoomWalls', () => {
  it('builds exactly 4 walls forming a closed rectangle regardless of corner order given', () => {
    const ids = ['a', 'b', 'c', 'd'];
    let i = 0;
    const { walls, polygon } = buildRectRoomWalls({ x: 1000, y: 1000 }, { x: 0, y: 0 }, 150, 'floor-1', () => ids[i++]);
    expect(walls).toHaveLength(4);
    expect(polygon).toHaveLength(4);
    // Each wall's end connects to the next wall's start (closed loop).
    for (let idx = 0; idx < walls.length; idx++) {
      const next = walls[(idx + 1) % walls.length];
      expect(walls[idx].end).toEqual(next.start);
    }
    // Normalizes min/max regardless of which corner was passed first.
    const xs = polygon.map((p) => p.x);
    const ys = polygon.map((p) => p.y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(1000);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(1000);
  });
});

describe('wall geometry helpers', () => {
  const wall: Wall = { id: 'w1', floorId: 'f1', start: { x: 0, y: 0 }, end: { x: 3000, y: 4000 }, thicknessMm: 150, heightMm: 2700, constructionDay: 20 };

  it('wallLengthMm computes the Euclidean distance (3-4-5 triangle)', () => {
    expect(wallLengthMm(wall)).toBe(5000);
  });

  it('wallAngleRad computes the correct angle', () => {
    expect(wallAngleRad(wall)).toBeCloseTo(Math.atan2(4000, 3000));
  });

  it('pointAlongWall interpolates proportionally to offset', () => {
    const midpoint = pointAlongWall(wall, 2500); // half of 5000mm length
    expect(midpoint.x).toBeCloseTo(1500);
    expect(midpoint.y).toBeCloseTo(2000);
  });

  it('pointAlongWall does not divide by zero for a zero-length wall', () => {
    const degenerate: Wall = { ...wall, start: { x: 5, y: 5 }, end: { x: 5, y: 5 } };
    const point = pointAlongWall(degenerate, 100);
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  });
});

describe('polygon helpers', () => {
  const square = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: 2000 }, { x: 0, y: 2000 }];

  it('polygonAreaM2 converts mm^2 to m^2 correctly (2m x 2m = 4m^2)', () => {
    expect(polygonAreaM2(square)).toBe(4);
  });

  it('polygonBounds reports the correct width/height', () => {
    const bounds = polygonBounds(square);
    expect(bounds.widthMm).toBe(2000);
    expect(bounds.heightMm).toBe(2000);
  });

  it('polygonCentroid is the average of all points for a symmetric shape', () => {
    expect(polygonCentroid(square)).toEqual({ x: 1000, y: 1000 });
  });
});

describe('floorStackOffsetMm', () => {
  it('sums the heights of every floor below the target', () => {
    const floors = [
      { id: 'ground', name: 'Ground', levelIndex: 0, heightMm: 3000 },
      { id: 'first', name: 'First', levelIndex: 1, heightMm: 3200 },
      { id: 'second', name: 'Second', levelIndex: 2, heightMm: 2800 },
    ];
    expect(floorStackOffsetMm(floors, 'ground')).toBe(0);
    expect(floorStackOffsetMm(floors, 'first')).toBe(3000);
    expect(floorStackOffsetMm(floors, 'second')).toBe(3000 + 3200);
  });

  it('returns 0 for an unknown floor id', () => {
    expect(floorStackOffsetMm([{ id: 'ground', name: 'Ground', levelIndex: 0, heightMm: 3000 }], 'nonexistent')).toBe(0);
  });
});
