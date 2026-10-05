import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import { AccountNav } from '@/components/AccountNav';
import { PasswordForm } from './PasswordForm';
import { DefaultUnitForm } from './DefaultUnitForm';
import { HelpVideos } from './HelpVideos';
import { FaqAccordion } from './FaqAccordion';

interface CurrentUser {
  defaultUnit: string | null;
}

export default async function SettingsPage() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  let me: CurrentUser;
  try {
    me = await apiFetch<CurrentUser>('/auth/me', accessToken);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  return (
    <div className="min-h-screen bg-cream">
      <AccountNav active="/settings" />

      <div className="px-6 py-10 sm:px-10">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Settings</h1>

        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Preferences</h2>
            <DefaultUnitForm initialUnit={me.defaultUnit ?? 'm'} />
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Change password</h2>
            <PasswordForm />
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-1 text-sm font-semibold text-neutral-900">Help videos</h2>
            <p className="mb-4 text-xs text-neutral-500">Short walkthroughs of the editor&apos;s main features.</p>
            <HelpVideos />
          </section>

          <section className="rounded-lg border border-neutral-200 bg-white p-6">
            <h2 className="mb-4 text-sm font-semibold text-neutral-900">Questions & answers</h2>
            <FaqAccordion />
          </section>
        </div>
      </div>
    </div>
  );
}
