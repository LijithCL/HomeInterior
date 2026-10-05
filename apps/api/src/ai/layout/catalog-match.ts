import type { AiCatalogAsset } from '../providers/ai-provider.interface';

// Matches a free-text furniture keyword (from the AI's proposal) against the
// real asset catalog by name, since the provider never sees our internal
// asset IDs. Best-effort substring matching in both directions, falling
// back to a per-word match.
export function matchCatalogAsset(
  keyword: string,
  catalog: AiCatalogAsset[],
): AiCatalogAsset | undefined {
  const k = keyword.trim().toLowerCase();
  if (!k) return undefined;

  const exact = catalog.find((a) => a.name.toLowerCase() === k);
  if (exact) return exact;

  const substring = catalog.find(
    (a) => a.name.toLowerCase().includes(k) || k.includes(a.name.toLowerCase()),
  );
  if (substring) return substring;

  const words = k.split(/\s+/).filter(Boolean);
  return catalog.find((a) => {
    const nameWords = a.name.toLowerCase().split(/\s+/);
    return words.some((w) => nameWords.includes(w));
  });
}
