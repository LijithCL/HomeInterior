'use client';

import { useMemo, useState } from 'react';
import type { Asset, AssetCategory } from '@/lib/editor/asset-types';
import { ASSET_CATEGORY_LABELS } from '@/lib/editor/asset-types';
import { AssetIcon } from './asset-icons';

interface AssetSidebarProps {
  assets: Asset[];
}

const CATEGORY_ORDER: AssetCategory[] = [
  'DOOR',
  'WINDOW',
  'FURNITURE',
  'KITCHEN',
  'BATHROOM',
  'ELECTRICAL',
  'DECORATION',
  'EXTERIOR',
];

export function AssetSidebar({ assets }: AssetSidebarProps) {
  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter((cat) => assets.some((a) => a.category === cat)),
    [assets],
  );
  const [activeCategory, setActiveCategory] = useState<AssetCategory>(availableCategories[0] ?? 'FURNITURE');
  const [search, setSearch] = useState('');

  // A non-empty search looks across every category — browsing by tab only
  // applies once the search box is cleared again.
  const visibleAssets = search.trim()
    ? assets.filter((a) => a.name.toLowerCase().includes(search.trim().toLowerCase()))
    : assets.filter((a) => a.category === activeCategory);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-neutral-200 bg-white">
      <div className="border-b border-neutral-200 p-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assets…"
          className="w-full rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </div>

      {!search.trim() && (
        <div className="flex flex-wrap gap-1 border-b border-neutral-200 p-2">
          {availableCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded px-2 py-1 text-xs font-medium ${
                activeCategory === cat
                  ? 'bg-neutral-900 text-white'
                  : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
              }`}
            >
              {ASSET_CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2">
        <p className="mb-2 px-1 text-xs text-neutral-400">Drag an item onto the canvas</p>
        <div className="grid grid-cols-2 gap-2">
          {visibleAssets.map((asset) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-asset', JSON.stringify(asset));
                e.dataTransfer.effectAllowed = 'copy';
              }}
              className="flex cursor-grab flex-col items-center gap-1 rounded-md border border-neutral-200 p-2 text-center hover:border-neutral-400"
              title={`${asset.defaultWidthMm} × ${asset.defaultDepthMm} mm`}
            >
              {asset.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; not a static asset next/image can cache
                <img src={asset.thumbnailUrl} alt={asset.name} className="h-10 w-10 rounded-sm object-cover" />
              ) : (
                <AssetIcon asset={asset} />
              )}
              <span className="text-xs leading-tight text-neutral-700">{asset.name}</span>
            </div>
          ))}
          {visibleAssets.length === 0 && (
            <p className="col-span-2 text-xs text-neutral-400">
              {search.trim() ? 'No assets match your search.' : 'No assets in this category yet.'}
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
