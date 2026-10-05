'use client';

import { useActionState, useRef, useState, useEffect } from 'react';
import { createProjectAction, listBuiltInTemplatesAction, listCustomTemplatesAction, deleteCustomTemplateAction, type CreateProjectFormState } from './actions';
import { TemplateThumbnail } from './TemplateThumbnail';
import type { BuiltInTemplateSummary, CustomTemplateSummary, TemplatePreview } from '@/lib/editor/template-types';

const initialState: CreateProjectFormState = {};
const BLANK_PREVIEW: TemplatePreview = { walls: [], rooms: [] };

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProjectAction, initialState);
  const [templateId, setTemplateId] = useState('');
  const [builtIns, setBuiltIns] = useState<BuiltInTemplateSummary[] | null>(null);
  const [customs, setCustoms] = useState<CustomTemplateSummary[] | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    listBuiltInTemplatesAction().then(setBuiltIns).catch(() => setBuiltIns([]));
    listCustomTemplatesAction().then(setCustoms).catch(() => setCustoms([]));
  }, []);

  useEffect(() => {
    if (!pending && !state.error) {
      formRef.current?.reset();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTemplateId('');
    }
  }, [pending, state.error]);

  async function removeCustomTemplate(id: string) {
    await deleteCustomTemplateAction(id);
    setCustoms((prev) => (prev ?? []).filter((t) => t.id !== id));
    if (templateId === id) setTemplateId('');
  }

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="templateId" value={templateId} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        <button
          type="button"
          onClick={() => setTemplateId('')}
          className={`overflow-hidden rounded-lg border text-left transition ${
            templateId === '' ? 'border-accent ring-2 ring-accent-light' : 'border-neutral-200 hover:border-accent-light'
          }`}
        >
          <TemplateThumbnail preview={BLANK_PREVIEW} />
          <p className="px-2 py-1.5 text-xs font-medium text-neutral-700">Blank canvas</p>
        </button>

        {(builtIns ?? []).map((template) => (
          <button
            key={template.id}
            type="button"
            title={template.description}
            onClick={() => setTemplateId(template.id)}
            className={`overflow-hidden rounded-lg border text-left transition ${
              templateId === template.id ? 'border-accent ring-2 ring-accent-light' : 'border-neutral-200 hover:border-accent-light'
            }`}
          >
            <TemplateThumbnail preview={template.preview} />
            <p className="px-2 py-1.5 text-xs font-medium text-neutral-700">{template.label}</p>
          </button>
        ))}

        {(customs ?? []).map((template) => (
          <div
            key={template.id}
            className={`group relative overflow-hidden rounded-lg border text-left transition ${
              templateId === template.id ? 'border-accent ring-2 ring-accent-light' : 'border-neutral-200 hover:border-accent-light'
            }`}
          >
            <button type="button" title={template.description ?? ''} onClick={() => setTemplateId(template.id)} className="block w-full text-left">
              <TemplateThumbnail preview={template.preview} />
              <p className="truncate px-2 py-1.5 text-xs font-medium text-neutral-700">{template.name}</p>
            </button>
            <button
              type="button"
              onClick={() => removeCustomTemplate(template.id)}
              title="Delete this template"
              className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-white/90 text-xs text-red-500 shadow group-hover:flex"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1">
          <input
            name="name"
            type="text"
            placeholder="e.g. My Villa"
            required
            className="rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent-light"
          />
          {state.error && <p className="text-xs text-red-600">{state.error}</p>}
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark disabled:opacity-50"
        >
          {pending ? 'Creating…' : 'New project'}
        </button>
      </div>
    </form>
  );
}
