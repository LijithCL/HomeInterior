import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { TeamSummary } from '@/lib/teams/types';
import { PLAN_CATALOG } from '@/lib/plans';
import { AccountNav } from '@/components/AccountNav';
import { NewTeamForm } from './new-team-form';

export default async function TeamsPage() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  let teams: TeamSummary[] = [];
  try {
    teams = await apiFetch<TeamSummary[]>('/teams', accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AccountNav active="/teams" />

      <div className="px-6 py-10 sm:px-10">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Teams</h1>

        <div className="mb-8">
          <NewTeamForm />
        </div>

        {teams.length === 0 ? (
          <p className="text-neutral-500">
            No teams yet. Create one above to share projects with collaborators and unlock Pro billing.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3 transition hover:-translate-y-0.5 hover:border-accent-light hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-neutral-900">{team.name}</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {team.myRole} · {PLAN_CATALOG.find((p) => p.tier === team.planTier)?.name ?? team.planTier} plan
                  </p>
                </div>
                <Link
                  href={`/teams/${team.id}`}
                  className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
                >
                  Manage
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
