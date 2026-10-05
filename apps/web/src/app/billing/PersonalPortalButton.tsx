'use client';

import { useState } from 'react';
import { openPersonalBillingPortalAction } from '@/lib/billing-actions';

export function PersonalPortalButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await openPersonalBillingPortalAction();
      window.location.assign(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the billing portal.');
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        onClick={open}
        disabled={busy}
        className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 transition hover:border-neutral-400 disabled:opacity-50"
      >
        {busy ? 'Redirecting…' : label}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
