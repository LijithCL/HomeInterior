'use server';

import { apiFetch } from '@/lib/api-client';
import type { Comment } from '@/lib/editor/comment-types';

// No access token on either call — same anonymous model as the share page
// itself (see page.tsx and ShareLinksService.resolveToken).
export async function listPublicCommentsAction(token: string): Promise<Comment[]> {
  return apiFetch<Comment[]>(`/share/${token}/comments`, undefined);
}

export async function createPublicCommentAction(
  token: string,
  input: { body: string; authorName: string; floorId?: string; x?: number; y?: number },
): Promise<Comment> {
  return apiFetch<Comment>(`/share/${token}/comments`, undefined, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
