'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import { estimateCost, type CostLineItem } from '@/lib/editor/cost-estimate';
import type { Asset } from '@/lib/editor/asset-types';

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function Section({ title, items, totalCents }: { title: string; items: CostLineItem[]; totalCents: number }) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
        <span>{title}</span>
        <span>{formatUsd(totalCents)}</span>
      </div>
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between text-xs text-neutral-500">
          <span>
            {item.label} <span className="text-neutral-400">({item.quantityLabel})</span>
            {item.vendorUrl && (
              <>
                {' · '}
                <a
                  href={item.vendorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sage hover:underline"
                >
                  Shop{item.vendorName ? ` at ${item.vendorName}` : ''} ↗
                </a>
              </>
            )}
          </span>
          <span>{formatUsd(item.amountCents)}</span>
        </div>
      ))}
    </div>
  );
}

export function CostEstimatePanel({ assets }: { assets: Asset[] }) {
  const [open, setOpen] = useState(false);
  const document = useEditorStore((s) => s.document);
  const estimate = estimateCost(document, assets);

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
        Cost estimate
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            A rough estimate from catalog furniture prices and per-m² material rates — not a quote.
          </p>

          <div className="flex max-h-72 flex-col gap-3 overflow-y-auto">
            <Section title="Furniture" items={estimate.furnitureItems} totalCents={estimate.furnitureCents} />
            <Section title="Wall finish" items={estimate.wallItems} totalCents={estimate.wallFinishCents} />
            <Section title="Floor finish" items={estimate.floorItems} totalCents={estimate.floorFinishCents} />
            {estimate.furnitureItems.length === 0 && estimate.wallItems.length === 0 && estimate.floorItems.length === 0 && (
              <p className="text-xs text-neutral-400">Nothing to estimate yet.</p>
            )}
          </div>

          {estimate.unpricedObjectCount > 0 && (
            <p className="mt-2 text-xs text-amber-600">
              {estimate.unpricedObjectCount} placed item{estimate.unpricedObjectCount === 1 ? '' : 's'} have no catalog
              price and are excluded from the total.
            </p>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm font-semibold text-neutral-900">
            <span>Total</span>
            <span>{formatUsd(estimate.totalCents)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
