import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { AnalyticsSummary, BillingStatus, TeamDetail } from '@/lib/teams/types';
import { AccountNav } from '@/components/AccountNav';
import { MembersPanel } from './MembersPanel';
import { BillingPanel } from './BillingPanel';

interface CurrentUser {
  id: string;
}

interface TeamProject {
  id: string;
  name: string;
  description: string | null;
  updatedAt: string;
}

export default async function TeamDetailPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = await params;
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  let team: TeamDetail;
  let billing: BillingStatus;
  let analytics: AnalyticsSummary;
  let me: CurrentUser;
  let projects: TeamProject[];
  try {
    [team, billing, analytics, me, projects] = await Promise.all([
      apiFetch<TeamDetail>(`/teams/${teamId}`, accessToken),
      apiFetch<BillingStatus>(`/teams/${teamId}/billing`, accessToken),
      apiFetch<AnalyticsSummary>(`/analytics/summary?teamId=${teamId}`, accessToken),
      apiFetch<CurrentUser>('/auth/me', accessToken),
      apiFetch<TeamProject[]>(`/projects?teamId=${teamId}`, accessToken),
    ]);
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401) redirect('/login');
      if (err.status === 404) notFound();
    }
    throw err;
  }

  const isOwner = team.myRole === 'OWNER';

  return (
    <div className="min-h-screen bg-cream">
      <AccountNav active="/teams" />

      <div className="px-6 py-10 sm:px-10">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-neutral-900">{team.name}</h1>
          <Link href="/teams" className="text-sm text-neutral-500 hover:text-accent">
            ← Teams
          </Link>
        </div>

        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Team Work — Projects</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-neutral-500">
              This team doesn&apos;t own any projects yet — move one over from{' '}
              <Link href="/dashboard" className="text-accent hover:underline">
                My Work
              </Link>
              .
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {projects.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 transition hover:border-accent-light hover:shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium text-neutral-900">{project.name}</p>
                    <p className="text-xs text-neutral-400">
                      Updated {new Date(project.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <Link
                    href={`/editor/${project.id}`}
                    className="rounded-md border border-accent px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent hover:text-white"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Members</h2>
          <MembersPanel teamId={teamId} initialTeam={team} currentUserId={me.id} />
        </section>

        <section className="mb-8 rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Billing</h2>
          <BillingPanel teamId={teamId} initialStatus={billing} isOwner={isOwner} />
        </section>

        <section className="rounded-lg border border-neutral-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Analytics</h2>
          <dl className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-neutral-500">Projects</dt>
              <dd className="text-lg font-semibold text-neutral-900">{analytics.projectCount}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Members</dt>
              <dd className="text-lg font-semibold text-neutral-900">{analytics.memberCount ?? team.members.length}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Renders done</dt>
              <dd className="text-lg font-semibold text-neutral-900">{analytics.renderJobs.DONE ?? 0}</dd>
            </div>
          </dl>
          <div className="mt-4 grid grid-cols-2 gap-4 text-xs text-neutral-500">
            <div>
              <p className="mb-1 font-medium text-neutral-700">Render jobs</p>
              {Object.entries(analytics.renderJobs).map(([status, count]) => (
                <p key={status}>
                  {status}: {count}
                </p>
              ))}
            </div>
            <div>
              <p className="mb-1 font-medium text-neutral-700">AI requests</p>
              {Object.entries(analytics.aiRequests).map(([status, count]) => (
                <p key={status}>
                  {status}: {count}
                </p>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
