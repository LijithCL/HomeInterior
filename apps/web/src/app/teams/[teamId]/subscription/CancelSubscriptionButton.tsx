'use client';

import { useState } from 'react';
import { cancelSubscriptionAction } from '../../actions';

export function CancelSubscriptionButton({ teamId }: { teamId: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm('Cancel your subscription at the end of the current billing period?')) return;
    setBusy(true);
    setError(null);
    try {
      await cancelSubscriptionAction(teamId);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel the subscription.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return <p className="text-sm text-sage">Your subscription will end at the current period&apos;s end.</p>;
  }

  return (
    <div>
      <button
        onClick={cancel}
        disabled={busy}
        className="rounded border border-red-200 px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
      >
        {busy ? 'Cancelling…' : 'Cancel subscription'}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
