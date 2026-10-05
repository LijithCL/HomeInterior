'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { BuiltInTemplateSummary, CustomTemplateSummary } from '@/lib/editor/template-types';

export interface CreateProjectFormState {
  error?: string;
}

export async function createProjectAction(
  _prevState: CreateProjectFormState,
  formData: FormData,
): Promise<CreateProjectFormState> {
  const name = String(formData.get('name') ?? '').trim();
  if (!name) {
    return { error: 'Project name is required' };
  }
  const templateId = String(formData.get('templateId') ?? '').trim();

  const accessToken = await getAccessToken();
  try {
    await apiFetch('/projects', accessToken, {
      method: 'POST',
      body: JSON.stringify({ name, ...(templateId ? { templateId } : {}) }),
    });
  } catch {
    return { error: 'Could not create the project. Please try again.' };
  }

  revalidatePath('/dashboard');
  return {};
}

export async function setProjectTeamAction(projectId: string, teamId: string | null): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/projects/${projectId}/team`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ teamId }),
  });
  revalidatePath('/dashboard');
}

export async function deleteProjectAction(projectId: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/projects/${projectId}`, accessToken, { method: 'DELETE' });
  revalidatePath('/dashboard');
}

export async function listBuiltInTemplatesAction(): Promise<BuiltInTemplateSummary[]> {
  const accessToken = await getAccessToken();
  return apiFetch<BuiltInTemplateSummary[]>('/projects/templates', accessToken);
}

export async function listCustomTemplatesAction(): Promise<CustomTemplateSummary[]> {
  const accessToken = await getAccessToken();
  return apiFetch<CustomTemplateSummary[]>('/templates', accessToken);
}

export async function deleteCustomTemplateAction(id: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/templates/${id}`, accessToken, { method: 'DELETE' });
}
