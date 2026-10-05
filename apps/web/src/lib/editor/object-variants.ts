export interface ObjectVariant {
  id: string;
  label: string;
}

export const SOFA_VARIANTS: ObjectVariant[] = [
  { id: 'straight', label: 'Straight' },
  { id: 'l-shaped', label: 'L-shaped' },
  { id: 'loveseat', label: 'Loveseat' },
];

export const TABLE_VARIANTS: ObjectVariant[] = [
  { id: 'rectangular', label: 'Rectangular' },
  { id: 'round', label: 'Round' },
];

export const BED_VARIANTS: ObjectVariant[] = [
  { id: 'headboard', label: 'With headboard' },
  { id: 'platform', label: 'Platform (no headboard)' },
];

export const PILLAR_VARIANTS: ObjectVariant[] = [
  { id: 'round', label: 'Round' },
  { id: 'square', label: 'Square' },
];

// Only a few categories get real style variants (a genuinely different
// shape) — most catalog items don't have a meaningful "different shape"
// beyond what Width/Depth/Height/Color already cover. Matching mirrors
// CategoryObjectModel's own name-based dispatch in asset-models.tsx
// exactly, so the variant list shown here always corresponds to a shape
// that component actually knows how to render.
export function findVariantsForAsset(assetName: string): ObjectVariant[] | null {
  const n = assetName.toLowerCase();
  if (n.includes('sofa') || n.includes('armchair') || n.includes('recliner')) return SOFA_VARIANTS;
  if (n.includes('bed')) return BED_VARIANTS;
  if (n.includes('table') && !n.includes('nightstand') && !n.includes('tv table')) return TABLE_VARIANTS;
  if (n.includes('pillar') || n.includes('column')) return PILLAR_VARIANTS;
  return null;
}
