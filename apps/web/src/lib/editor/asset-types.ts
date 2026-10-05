export type AssetCategory =
  | 'DOOR'
  | 'WINDOW'
  | 'FURNITURE'
  | 'KITCHEN'
  | 'BATHROOM'
  | 'ELECTRICAL'
  | 'DECORATION'
  | 'EXTERIOR';

export interface Asset {
  id: string;
  category: AssetCategory;
  name: string;
  defaultWidthMm: number;
  defaultDepthMm: number;
  defaultHeightMm: number;
  color: string;
  thumbnailUrl: string | null;
  isActive: boolean;
  // Catalog price in USD cents, for the cost estimator; null for assets
  // without a price (excluded from the estimate rather than shown as free).
  priceCents: number | null;
  // A real product page an admin attached to this catalog entry (§
  // shoppable furniture) — not a live vendor search/integration.
  vendorName: string | null;
  vendorUrl: string | null;
}

// A wall-like exterior object (Boundary Wall, Hand Grill) — a straight run
// with a length/thickness that's more naturally edited by its two endpoints
// than by center/width/rotation, and that supports the Wall-style
// start/end height & elevation slope. Shared by Scene3D.tsx (rendering +
// gizmo behavior) and PropertiesPanel.tsx (which fields to show) so the two
// never drift out of sync — a name/category combination that one treats as
// wall-like and the other doesn't would show the Start/End/slope UI for an
// object that renders as a plain centered box, or vice versa.
export function isWallLikeAssetName(name: string, category: AssetCategory | undefined): boolean {
  const n = name.toLowerCase();
  return (n.includes('wall') || n.includes('grill') || n.includes('railing')) && category === 'EXTERIOR';
}

export const ASSET_CATEGORY_LABELS: Record<AssetCategory, string> = {
  DOOR: 'Doors',
  WINDOW: 'Windows',
  FURNITURE: 'Furniture',
  KITCHEN: 'Kitchen',
  BATHROOM: 'Bathroom',
  ELECTRICAL: 'Electrical',
  DECORATION: 'Decoration',
  EXTERIOR: 'Exterior',
};
