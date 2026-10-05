'use client';

import { useState } from 'react';
import { setProjectTeamAction } from './actions';

interface ProjectTeamSelectProps {
  projectId: string;
  teamId: string | null;
  teams: { id: string; name: string }[];
}

export function ProjectTeamSelect({ projectId, teamId, teams }: ProjectTeamSelectProps) {
  const [busy, setBusy] = useState(false);

  async function onChange(value: string) {
    setBusy(true);
    try {
      await setProjectTeamAction(projectId, value === '' ? null : value);
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={teamId ?? ''}
      disabled={busy}
      onChange={(e) => onChange(e.target.value)}
      className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-600 disabled:opacity-50"
    >
      <option value="">Personal</option>
      {teams.map((team) => (
        <option key={team.id} value={team.id}>
          {team.name}
        </option>
      ))}
    </select>
  );
}
