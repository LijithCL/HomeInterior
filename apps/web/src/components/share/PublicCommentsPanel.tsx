'use client';

import { useEffect, useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { Comment } from '@/lib/editor/comment-types';

const NAME_STORAGE_KEY = 'homeInterior:reviewerName';

interface PublicCommentsPanelProps {
  token: string;
  listComments: (token: string) => Promise<Comment[]>;
  createComment: (
    token: string,
    input: { body: string; authorName: string; floorId?: string; x?: number; y?: number },
  ) => Promise<Comment>;
}

// The client-review counterpart to CommentsPanel — read + add only. An
// anonymous viewer never gets resolve/delete, since there's no session to
// tie that action back to (see ShareViewController — only list/create are
// exposed with no auth at all).
export function PublicCommentsPanel({ token, listComments, createComment }: PublicCommentsPanelProps) {
  const [draftBody, setDraftBody] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useEditorStore((s) => s.commentsPanelOpen);
  const setOpen = useEditorStore((s) => s.setCommentsPanelOpen);
  const comments = useEditorStore((s) => s.comments);
  const setComments = useEditorStore((s) => s.setComments);
  const draftCommentPin = useEditorStore((s) => s.draftCommentPin);
  const setDraftCommentPin = useEditorStore((s) => s.setDraftCommentPin);
  const addCommentLocal = useEditorStore((s) => s.addCommentLocal);
  const setTool = useEditorStore((s) => s.setTool);

  useEffect(() => {
    // localStorage is only available client-side, so the remembered name
    // has to hydrate here rather than in the initial state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAuthorName(window.localStorage.getItem(NAME_STORAGE_KEY) ?? '');
    listComments(token).then(setComments).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submitDraft() {
    if (!draftCommentPin || !draftBody.trim() || !authorName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      window.localStorage.setItem(NAME_STORAGE_KEY, authorName.trim());
      const created = await createComment(token, {
        body: draftBody.trim(),
        authorName: authorName.trim(),
        floorId: draftCommentPin.floorId,
        x: draftCommentPin.x,
        y: draftCommentPin.y,
      });
      addCommentLocal(created);
      setDraftCommentPin(null);
      setDraftBody('');
      setTool('select');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add comment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700">
        Comments{comments.length > 0 ? ` (${comments.length})` : ''}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            Use the Comment tool to drop a pin and leave feedback for the design team.
          </p>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          {draftCommentPin && (
            <div className="mb-3 flex flex-col gap-2 rounded border border-accent-light bg-accent-light/20 p-2">
              <p className="text-xs font-medium text-neutral-700">New comment at this pin</p>
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name"
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
              />
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={2}
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                placeholder="Leave a note…"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitDraft}
                  disabled={busy || !draftBody.trim() || !authorName.trim()}
                  className="rounded bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                >
                  Post
                </button>
                <button
                  onClick={() => {
                    setDraftCommentPin(null);
                    setDraftBody('');
                    setTool('select');
                  }}
                  className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
            {comments.map((comment) => (
              <li key={comment.id} className="rounded border border-neutral-200 p-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-neutral-900">{comment.authorName ?? 'Someone'}</span>
                  <span className="text-neutral-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-neutral-600">{comment.body}</p>
              </li>
            ))}
            {comments.length === 0 && <li className="text-xs text-neutral-400">No comments yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
