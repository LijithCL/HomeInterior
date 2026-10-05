import { NextResponse } from 'next/server';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';

// A plain Route Handler (not a Server Action) so the client can call it
// with `fetch(..., { keepalive: true })` from a visibilitychange/pagehide
// listener — the browser guarantees a keepalive request is sent even after
// the page starts unloading, which a debounced setTimeout-based autosave
// can't offer on its own (see EditorShell's flush-on-hide effect). Reads
// the same httpOnly access-token cookie Server Actions use; the browser
// attaches it automatically since this route lives on the same origin.
export async function POST(request: Request) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { projectId, document } = await request.json();
  if (!projectId || !document) {
    return NextResponse.json({ error: 'Missing projectId or document' }, { status: 400 });
  }

  try {
    await apiFetch(`/projects/${projectId}/versions`, accessToken, {
      method: 'POST',
      body: JSON.stringify({ document }),
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: 'Save failed' }, { status });
  }
}
