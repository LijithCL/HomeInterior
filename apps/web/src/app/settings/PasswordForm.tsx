'use client';

import { useActionState, useRef, useEffect } from 'react';
import { changePasswordAction, type PasswordFormState } from '@/lib/account-actions';

const initialState: PasswordFormState = {};

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && state.success) {
      formRef.current?.reset();
    }
  }, [pending, state.success]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm text-neutral-500">
        Current password
        <input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm text-neutral-500">
        New password
        <input
          name="newPassword"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
        />
        <span className="text-xs text-neutral-400">At least 8 characters.</span>
      </label>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.success && <p className="text-sm text-sage">Password updated.</p>}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
      >
        {pending ? 'Updating…' : 'Update password'}
      </button>
    </form>
  );
}
