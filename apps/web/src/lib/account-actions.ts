'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch } from './api-client';
import { getAccessToken } from './session';

export interface ProfileFormState {
  error?: string;
  success?: boolean;
}

// Shared by the Profile page (edits `name`) and the Settings page (edits
// `defaultUnit`) — each form only includes the field it owns, so only that
// field is sent in the PATCH.
export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const accessToken = await getAccessToken();
  const body: Record<string, string> = {};
  const name = formData.get('name');
  const defaultUnit = formData.get('defaultUnit');
  if (name !== null) body.name = String(name);
  if (defaultUnit !== null) body.defaultUnit = String(defaultUnit);

  try {
    await apiFetch('/auth/me', accessToken, { method: 'PATCH', body: JSON.stringify(body) });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not save changes.' };
  }
  revalidatePath('/profile');
  revalidatePath('/settings');
  return { success: true };
}

export interface PasswordFormState {
  error?: string;
  success?: boolean;
}

export async function changePasswordAction(
  _prevState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const accessToken = await getAccessToken();
  const currentPassword = String(formData.get('currentPassword') ?? '');
  const newPassword = String(formData.get('newPassword') ?? '');

  try {
    await apiFetch('/auth/change-password', accessToken, {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Could not change password.' };
  }
  return { success: true };
}
