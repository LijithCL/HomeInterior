'use client';

import { useActionState } from 'react';
import { updateProfileAction, type ProfileFormState } from '@/lib/account-actions';

const initialState: ProfileFormState = {};
const UNITS = ['mm', 'cm', 'm', 'ft'] as const;

export function DefaultUnitForm({ initialUnit }: { initialUnit: string }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm text-neutral-500">
        Default measurement unit
        <select
          name="defaultUnit"
          defaultValue={initialUnit}
          className="w-40 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
        >
          {UNITS.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-400">Used as your starting unit when you open the editor.</span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-sage">Saved.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
