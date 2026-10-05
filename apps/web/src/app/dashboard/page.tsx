import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { TeamSummary } from '@/lib/teams/types';
import { AccountNav } from '@/components/AccountNav';
import { getPersonalBillingStatusAction } from '@/lib/billing-actions';
import { PLAN_CATALOG } from '@/lib/plans';
import { NewProjectForm } from './new-project-form';
import { ProjectTeamSelect } from './ProjectTeamSelect';
import { DeleteProjectButton } from './DeleteProjectButton';

interface Project {
  id: string;
  name: string;
  description: string | null;
  teamId: string | null;
  updatedAt: string;
}

interface CurrentUser {
  name: string;
  role: string;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const ROOM_KIND_LABELS: Record<string, string> = {
  living: 'Living room',
  dining: 'Dining room',
  kitchen: 'Kitchen',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  garage: 'Garage',
  study: 'Study',
  other: 'Other',
};
const ROOM_KINDS = Object.keys(ROOM_KIND_LABELS);

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ roomKind?: string }>;
}) {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }
  const { roomKind } = await searchParams;
  const activeRoomKind = ROOM_KINDS.includes(roomKind ?? '') ? roomKind : undefined;

  let projects: Project[] = [];
  let teams: TeamSummary[] = [];
  let isAdmin = false;
  let firstName = 'there';
  let planTier = 'FREE';
  try {
    const projectsPath = activeRoomKind ? `/projects?roomKind=${activeRoomKind}` : '/projects';
    const [projectList, me, teamList, billing] = await Promise.all([
      apiFetch<Project[]>(projectsPath, accessToken),
      apiFetch<CurrentUser>('/auth/me', accessToken),
      apiFetch<TeamSummary[]>('/teams', accessToken),
      getPersonalBillingStatusAction(),
    ]);
    projects = projectList;
    isAdmin = me.role === 'ADMIN';
    teams = teamList;
    firstName = me.name?.split(' ')[0] || 'there';
    planTier = billing.planTier;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      redirect('/login');
    }
    throw err;
  }

  const teamsById = new Map(teams.map((team) => [team.id, team.name]));
  const planName = PLAN_CATALOG.find((plan) => plan.tier === planTier)?.name ?? planTier;
  const personalCount = projects.filter((project) => !project.teamId).length;

  return (
    <div className="min-h-screen bg-cream">
      <AccountNav
        active="/dashboard"
        extra={
          isAdmin && (
            <Link href="/admin/assets" className="text-neutral-500 hover:text-accent">
              Asset library
            </Link>
          )
        }
      />

      <div className="relative overflow-hidden border-b border-neutral-200 bg-white">
        <div className="bg-grid absolute inset-0 opacity-40" aria-hidden />
        <div
          className="animate-float-blob absolute -right-16 -top-16 h-72 w-72 rounded-full bg-accent-light blur-3xl"
          aria-hidden
        />
        <div
          className="animate-float-blob absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-sage-light blur-3xl [animation-delay:2s]"
          aria-hidden
        />

        <div className="relative px-6 py-12 sm:px-10">
          <div className="animate-fade-in-up flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm text-neutral-500">Welcome back</p>
              <h1 className="text-4xl font-bold text-neutral-900">{firstName}</h1>
            </div>
            <Link
              href="/billing"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-light px-4 py-2 text-sm font-semibold text-accent-dark shadow-sm transition hover:-translate-y-0.5 hover:bg-accent hover:text-white hover:shadow-md"
            >
              {planName} plan
            </Link>
          </div>

          <div className="animate-fade-in-up mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3 [animation-delay:80ms]">
            <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent-dark">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 11.5 12 4l9 7.5" />
                  <path d="M5.5 10v9.5h13V10" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{projects.length}</p>
                <p className="text-xs text-neutral-500">Project{projects.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-sage-light text-sage">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="8" r="3" />
                  <circle cx="16.5" cy="9.5" r="2.4" />
                  <path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" />
                  <path d="M14.2 15c2.4.2 4.1 2 4.6 4.3" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{teams.length}</p>
                <p className="text-xs text-neutral-500">Team{teams.length === 1 ? '' : 's'}</p>
              </div>
            </div>

            <div className="flex items-center gap-4 rounded-xl border border-neutral-200 bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="3.4" />
                  <path d="M5 20c0-3.6 3.1-6.2 7-6.2s7 2.6 7 6.2" />
                </svg>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{personalCount}</p>
                <p className="text-xs text-neutral-500">Personal</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 py-12 sm:px-10">
        <div className="animate-fade-in-up mb-10 flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">Start something new</h2>
            <p className="mt-0.5 text-xs text-neutral-500">Spin up a fresh project and design it in 2D or 3D.</p>
          </div>
          <NewProjectForm />
        </div>

        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">Your projects</h2>
          {projects.length > 0 && <p className="text-sm text-neutral-500">{projects.length} total</p>}
        </div>

        <div className="mb-5 flex flex-wrap gap-1.5">
          <Link
            href="/dashboard"
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              !activeRoomKind ? 'border-accent bg-accent-light text-accent-dark' : 'border-neutral-300 text-neutral-600'
            }`}
          >
            All rooms
          </Link>
          {ROOM_KINDS.filter((k) => k !== 'other').map((kind) => (
            <Link
              key={kind}
              href={`/dashboard?roomKind=${kind}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                activeRoomKind === kind ? 'border-accent bg-accent-light text-accent-dark' : 'border-neutral-300 text-neutral-600'
              }`}
            >
              {ROOM_KIND_LABELS[kind]}
            </Link>
          ))}
        </div>

        {projects.length === 0 ? (
          <div className="animate-fade-in-up flex flex-col items-center gap-2 rounded-xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-light text-accent-dark">
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 11.5 12 4l9 7.5" />
                <path d="M5.5 10v9.5h13V10" />
              </svg>
            </div>
            <p className="font-medium text-neutral-900">
              {activeRoomKind ? `No projects with a ${ROOM_KIND_LABELS[activeRoomKind].toLowerCase()}` : 'No projects yet'}
            </p>
            <p className="text-sm text-neutral-500">
              {activeRoomKind ? (
                <Link href="/dashboard" className="text-accent hover:underline">
                  Clear the filter
                </Link>
              ) : (
                'Create your first one above to start designing.'
              )}
            </p>
          </div>
        ) : (
          <ul className="animate-fade-in-up grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <li
                key={project.id}
                className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="relative h-16 bg-gradient-to-br from-accent to-accent-dark">
                  <div className="bg-grid absolute inset-0 opacity-20" aria-hidden />
                  {project.teamId && (
                    <span className="absolute right-3 top-3 rounded-full bg-white/20 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-sm">
                      {teamsById.get(project.teamId) ?? 'Team'}
                    </span>
                  )}
                </div>
                <div className="px-5 pb-5">
                  <div className="-mt-6 mb-3 flex h-12 w-12 items-center justify-center rounded-xl border-4 border-white bg-white shadow-sm">
                    <svg
                      viewBox="0 0 24 24"
                      className="h-5 w-5 text-accent"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 11.5 12 4l9 7.5" />
                      <path d="M5.5 10v9.5h13V10" />
                      <path d="M9.5 19.5v-6h5v6" />
                    </svg>
                  </div>
                  <p className="font-semibold text-neutral-900">{project.name}</p>
                  {project.description && (
                    <p className="mt-1 line-clamp-2 text-sm text-neutral-500">{project.description}</p>
                  )}
                  <p className="mt-2 text-xs text-neutral-400">Updated {formatDate(project.updatedAt)}</p>

                  <div className="mt-4 flex items-center justify-between gap-2">
                    {teams.length > 0 && (
                      <ProjectTeamSelect projectId={project.id} teamId={project.teamId} teams={teams} />
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <DeleteProjectButton projectId={project.id} projectName={project.name} />
                      <Link
                        href={`/editor/${project.id}`}
                        className="rounded-md border border-accent px-3 py-1.5 text-sm font-medium text-accent transition hover:bg-accent hover:text-white"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
