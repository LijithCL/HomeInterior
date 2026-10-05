import { notFound, redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import { createEmptyDocument, type DesignDocument } from '@/lib/editor/document';
import type { Asset } from '@/lib/editor/asset-types';
import { EditorShell } from '@/components/editor/EditorShell';
import { saveDesignVersionAction } from './actions';

interface Project {
  id: string;
  name: string;
}

interface DesignVersionResponse {
  document: DesignDocument;
}

interface CurrentUser {
  defaultUnit: string | null;
}

export default async function EditorPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  let data: { project: Project; latestVersion: DesignVersionResponse | null; assets: Asset[]; me: CurrentUser };
  try {
    const [project, latestVersion, assets, me] = await Promise.all([
      apiFetch<Project>(`/projects/${projectId}`, accessToken),
      apiFetch<DesignVersionResponse | null>(`/projects/${projectId}/latest-version`, accessToken),
      apiFetch<Asset[]>('/assets', accessToken),
      apiFetch<CurrentUser>('/auth/me', accessToken),
    ]);
    data = { project, latestVersion, assets, me };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect('/login');
      if (err.status === 404) notFound();
    }
    throw err;
  }

  return (
    <EditorShell
      projectId={data.project.id}
      projectName={data.project.name}
      initialDocument={data.latestVersion?.document ?? createEmptyDocument()}
      assets={data.assets}
      saveAction={saveDesignVersionAction}
      initialUnit={data.me.defaultUnit}
    />
  );
}
