import { notFound } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import type { DesignDocument } from '@/lib/editor/document';
import type { Asset } from '@/lib/editor/asset-types';
import { ShareViewer } from '@/components/share/ShareViewer';

interface SharePayload {
  project: { id: string; name: string };
  document: DesignDocument;
  assets: Asset[];
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let data: SharePayload;
  try {
    // Deliberately no access token — this is the one page in the app that
    // works for a completely anonymous visitor (see ShareLinksService.resolvePublic).
    data = await apiFetch<SharePayload>(`/share/${token}`, undefined);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  return <ShareViewer token={token} projectName={data.project.name} document={data.document} assets={data.assets} />;
}
