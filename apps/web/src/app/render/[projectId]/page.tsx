import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { createEmptyDocument, type DesignDocument } from '@/lib/editor/document';
import type { Asset } from '@/lib/editor/asset-types';
import { RenderOnlyShell } from '@/components/editor/RenderOnlyShell';

interface Project {
  id: string;
}

interface DesignVersionResponse {
  document: DesignDocument;
}

interface RenderPageProps {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ token?: string }>;
}

// Visited only by the headless render worker (apps/api RenderService), never
// by a real user's browser — auth comes from a short-lived token in the
// query string rather than the normal session cookie, since a headless
// Playwright page has no cookie jar shared with anyone's login session.
export default async function RenderPage({ params, searchParams }: RenderPageProps) {
  const { projectId } = await params;
  const { token } = await searchParams;
  if (!token) {
    notFound();
  }

  let document: DesignDocument;
  let assets: Asset[];
  try {
    const [, latestVersion, assetList] = await Promise.all([
      apiFetch<Project>(`/projects/${projectId}`, token),
      apiFetch<DesignVersionResponse | null>(`/projects/${projectId}/latest-version`, token),
      apiFetch<Asset[]>('/assets', token),
    ]);
    document = latestVersion?.document ?? createEmptyDocument();
    assets = assetList;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
      notFound();
    }
    throw err;
  }

  return <RenderOnlyShell document={document} assets={assets} />;
}
