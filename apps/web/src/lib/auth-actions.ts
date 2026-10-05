'use server';

import { redirect } from 'next/navigation';
import { apiFetchRaw } from './api-client';
import { setSessionCookies, clearSessionCookies, getRefreshToken } from './session';

export interface AuthFormState {
  error?: string;
}

interface AuthResponse {
  user: { id: string; email: string; name: string | null; role: string };
  accessToken: string;
}

async function handleAuthResponse(res: Response): Promise<AuthFormState | undefined> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Something went wrong' }));
    return { error: body.message ?? 'Something went wrong' };
  }

  const data: AuthResponse = await res.json();
  await setSessionCookies(data.accessToken, res.headers.getSetCookie?.()[0] ?? null);
  redirect('/dashboard');
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '');

  const res = await apiFetchRaw('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name: name || undefined }),
  });

  return (await handleAuthResponse(res)) ?? {};
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');

  const res = await apiFetchRaw('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  return (await handleAuthResponse(res)) ?? {};
}

export async function logoutAction() {
  const refreshToken = await getRefreshToken();
  await apiFetchRaw('/auth/logout', {
    method: 'POST',
    headers: refreshToken ? { Cookie: `refresh_token=${refreshToken}` } : undefined,
  }).catch(() => undefined);
  await clearSessionCookies();
  redirect('/login');
}
