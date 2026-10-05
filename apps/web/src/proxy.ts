import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/session';

const PROTECTED_PREFIXES = ['/dashboard', '/editor', '/admin'];
const AUTH_PAGES = ['/login', '/register'];
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const ACCESS_COOKIE_MAX_AGE = 60 * 15;
const REFRESH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
}

// The access-token cookie only lives 15 minutes (see session.ts) and
// nothing refreshed it — every session just died mid-edit. Worse, since
// Server Actions are invoked as a POST to the same page URL, this proxy
// runs on every Save click too; redirecting there sends back a 307 with
// no RSC action-response body, which the client can't parse and surfaces
// as Next.js's generic "unexpected response from the server" error
// instead of a clean re-login. Refreshing transparently here — using the
// 30-day refresh-token cookie against the API's already-working
// /auth/refresh endpoint — avoids ever reaching that redirect while the
// refresh token is still valid.
async function tryRefresh(req: NextRequest): Promise<RefreshResult | null> {
  const refreshToken = req.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) return null;
  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `refresh_token=${refreshToken}` },
    });
    if (!res.ok) return null;
    const data: { accessToken: string } = await res.json();
    const setCookieHeader = res.headers.get('set-cookie');
    const newRefreshToken = setCookieHeader ? extractCookieValue(setCookieHeader, REFRESH_COOKIE) : undefined;
    return { accessToken: data.accessToken, refreshToken: newRefreshToken };
  } catch {
    return null;
  }
}

function extractCookieValue(setCookieHeader: string, name: string): string | undefined {
  const match = setCookieHeader.match(new RegExp(`^${name}=([^;]+)`));
  return match?.[1];
}

// Merges a single cookie into an existing raw Cookie header string, so a
// refreshed access token is visible to `cookies()` further down the
// pipeline (the Server Component/Action this same request is headed to)
// — setting it only on the outgoing *response* would leave this request
// still carrying the old/missing token.
function withCookie(cookieHeader: string | null, name: string, value: string): string {
  const parts = (cookieHeader ?? '')
    .split(';')
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith(`${name}=`));
  parts.push(`${name}=${value}`);
  return parts.join('; ');
}

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  let hasSession = Boolean(req.cookies.get(ACCESS_COOKIE)?.value);
  let refreshed: RefreshResult | null = null;

  if (!hasSession && isProtected) {
    refreshed = await tryRefresh(req);
    hasSession = refreshed !== null;
  }

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL('/login', req.url));
  }

  if (AUTH_PAGES.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  let res: NextResponse;
  if (refreshed) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set('cookie', withCookie(req.headers.get('cookie'), ACCESS_COOKIE, refreshed.accessToken));
    res = NextResponse.next({ request: { headers: requestHeaders } });
  } else {
    res = NextResponse.next();
  }

  if (refreshed) {
    res.cookies.set(ACCESS_COOKIE, refreshed.accessToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: ACCESS_COOKIE_MAX_AGE,
    });
    if (refreshed.refreshToken) {
      res.cookies.set(REFRESH_COOKIE, refreshed.refreshToken, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: REFRESH_COOKIE_MAX_AGE,
      });
    }
  }

  return res;
}

export const config = {
  matcher: ['/dashboard/:path*', '/editor/:path*', '/admin/:path*', '/login', '/register'],
};
