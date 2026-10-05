'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { TeamDetail } from '@/lib/teams/types';
import { addTeamMemberAction, getTeamAction, removeTeamMemberAction, updateTeamMemberRoleAction } from '../actions';

interface MembersPanelProps {
  teamId: string;
  initialTeam: TeamDetail;
  currentUserId: string;
}

export function MembersPanel({ teamId, initialTeam, currentUserId }: MembersPanelProps) {
  const router = useRouter();
  const [team, setTeam] = useState(initialTeam);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'EDITOR' | 'VIEWER'>('EDITOR');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwner = team.myRole === 'OWNER';

  async function refresh() {
    setTeam(await getTeamAction(teamId));
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await addTeamMemberAction(teamId, email, role);
      setEmail('');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that person.');
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, newRole: 'EDITOR' | 'VIEWER') {
    setBusy(true);
    try {
      await updateTeamMemberRoleAction(teamId, userId, newRole);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string) {
    setBusy(true);
    try {
      await removeTeamMemberAction(teamId, userId);
      if (userId === currentUserId) {
        router.push('/teams');
        return;
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {team.members.map((member) => {
          const isSelf = member.user.id === currentUserId;
          return (
            <li
              key={member.id}
              className="flex items-center justify-between rounded border border-neutral-200 px-3 py-2 text-sm"
            >
              <div>
                <p className="text-neutral-900">
                  {member.user.name || member.user.email} {isSelf && <span className="text-neutral-400">(you)</span>}
                </p>
                <p className="text-xs text-neutral-400">{member.user.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && member.role !== 'OWNER' ? (
                  <select
                    value={member.role}
                    disabled={busy}
                    onChange={(e) => changeRole(member.user.id, e.target.value as 'EDITOR' | 'VIEWER')}
                    className="rounded border border-neutral-300 px-2 py-1 text-xs"
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                ) : (
                  <span className="text-xs font-medium text-neutral-500">{member.role}</span>
                )}
                {member.role !== 'OWNER' && (isOwner || isSelf) && (
                  <button
                    onClick={() => removeMember(member.user.id)}
                    disabled={busy}
                    className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                  >
                    {isSelf ? 'Leave' : 'Remove'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <form onSubmit={addMember} className="flex items-end gap-2 border-t border-neutral-200 pt-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500">Add a member by email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'EDITOR' | 'VIEWER')}
            className="rounded border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="EDITOR">Editor</option>
            <option value="VIEWER">Viewer</option>
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
