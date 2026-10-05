import 'server-only';
import { cookies } from 'next/headers';

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';

// The API's own refresh cookie is scoped to its /auth path on its own
// origin; since the browser only ever talks to the Next.js server (BFF
// pattern), we re-host both tokens as our own httpOnly cookies on this
// origin and forward the refresh token to the API only when needed.
export async function getAccessToken() {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken() {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value;
}

export async function setSessionCookies(accessToken: string, refreshSetCookieHeader: string | null) {
  const store = await cookies();
  store.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 15,
  });

  const refreshToken = refreshSetCookieHeader
    ? extractCookieValue(refreshSetCookieHeader, REFRESH_COOKIE)
    : undefined;
  if (refreshToken) {
    store.set(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function clearSessionCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

function extractCookieValue(setCookieHeader: string, name: string): string | undefined {
  const match = setCookieHeader.match(new RegExp(`^${name}=([^;]+)`));
  return match?.[1];
}
