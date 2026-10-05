import { buildDocumentFromPlan } from './layout-builder';
import type {
  AiCatalogAsset,
  ProposedLayoutPlan,
} from '../providers/ai-provider.interface';

const catalog: AiCatalogAsset[] = [
  {
    id: 'asset-door',
    name: 'Single Door',
    category: 'DOOR',
    defaultWidthMm: 900,
    defaultDepthMm: 50,
    defaultHeightMm: 2100,
    color: '#8b5e3c',
  },
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
    id: 'asset-bed',
    name: 'Double Bed',
    category: 'FURNITURE',
    defaultWidthMm: 1500,
    defaultDepthMm: 2000,
    defaultHeightMm: 500,
    color: '#c9a876',
  },
];

describe('buildDocumentFromPlan', () => {
  it('builds one 4-wall room per plan entry, each closed and non-degenerate', () => {
    const plan: ProposedLayoutPlan = {
      rooms: [
        {
          name: 'Living Room',
          kind: 'living',
          widthMm: 4000,
          lengthMm: 3500,
          furniture: ['sofa'],
        },
        {
          name: 'Bedroom',
          kind: 'bedroom',
          widthMm: 3500,
          lengthMm: 3000,
          furniture: ['double bed'],
        },
      ],
      notes: 'test plan',
    };

    const doc = buildDocumentFromPlan(plan, catalog);

    expect(doc.rooms).toHaveLength(2);
    expect(doc.walls).toHaveLength(8); // 4 walls per room
    for (const room of doc.rooms) {
      expect(room.wallIds).toHaveLength(4);
      expect(new Set(room.wallIds).size).toBe(4); // no duplicate wall ids
      expect(room.polygon).toHaveLength(4);
    }
  });

  it('gives each room the exact size the plan specified', () => {
    const plan: ProposedLayoutPlan = {
      rooms: [
        {
          name: 'Kitchen',
          kind: 'kitchen',
          widthMm: 3000,
          lengthMm: 2500,
          furniture: [],
        },
      ],
      notes: '',
    };
    const doc = buildDocumentFromPlan(plan, catalog);
    const xs = doc.rooms[0].polygon.map((p) => p.x);
    const ys = doc.rooms[0].polygon.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBe(3000);
    expect(Math.max(...ys) - Math.min(...ys)).toBe(2500);
  });

  it('places one door per room when a DOOR asset exists in the catalog', () => {
    const plan: ProposedLayoutPlan = {
      rooms: [
        {
          name: 'Room A',
          kind: 'other',
          widthMm: 3000,
          lengthMm: 3000,
          furniture: [],
        },
      ],
      notes: '',
    };
    const doc = buildDocumentFromPlan(plan, catalog);
    expect(doc.openings).toHaveLength(1);
    expect(doc.openings[0].type).toBe('DOOR');
    expect(doc.openings[0].assetId).toBe('asset-door');
  });

  it('omits doors entirely when the catalog has no DOOR asset', () => {
    const plan: ProposedLayoutPlan = {
      rooms: [
        {
          name: 'Room A',
          kind: 'other',
          widthMm: 3000,
          lengthMm: 3000,
          furniture: [],
        },
      ],
      notes: '',
    };
    const doorlessCatalog = catalog.filter((a) => a.category !== 'DOOR');
    const doc = buildDocumentFromPlan(plan, doorlessCatalog);
    expect(doc.openings).toHaveLength(0);
  });

  it('matches furniture keywords to catalog assets and places them inside the room bounds', () => {
    const plan: ProposedLayoutPlan = {
      rooms: [
        {
          name: 'Living Room',
          kind: 'living',
          widthMm: 4000,
          lengthMm: 4000,
          furniture: ['sofa', 'nonexistent-item'],
        },
      ],
      notes: '',
    };
    const doc = buildDocumentFromPlan(plan, catalog);
    // Only the matched keyword becomes an object; the unmatched one is silently skipped.
    expect(doc.objects).toHaveLength(1);
    const sofa = doc.objects[0];
    expect(sofa.assetId).toBe('asset-sofa');
    expect(sofa.x).toBeGreaterThanOrEqual(0);
    expect(sofa.x).toBeLessThanOrEqual(4000);
    expect(sofa.y).toBeGreaterThanOrEqual(0);
    expect(sofa.y).toBeLessThanOrEqual(4000);
  });

  it('lays out multiple rooms without overlapping bounding boxes', () => {
    const plan: ProposedLayoutPlan = {
      rooms: [
        {
          name: 'A',
          kind: 'other',
          widthMm: 4000,
          lengthMm: 3000,
          furniture: [],
        },
        {
          name: 'B',
          kind: 'other',
          widthMm: 4000,
          lengthMm: 3000,
          furniture: [],
        },
        {
          name: 'C',
          kind: 'other',
          widthMm: 4000,
          lengthMm: 3000,
          furniture: [],
        },
      ],
      notes: '',
    };
    const doc = buildDocumentFromPlan(plan, catalog);
    const bounds = doc.rooms.map((r) => {
      const xs = r.polygon.map((p) => p.x);
      const ys = r.polygon.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
      };
    });
    function overlaps(
      a: (typeof bounds)[number],
      b: (typeof bounds)[number],
    ): boolean {
      return (
        a.minX < b.maxX && a.maxX > b.minX && a.minY < b.maxY && a.maxY > b.minY
      );
    }
    for (let i = 0; i < bounds.length; i++) {
      for (let j = i + 1; j < bounds.length; j++) {
        expect(overlaps(bounds[i], bounds[j])).toBe(false);
      }
    }
  });
});
