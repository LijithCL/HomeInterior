import { applyEditOps } from './edit-ops';
import type {
  AiCatalogAsset,
  EditOp,
} from '../providers/ai-provider.interface';
import type { DesignDocument } from '../document-types';

const catalog: AiCatalogAsset[] = [
  {
    id: 'asset-sofa',
    name: 'Sofa (3-seater)',
    category: 'FURNITURE',
    defaultWidthMm: 2000,
    defaultDepthMm: 900,
    defaultHeightMm: 800,
    color: '#8b5e3c',
  },
  {
    id: 'asset-rug',
    name: 'Area Rug',
    category: 'DECORATION',
    defaultWidthMm: 1800,
    defaultDepthMm: 1200,
    defaultHeightMm: 20,
    color: '#c9a876',
  },
];

// A single rectangular room, one door, one window, one sofa — enough
// geometry for every op to have something real to anchor against.
function baseDocument(): DesignDocument {
  return {
    schemaVersion: 2,
    floors: [
      { id: 'floor-1', name: 'Ground Floor', levelIndex: 0, heightMm: 3000 },
    ],
    walls: [
      {
        id: 'wall-top',
        floorId: 'floor-1',
        start: { x: 0, y: 0 },
        end: { x: 4000, y: 0 },
        thicknessMm: 150,
        heightMm: 2700,
        constructionDay: 20,
      },
      {
        id: 'wall-right',
        floorId: 'floor-1',
        start: { x: 4000, y: 0 },
        end: { x: 4000, y: 4000 },
        thicknessMm: 150,
        heightMm: 2700,
        constructionDay: 20,
      },
      {
        id: 'wall-bottom',
        floorId: 'floor-1',
        start: { x: 4000, y: 4000 },
        end: { x: 0, y: 4000 },
        thicknessMm: 150,
        heightMm: 2700,
        constructionDay: 20,
      },
      {
        id: 'wall-left',
        floorId: 'floor-1',
        start: { x: 0, y: 4000 },
        end: { x: 0, y: 0 },
        thicknessMm: 150,
        heightMm: 2700,
        constructionDay: 20,
      },
    ],
    openings: [
      {
        id: 'door-1',
        wallId: 'wall-bottom',
        type: 'DOOR',
        assetId: 'asset-door',
        offsetMm: 2000,
        widthMm: 900,
        heightMm: 2100,
        sillHeightMm: 0,
        constructionDay: 60,
      },
      {
        id: 'window-1',
        wallId: 'wall-top',
        type: 'WINDOW',
        assetId: 'asset-window',
        offsetMm: 2000,
        widthMm: 1200,
        heightMm: 1200,
        sillHeightMm: 900,
        constructionDay: 60,
      },
    ],
    rooms: [
      {
        id: 'room-1',
        floorId: 'floor-1',
        name: 'Living Room',
        polygon: [
          { x: 0, y: 0 },
          { x: 4000, y: 0 },
          { x: 4000, y: 4000 },
          { x: 0, y: 4000 },
        ],
        wallIds: ['wall-top', 'wall-right', 'wall-bottom', 'wall-left'],
        constructionDay: 1,
      },
    ],
    objects: [
      {
        id: 'sofa-1',
        floorId: 'floor-1',
        assetId: 'asset-sofa',
        name: 'Sofa (3-seater)',
        x: 2000,
        y: 2000,
        rotationDeg: 0,
        widthMm: 2000,
        depthMm: 900,
        color: '#8b5e3c',
        constructionDay: 100,
      },
    ],
  };
}

function op(
  partial: Partial<EditOp> & Pick<EditOp, 'op' | 'targetName'>,
): EditOp {
  return partial;
}

describe('applyEditOps', () => {
  it('never mutates the input document', () => {
    const doc = baseDocument();
    const snapshot = JSON.stringify(doc);
    applyEditOps(
      doc,
      [op({ op: 'remove_object', targetName: 'sofa' })],
      catalog,
    );
    expect(JSON.stringify(doc)).toBe(snapshot);
  });

  it('moves an object near the window, landing inside the room', () => {
    const doc = baseDocument();
    const { document, changeSummary } = applyEditOps(
      doc,
      [op({ op: 'move_object', targetName: 'sofa', anchor: 'window' })],
      catalog,
    );
    const sofa = document.objects.find((o) => o.id === 'sofa-1')!;
    // Window is on the top wall (y=0). Offset inward = thickness/2 (75) +
    // footprint/2 (max(2000,900)/2 = 1000) + 50 fixed margin = 1125.
    expect(sofa.x).toBe(2000);
    expect(sofa.y).toBe(1125);
    expect(changeSummary.join(' ')).toMatch(
      /Moved "Sofa \(3-seater\)" near the window/,
    );
  });

  it('moves an object near the door', () => {
    const doc = baseDocument();
    const { document } = applyEditOps(
      doc,
      [op({ op: 'move_object', targetName: 'sofa', anchor: 'door' })],
      catalog,
    );
    const sofa = document.objects.find((o) => o.id === 'sofa-1')!;
    // Door is on the bottom wall (y=4000); same 1125mm inward offset, but
    // toward the room's interior means subtracting instead of adding.
    expect(sofa.y).toBe(4000 - 1125);
  });

  it('resizes an object by a scale factor', () => {
    const doc = baseDocument();
    const { document } = applyEditOps(
      doc,
      [op({ op: 'resize_object', targetName: 'sofa', scaleFactor: 1.5 })],
      catalog,
    );
    const sofa = document.objects.find((o) => o.id === 'sofa-1')!;
    expect(sofa.widthMm).toBe(3000);
    expect(sofa.depthMm).toBe(1350);
  });

  it('recolors an object', () => {
    const doc = baseDocument();
    const { document } = applyEditOps(
      doc,
      [op({ op: 'recolor_object', targetName: 'sofa', colorHex: '#3b82f6' })],
      catalog,
    );
    expect(document.objects.find((o) => o.id === 'sofa-1')!.color).toBe(
      '#3b82f6',
    );
  });

  it('adds a new object matched from the catalog', () => {
    const doc = baseDocument();
    const { document, changeSummary } = applyEditOps(
      doc,
      [op({ op: 'add_object', targetName: 'rug', anchor: 'room-center' })],
      catalog,
    );
    expect(document.objects).toHaveLength(2);
    const rug = document.objects.find((o) => o.assetId === 'asset-rug');
    expect(rug).toBeDefined();
    expect(rug!.name).toBe('Area Rug');
    expect(changeSummary.join(' ')).toMatch(/Added "Area Rug"/);
  });

  it('reports a graceful failure when add_object has no catalog match', () => {
    const doc = baseDocument();
    const { document, changeSummary } = applyEditOps(
      doc,
      [op({ op: 'add_object', targetName: 'nonexistent-thing' })],
      catalog,
    );
    expect(document.objects).toHaveLength(1);
    expect(changeSummary.join(' ')).toMatch(/Could not find a catalog asset/);
  });

  it('removes an object by name', () => {
    const doc = baseDocument();
    const { document } = applyEditOps(
      doc,
      [op({ op: 'remove_object', targetName: 'sofa' })],
      catalog,
    );
    expect(document.objects).toHaveLength(0);
  });

  it('renames a room', () => {
    const doc = baseDocument();
    const { document } = applyEditOps(
      doc,
      [op({ op: 'rename_room', targetName: 'Living', newName: 'Family Room' })],
      catalog,
    );
    expect(document.rooms[0].name).toBe('Family Room');
  });

  it('resizes a room and recycles its existing wall ids', () => {
    const doc = baseDocument();
    const originalWallIds = [...doc.rooms[0].wallIds].sort();
    const { document } = applyEditOps(
      doc,
      [
        op({
          op: 'resize_room',
          targetName: 'Living',
          widthMm: 5000,
          lengthMm: 3000,
        }),
      ],
      catalog,
    );
    const room = document.rooms[0];
    expect(room.wallIds).toHaveLength(4);
    expect([...room.wallIds].sort()).toEqual(originalWallIds);
    const widths = room.polygon.map((p) => p.x);
    expect(Math.max(...widths) - Math.min(...widths)).toBe(5000);
  });

  it('sets construction day on an object', () => {
    const doc = baseDocument();
    const { document } = applyEditOps(
      doc,
      [
        op({
          op: 'set_construction_day',
          targetName: 'sofa',
          constructionDay: 42,
        }),
      ],
      catalog,
    );
    expect(document.objects[0].constructionDay).toBe(42);
  });

  it('reports a graceful failure when the target does not exist', () => {
    const doc = baseDocument();
    const { changeSummary } = applyEditOps(
      doc,
      [
        op({
          op: 'move_object',
          targetName: 'nonexistent-thing',
          anchor: 'window',
        }),
      ],
      catalog,
    );
    expect(changeSummary.join(' ')).toMatch(
      /Could not find an object named "nonexistent-thing"/,
    );
  });

  it('reports "no changes" for an empty op list', () => {
    const doc = baseDocument();
    const { changeSummary } = applyEditOps(doc, [], catalog);
    expect(changeSummary).toEqual(['No changes proposed.']);
  });
});
