'use server';

import { apiFetch, apiFetchRaw, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { DesignDocument } from '@/lib/editor/document';
import type { RenderJob, RenderTier } from '@/lib/editor/render-job';
import type { AiRequest } from '@/lib/editor/ai-types';
import type { ShareLink } from '@/lib/editor/share-types';
import type { Comment } from '@/lib/editor/comment-types';
import type { CostLineItem } from '@/lib/editor/cost-estimate';
import type { Proposal } from '@/lib/editor/proposal-types';

export async function saveDesignVersionAction(projectId: string, document: DesignDocument) {
  const accessToken = await getAccessToken();
  await apiFetch(`/projects/${projectId}/versions`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ document }),
  });
}

export async function requestRenderAction(projectId: string, tier: RenderTier): Promise<RenderJob> {
  const accessToken = await getAccessToken();
  return apiFetch<RenderJob>(`/projects/${projectId}/render-jobs`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ tier }),
  });
}

export async function getRenderJobAction(projectId: string, jobId: string): Promise<RenderJob> {
  const accessToken = await getAccessToken();
  return apiFetch<RenderJob>(`/projects/${projectId}/render-jobs/${jobId}`, accessToken);
}

export async function requestAiGenerateAction(projectId: string, prompt: string): Promise<AiRequest> {
  const accessToken = await getAccessToken();
  return apiFetch<AiRequest>(`/projects/${projectId}/ai/generate`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
}

export async function requestAiEditAction(
  projectId: string,
  prompt: string,
  document: DesignDocument,
): Promise<AiRequest> {
  const accessToken = await getAccessToken();
  return apiFetch<AiRequest>(`/projects/${projectId}/ai/edit`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ prompt, document }),
  });
}

export async function requestAiImageAction(
  projectId: string,
  prompt: string,
  document: DesignDocument,
  file: File,
): Promise<AiRequest> {
  const accessToken = await getAccessToken();
  const formData = new FormData();
  formData.set('prompt', prompt);
  formData.set('document', JSON.stringify(document));
  formData.set('file', file);
  return apiFetch<AiRequest>(`/projects/${projectId}/ai/image`, accessToken, {
    method: 'POST',
    body: formData,
  });
}

export async function applyAiRequestAction(projectId: string, id: string): Promise<AiRequest> {
  const accessToken = await getAccessToken();
  return apiFetch<AiRequest>(`/projects/${projectId}/ai/${id}/apply`, accessToken, { method: 'POST' });
}

export async function rejectAiRequestAction(projectId: string, id: string): Promise<AiRequest> {
  const accessToken = await getAccessToken();
  return apiFetch<AiRequest>(`/projects/${projectId}/ai/${id}/reject`, accessToken, { method: 'POST' });
}

export async function createShareLinkAction(projectId: string): Promise<ShareLink> {
  const accessToken = await getAccessToken();
  return apiFetch<ShareLink>(`/projects/${projectId}/share-links`, accessToken, { method: 'POST', body: JSON.stringify({}) });
}

export async function listShareLinksAction(projectId: string): Promise<ShareLink[]> {
  const accessToken = await getAccessToken();
  return apiFetch<ShareLink[]>(`/projects/${projectId}/share-links`, accessToken);
}

export async function revokeShareLinkAction(projectId: string, id: string): Promise<ShareLink> {
  const accessToken = await getAccessToken();
  return apiFetch<ShareLink>(`/projects/${projectId}/share-links/${id}/revoke`, accessToken, { method: 'POST' });
}

export interface DesignVersionSummary {
  id: string;
  versionNum: number;
  createdBy: string;
  createdAt: string;
}

export interface DesignVersionFull extends DesignVersionSummary {
  document: DesignDocument;
}

export async function listVersionsAction(projectId: string): Promise<DesignVersionSummary[]> {
  const accessToken = await getAccessToken();
  return apiFetch<DesignVersionSummary[]>(`/projects/${projectId}/versions`, accessToken);
}

// Restoring creates a brand-new version (see ProjectsService.restoreVersion)
// and returns it in full, document included, so the editor can load it
// straight into the live document without a second round-trip.
export async function restoreVersionAction(projectId: string, versionNum: number): Promise<DesignVersionFull> {
  const accessToken = await getAccessToken();
  return apiFetch<DesignVersionFull>(`/projects/${projectId}/versions/${versionNum}/restore`, accessToken, {
    method: 'POST',
  });
}

export async function listCommentsAction(projectId: string): Promise<Comment[]> {
  const accessToken = await getAccessToken();
  return apiFetch<Comment[]>(`/projects/${projectId}/comments`, accessToken);
}

export async function createCommentAction(
  projectId: string,
  input: { body: string; floorId?: string; x?: number; y?: number },
): Promise<Comment> {
  const accessToken = await getAccessToken();
  return apiFetch<Comment>(`/projects/${projectId}/comments`, accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function resolveCommentAction(projectId: string, id: string, resolved: boolean): Promise<Comment> {
  const accessToken = await getAccessToken();
  return apiFetch<Comment>(`/projects/${projectId}/comments/${id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ resolved }),
  });
}

export async function deleteCommentAction(projectId: string, id: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/projects/${projectId}/comments/${id}`, accessToken, { method: 'DELETE' });
}

export async function uploadUnderlayImageAction(projectId: string, file: File): Promise<{ key: string; url: string }> {
  const accessToken = await getAccessToken();
  const formData = new FormData();
  formData.set('file', file);
  const res = await apiFetchRaw(`/projects/${projectId}/underlay-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new ApiError(res.status, body.message ?? 'Upload failed');
  }
  return res.json();
}

export async function getUnderlayImageUrlAction(projectId: string, key: string): Promise<{ url: string }> {
  const accessToken = await getAccessToken();
  return apiFetch<{ url: string }>(
    `/projects/${projectId}/underlay-image-url?key=${encodeURIComponent(key)}`,
    accessToken,
  );
}

export async function saveAsTemplateAction(projectId: string, name: string, description?: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch('/templates', accessToken, {
    method: 'POST',
    body: JSON.stringify({ projectId, name, description }),
  });
}

export async function createProposalAction(
  projectId: string,
  input: { title: string; notes?: string; designFeeCents?: number; lineItems: CostLineItem[] },
): Promise<Proposal> {
  const accessToken = await getAccessToken();
  return apiFetch<Proposal>(`/projects/${projectId}/proposals`, accessToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function listProposalsAction(projectId: string): Promise<Proposal[]> {
  const accessToken = await getAccessToken();
  return apiFetch<Proposal[]>(`/projects/${projectId}/proposals`, accessToken);
}

export async function sendProposalAction(projectId: string, id: string): Promise<Proposal> {
  const accessToken = await getAccessToken();
  return apiFetch<Proposal>(`/projects/${projectId}/proposals/${id}/send`, accessToken, { method: 'POST' });
}

export async function deleteProposalAction(projectId: string, id: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/projects/${projectId}/proposals/${id}`, accessToken, { method: 'DELETE' });
}
