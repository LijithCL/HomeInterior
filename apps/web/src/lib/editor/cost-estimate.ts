import type { DesignDocument } from './document';
import { wallLengthMm, polygonAreaM2 } from './document';
import type { Asset } from './asset-types';
import {
  getMaterial,
  DEFAULT_PAINT_PRICE_PER_M2_CENTS,
  DEFAULT_FLOORING_PRICE_PER_M2_CENTS,
} from './materials';

export interface CostLineItem {
  label: string;
  quantityLabel: string;
  amountCents: number;
  vendorUrl?: string;
  vendorName?: string;
}

export interface CostEstimate {
  furnitureCents: number;
  wallFinishCents: number;
  floorFinishCents: number;
  totalCents: number;
  furnitureItems: CostLineItem[];
  wallItems: CostLineItem[];
  floorItems: CostLineItem[];
  // Objects placed in the design whose asset has no catalog price — surfaced
  // so the total is never silently understated without saying why.
  unpricedObjectCount: number;
}

// Deterministic, no-AI cost rollup: furniture priced from the asset catalog
// (apps/api prisma seed / admin-managed), walls/floors priced by area at
// either their chosen material's rate (lib/editor/materials.ts) or a flat
// paint/flooring default. Same "recompute directly from the live document"
// approach as the room-area / wall-length labels already shown in the
// editor — nothing here is stored, it's derived fresh every time.
export function estimateCost(document: DesignDocument, assets: Asset[]): CostEstimate {
  const assetsById = new Map(assets.map((a) => [a.id, a]));

  const furnitureGroups = new Map<
    string,
    { label: string; qty: number; unitCents: number; vendorUrl?: string; vendorName?: string }
  >();
  let unpricedObjectCount = 0;
  for (const object of document.objects) {
    const asset = assetsById.get(object.assetId);
    if (!asset || asset.priceCents == null) {
      unpricedObjectCount += 1;
      continue;
    }
    const key = `${asset.name}:${asset.priceCents}`;
    const existing = furnitureGroups.get(key);
    if (existing) existing.qty += 1;
    else
      furnitureGroups.set(key, {
        label: asset.name,
        qty: 1,
        unitCents: asset.priceCents,
        vendorUrl: asset.vendorUrl ?? undefined,
        vendorName: asset.vendorName ?? undefined,
      });
  }
  const furnitureItems: CostLineItem[] = [...furnitureGroups.values()].map(({ label, qty, unitCents, vendorUrl, vendorName }) => ({
    label,
    quantityLabel: `${qty} ×`,
    amountCents: qty * unitCents,
    vendorUrl,
    vendorName,
  }));
  const furnitureCents = furnitureItems.reduce((sum, item) => sum + item.amountCents, 0);

  const wallGroups = new Map<string, { areaM2: number; ratePerM2Cents: number }>();
  for (const wall of document.walls) {
    const material = getMaterial(wall.materialId);
    const rate = material?.pricePerM2Cents ?? DEFAULT_PAINT_PRICE_PER_M2_CENTS;
    const areaM2 = (wallLengthMm(wall) / 1000) * (wall.heightMm / 1000);
    const label = material ? material.label : 'Paint (unfinished walls)';
    const existing = wallGroups.get(label);
    if (existing) existing.areaM2 += areaM2;
    else wallGroups.set(label, { areaM2, ratePerM2Cents: rate });
  }
  const wallItems: CostLineItem[] = [...wallGroups.entries()].map(([label, { areaM2, ratePerM2Cents }]) => ({
    label,
    quantityLabel: `${areaM2.toFixed(1)} m²`,
    amountCents: Math.round(areaM2 * ratePerM2Cents),
  }));
  const wallFinishCents = wallItems.reduce((sum, item) => sum + item.amountCents, 0);

  const floorGroups = new Map<string, { areaM2: number; ratePerM2Cents: number }>();
  for (const room of document.rooms) {
    const material = getMaterial(room.floorMaterialId);
    const rate = material?.pricePerM2Cents ?? DEFAULT_FLOORING_PRICE_PER_M2_CENTS;
    const areaM2 = polygonAreaM2(room.polygon);
    const label = material ? material.label : 'Basic flooring';
    const existing = floorGroups.get(label);
    if (existing) existing.areaM2 += areaM2;
    else floorGroups.set(label, { areaM2, ratePerM2Cents: rate });
  }
  const floorItems: CostLineItem[] = [...floorGroups.entries()].map(([label, { areaM2, ratePerM2Cents }]) => ({
    label,
    quantityLabel: `${areaM2.toFixed(1)} m²`,
    amountCents: Math.round(areaM2 * ratePerM2Cents),
  }));
  const floorFinishCents = floorItems.reduce((sum, item) => sum + item.amountCents, 0);

  return {
    furnitureCents,
    wallFinishCents,
    floorFinishCents,
    totalCents: furnitureCents + wallFinishCents + floorFinishCents,
    furnitureItems,
    wallItems,
    floorItems,
    unpricedObjectCount,
  };
}
