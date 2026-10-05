import Link from 'next/link';
import { redirect } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { Asset } from '@/lib/editor/asset-types';
import { NewAssetForm } from './NewAssetForm';
import { AssetsTable } from './AssetsTable';

interface CurrentUser {
  role: string;
}

export default async function AdminAssetsPage() {
  const accessToken = await getAccessToken();
  if (!accessToken) {
    redirect('/login');
  }

  let me: CurrentUser;
  let assets: Asset[];
  try {
    [me, assets] = await Promise.all([
      apiFetch<CurrentUser>('/auth/me', accessToken),
      apiFetch<Asset[]>('/assets?includeInactive=true', accessToken),
    ]);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    throw err;
  }

  if (me.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="px-6 py-10 sm:px-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Asset library</h1>
        <Link href="/dashboard" className="text-sm text-neutral-500 hover:underline">
          ← Dashboard
        </Link>
      </div>

      <div className="mb-8">
        <NewAssetForm />
      </div>

      <AssetsTable assets={assets} />
    </div>
  );
}
