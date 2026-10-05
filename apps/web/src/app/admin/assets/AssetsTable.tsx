'use client';

import { useState, useTransition } from 'react';
import { ASSET_CATEGORY_LABELS, type Asset } from '@/lib/editor/asset-types';
import { setAssetActiveAction, updateAssetAction } from './actions';

export function AssetsTable({ assets }: { assets: Asset[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-3 py-2">Thumbnail</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">W × D × H (mm)</th>
            <th className="px-3 py-2">Color</th>
            <th className="px-3 py-2">Price</th>
            <th className="px-3 py-2">Vendor link</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {assets.map((asset) => (
            <AssetRow key={asset.id} asset={asset} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AssetRow({ asset }: { asset: Asset }) {
  const [name, setName] = useState(asset.name);
  const [width, setWidth] = useState(asset.defaultWidthMm);
  const [depth, setDepth] = useState(asset.defaultDepthMm);
  const [height, setHeight] = useState(asset.defaultHeightMm);
  const [color, setColor] = useState(asset.color);
  const [priceDollars, setPriceDollars] = useState(asset.priceCents != null ? (asset.priceCents / 100).toFixed(2) : '');
  const [vendorName, setVendorName] = useState(asset.vendorName ?? '');
  const [vendorUrl, setVendorUrl] = useState(asset.vendorUrl ?? '');
  const [pending, startTransition] = useTransition();

  const dirty =
    name !== asset.name ||
    width !== asset.defaultWidthMm ||
    depth !== asset.defaultDepthMm ||
    height !== asset.defaultHeightMm ||
    color !== asset.color ||
    priceDollars !== (asset.priceCents != null ? (asset.priceCents / 100).toFixed(2) : '') ||
    vendorName !== (asset.vendorName ?? '') ||
    vendorUrl !== (asset.vendorUrl ?? '');

  function save() {
    const parsedPrice = parseFloat(priceDollars);
    startTransition(() => {
      updateAssetAction(asset.id, {
        name,
        defaultWidthMm: width,
        defaultDepthMm: depth,
        defaultHeightMm: height,
        color,
        priceCents: Number.isFinite(parsedPrice) ? Math.round(parsedPrice * 100) : undefined,
        vendorName: vendorName.trim() || undefined,
        vendorUrl: vendorUrl.trim() || undefined,
      });
    });
  }

  function toggleActive() {
    startTransition(() => {
      setAssetActiveAction(asset.id, !asset.isActive);
    });
  }

  return (
    <tr className={`border-b border-neutral-100 ${asset.isActive ? '' : 'opacity-50'}`}>
      <td className="px-3 py-2">
        {asset.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived URL; not a static asset next/image can cache
          <img src={asset.thumbnailUrl} alt={asset.name} className="h-10 w-10 rounded object-cover" />
        ) : (
          <div className="h-10 w-10 rounded" style={{ backgroundColor: asset.color }} />
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-32 rounded border border-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-neutral-400"
        />
      </td>
      <td className="px-3 py-2 text-neutral-500">{ASSET_CATEGORY_LABELS[asset.category]}</td>
      <td className="px-3 py-2">
        <div className="flex gap-1">
          {[
            [width, setWidth] as const,
            [depth, setDepth] as const,
            [height, setHeight] as const,
          ].map(([value, setter], i) => (
            <input
              key={i}
              type="number"
              value={value}
              onChange={(e) => setter(Number(e.target.value))}
              className="w-16 rounded border border-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-neutral-400"
            />
          ))}
        </div>
      </td>
      <td className="px-3 py-2">
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-7 w-10" />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          <span className="text-neutral-400">$</span>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="—"
            value={priceDollars}
            onChange={(e) => setPriceDollars(e.target.value)}
            className="w-20 rounded border border-transparent px-1 py-0.5 hover:border-neutral-300 focus:border-neutral-400"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="flex flex-col gap-1">
          <input
            value={vendorName}
            onChange={(e) => setVendorName(e.target.value)}
            placeholder="Vendor"
            className="w-24 rounded border border-transparent px-1 py-0.5 text-xs hover:border-neutral-300 focus:border-neutral-400"
          />
          <input
            value={vendorUrl}
            onChange={(e) => setVendorUrl(e.target.value)}
            placeholder="https://…"
            className="w-32 rounded border border-transparent px-1 py-0.5 text-xs hover:border-neutral-300 focus:border-neutral-400"
          />
        </div>
      </td>
      <td className="px-3 py-2 text-xs">
        <span className={asset.isActive ? 'text-emerald-600' : 'text-neutral-400'}>
          {asset.isActive ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-3 py-2">
        <div className="flex gap-2">
          {dirty && (
            <button onClick={save} disabled={pending} className="text-xs font-medium text-blue-600 disabled:opacity-50">
              Save
            </button>
          )}
          <button onClick={toggleActive} disabled={pending} className="text-xs text-neutral-500 disabled:opacity-50">
            {asset.isActive ? 'Deactivate' : 'Reactivate'}
          </button>
        </div>
      </td>
    </tr>
  );
}
