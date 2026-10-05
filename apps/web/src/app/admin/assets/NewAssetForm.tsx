'use client';

import { useActionState, useRef, useEffect } from 'react';
import { ASSET_CATEGORY_LABELS, type AssetCategory } from '@/lib/editor/asset-types';
import { createAssetAction, type AssetFormState } from './actions';

const CATEGORIES = Object.keys(ASSET_CATEGORY_LABELS) as AssetCategory[];
const initialState: AssetFormState = {};

export function NewAssetForm() {
  const [state, formAction, pending] = useActionState(createAssetAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="grid grid-cols-2 gap-3 rounded-lg border border-neutral-200 bg-white p-4 sm:grid-cols-4"
    >
      <h2 className="col-span-2 text-sm font-semibold text-neutral-900 sm:col-span-4">New asset</h2>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Name
        <input name="name" type="text" required className="rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Category
        <select name="category" required className="rounded border border-neutral-300 px-2 py-1.5 text-sm">
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {ASSET_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Width (mm)
        <input
          name="defaultWidthMm"
          type="number"
          min={1}
          required
          defaultValue={900}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Depth (mm)
        <input
          name="defaultDepthMm"
          type="number"
          min={1}
          required
          defaultValue={600}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Height (mm)
        <input
          name="defaultHeightMm"
          type="number"
          min={1}
          required
          defaultValue={800}
          className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Color
        <input name="color" type="color" defaultValue="#8B5E3C" className="h-9 w-full rounded border border-neutral-300" />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Price (USD, optional)
        <input name="priceDollars" type="number" min={0} step="0.01" className="rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500">
        Vendor name (optional)
        <input name="vendorName" type="text" placeholder="e.g. IKEA" className="rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500 sm:col-span-2">
        Vendor product URL (optional)
        <input name="vendorUrl" type="url" placeholder="https://…" className="rounded border border-neutral-300 px-2 py-1.5 text-sm" />
      </label>

      <label className="flex flex-col gap-1 text-xs text-neutral-500 sm:col-span-2">
        Thumbnail (optional)
        <input name="thumbnail" type="file" accept="image/png,image/jpeg,image/webp" className="text-sm" />
      </label>

      {state.error && <p className="col-span-full text-sm text-red-600">{state.error}</p>}

      <div className="col-span-full">
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'Create asset'}
        </button>
      </div>
    </form>
  );
}
