'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editor/editor-store';
import type { Comment } from '@/lib/editor/comment-types';

interface CommentsPanelProps {
  projectId: string;
  createComment: (
    projectId: string,
    input: { body: string; floorId?: string; x?: number; y?: number },
  ) => Promise<Comment>;
  resolveComment: (projectId: string, id: string, resolved: boolean) => Promise<Comment>;
  deleteComment: (projectId: string, id: string) => Promise<void>;
}

export function CommentsPanel({ projectId, createComment, resolveComment, deleteComment }: CommentsPanelProps) {
  const [draftBody, setDraftBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = useEditorStore((s) => s.commentsPanelOpen);
  const setOpen = useEditorStore((s) => s.setCommentsPanelOpen);
  const comments = useEditorStore((s) => s.comments);
  const draftCommentPin = useEditorStore((s) => s.draftCommentPin);
  const setDraftCommentPin = useEditorStore((s) => s.setDraftCommentPin);
  const selectedCommentId = useEditorStore((s) => s.selectedCommentId);
  const setSelectedCommentId = useEditorStore((s) => s.setSelectedCommentId);
  const addCommentLocal = useEditorStore((s) => s.addCommentLocal);
  const updateCommentLocal = useEditorStore((s) => s.updateCommentLocal);
  const removeCommentLocal = useEditorStore((s) => s.removeCommentLocal);
  const setTool = useEditorStore((s) => s.setTool);

  const unresolvedCount = comments.filter((c) => !c.resolved).length;

  async function submitDraft() {
    if (!draftCommentPin || !draftBody.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createComment(projectId, {
        body: draftBody.trim(),
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

  async function toggleResolved(comment: Comment) {
    setBusy(true);
    setError(null);
    try {
      const updated = await resolveComment(projectId, comment.id, !comment.resolved);
      updateCommentLocal(comment.id, updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update this comment.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(comment: Comment) {
    setBusy(true);
    setError(null);
    try {
      await deleteComment(projectId, comment.id);
      removeCommentLocal(comment.id);
      if (selectedCommentId === comment.id) setSelectedCommentId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete this comment.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700"
      >
        Comments
        {unresolvedCount > 0 && (
          <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {unresolvedCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-md border border-neutral-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-xs text-neutral-500">
            Use the Comment tool to drop a pin on the design, then leave a note for your team.
          </p>

          {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

          {draftCommentPin && (
            <div className="mb-3 flex flex-col gap-2 rounded border border-accent-light bg-accent-light/20 p-2">
              <p className="text-xs font-medium text-neutral-700">New comment at this pin</p>
              <textarea
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                rows={2}
                autoFocus
                className="rounded border border-neutral-300 px-2 py-1 text-sm"
                placeholder="Leave a note…"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitDraft}
                  disabled={busy || !draftBody.trim()}
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
              <li
                key={comment.id}
                onClick={() => setSelectedCommentId(comment.id)}
                className={`cursor-pointer rounded border p-2 text-xs ${
                  selectedCommentId === comment.id ? 'border-accent bg-accent-light/20' : 'border-neutral-200'
                } ${comment.resolved ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-neutral-900">{comment.authorName ?? 'Someone'}</span>
                  <span className="text-neutral-400">{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="mt-1 text-neutral-600">{comment.body}</p>
                <div className="mt-1 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleResolved(comment);
                    }}
                    className="text-neutral-500 hover:text-accent-dark"
                  >
                    {comment.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(comment);
                    }}
                    className="text-red-500 hover:text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
            {comments.length === 0 && <li className="text-xs text-neutral-400">No comments yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
