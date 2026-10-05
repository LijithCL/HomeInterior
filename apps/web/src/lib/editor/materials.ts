// Built-in textured finishes for walls/floors — procedurally drawn, so there's
// no external image asset pipeline to manage. Each is rendered once into a
// small tileable canvas and cached; callers repeat it (Konva fillPattern* in
// 2D, THREE.RepeatWrapping in 3D) rather than stretching a single copy.

export interface MaterialDef {
  id: string;
  label: string;
  baseColor: string;
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
  // USD cents per m², for the cost estimator — a rough, editable-in-code
  // placeholder rate, same spirit as the seeded furniture prices.
  pricePerM2Cents: number;
}

// Fallback rates for a wall/room with no material chosen — flat paint and
// basic flooring, so the cost estimate still includes every surface.
export const DEFAULT_PAINT_PRICE_PER_M2_CENTS = 800;
export const DEFAULT_FLOORING_PRICE_PER_M2_CENTS = 1500;

const TILE_SIZE = 128;

export const MATERIALS: MaterialDef[] = [
  {
    id: 'wood-oak',
    label: 'Oak wood',
    baseColor: '#c9a06a',
    pricePerM2Cents: 2800,
    draw: (ctx, size) => {
      ctx.fillStyle = '#c9a06a';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(120,80,40,0.35)';
      ctx.lineWidth = 2;
      for (let y = 8; y < size; y += 16) {
        ctx.beginPath();
        ctx.moveTo(0, y + Math.sin(y) * 2);
        ctx.bezierCurveTo(size * 0.3, y + 4, size * 0.7, y - 4, size, y);
        ctx.stroke();
      }
    },
  },
  {
    id: 'wood-walnut',
    label: 'Walnut wood',
    baseColor: '#6b4a35',
    pricePerM2Cents: 3600,
    draw: (ctx, size) => {
      ctx.fillStyle = '#6b4a35';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(40,20,10,0.4)';
      ctx.lineWidth = 2;
      for (let y = 8; y < size; y += 14) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.bezierCurveTo(size * 0.3, y - 5, size * 0.7, y + 5, size, y);
        ctx.stroke();
      }
    },
  },
  {
    id: 'tile-white',
    label: 'White tile',
    baseColor: '#f1efe9',
    pricePerM2Cents: 2200,
    draw: (ctx, size) => {
      ctx.fillStyle = '#f1efe9';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 3;
      ctx.strokeRect(1.5, 1.5, size - 3, size - 3);
    },
  },
  {
    id: 'tile-checker',
    label: 'Checker tile',
    baseColor: '#dedede',
    pricePerM2Cents: 2500,
    draw: (ctx, size) => {
      const half = size / 2;
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#333333';
      ctx.fillRect(0, 0, half, half);
      ctx.fillRect(half, half, half, half);
    },
  },
  {
    id: 'brick-red',
    label: 'Red brick',
    baseColor: '#9c4a3a',
    pricePerM2Cents: 3200,
    draw: (ctx, size) => {
      ctx.fillStyle = '#8a4130';
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      const rowH = size / 4;
      for (let row = 0; row < 4; row++) {
        const y = row * rowH;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(size, y);
        ctx.stroke();
        const offset = row % 2 === 0 ? 0 : size / 4;
        for (let x = offset; x < size; x += size / 2) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, y + rowH);
          ctx.stroke();
        }
      }
    },
  },
  {
    id: 'carpet-gray',
    label: 'Gray carpet',
    baseColor: '#9a978f',
    pricePerM2Cents: 1400,
    draw: (ctx, size) => {
      ctx.fillStyle = '#9a978f';
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 260; i++) {
        const x = Math.round((i * 53) % size);
        const y = Math.round((i * 97) % size);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';
        ctx.fillRect(x, y, 2, 2);
      }
    },
  },
];

const canvasCache = new Map<string, HTMLCanvasElement>();

// Lazy + cached: canvas drawing needs the DOM, so this can only ever run
// client-side, and there's no reason to redraw the same tile twice.
export function getMaterialCanvas(materialId: string): HTMLCanvasElement | null {
  const cached = canvasCache.get(materialId);
  if (cached) return cached;

  const material = MATERIALS.find((m) => m.id === materialId);
  if (!material || typeof document === 'undefined') return null;

  const canvas = document.createElement('canvas');
  canvas.width = TILE_SIZE;
  canvas.height = TILE_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  material.draw(ctx, TILE_SIZE);
  canvasCache.set(materialId, canvas);
  return canvas;
}

export function getMaterial(materialId: string | undefined | null): MaterialDef | undefined {
  if (!materialId) return undefined;
  return MATERIALS.find((m) => m.id === materialId);
}

// For swatch buttons in the properties panel — a data URL is easy to drop
// straight into a CSS `background-image`, unlike the canvas element itself.
export function getMaterialThumbnailUrl(materialId: string): string | null {
  const canvas = getMaterialCanvas(materialId);
  return canvas ? canvas.toDataURL() : null;
}
