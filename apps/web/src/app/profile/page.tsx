import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import { AccountNav } from '@/components/AccountNav';
import { ProfileForm } from './ProfileForm';

interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export default async function ProfilePage() {
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
      <AccountNav active="/profile" />

      <div className="px-6 py-10 sm:px-10">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900">Profile</h1>

        <div className="flex flex-col gap-6 rounded-lg border border-neutral-200 bg-white p-6">
          <ProfileForm initialName={me.name ?? ''} />

          <dl className="grid grid-cols-2 gap-4 border-t border-neutral-100 pt-4 text-sm">
            <div>
              <dt className="text-neutral-500">Email</dt>
              <dd className="text-neutral-900">{me.email}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Role</dt>
              <dd className="text-neutral-900">{me.role}</dd>
            </div>
            <div>
              <dt className="text-neutral-500">Member since</dt>
              <dd className="text-neutral-900">{new Date(me.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
