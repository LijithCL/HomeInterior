import 'server-only';

const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// Raw call against the NestJS API from server-side code (Server Actions,
// Server Components). Returns the fetch Response so callers can read both
// the JSON body and any Set-Cookie header (needed by auth calls).
export async function apiFetchRaw(path: string, init?: RequestInit) {
  // FormData bodies (file uploads) need fetch to set their own multipart
  // boundary in Content-Type — forcing application/json here would break them.
  const isFormData = init?.body instanceof FormData;
  return fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...init?.headers,
    },
  });
}

export async function apiFetch<T>(
  path: string,
  accessToken: string | undefined,
  init?: RequestInit,
): Promise<T> {
  const res = await apiFetchRaw(path, {
    ...init,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, body.message ?? res.statusText);
  }

  // Nest writes a genuinely empty body (not the literal text "null") when a
  // controller returns null/undefined — res.json() on an empty body throws
  // "Unexpected end of JSON input" instead of just giving you `null` back.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}
