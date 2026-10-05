'use client';

import { useActionState, useRef, useEffect } from 'react';
import { createTeamAction, type CreateTeamFormState } from './actions';

const initialState: CreateTeamFormState = {};

export function NewTeamForm() {
  const [state, formAction, pending] = useActionState(createTeamAction, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
    }
  }, [pending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex items-start gap-2">
      <div className="flex flex-col gap-1">
        <input
          name="name"
          type="text"
          placeholder="e.g. Acme Interiors"
          required
          className="rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
        />
        {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Creating…' : 'New team'}
      </button>
    </form>
  );
}
