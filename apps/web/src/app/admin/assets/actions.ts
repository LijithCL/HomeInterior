'use server';

import { revalidatePath } from 'next/cache';
import { apiFetch, apiFetchRaw, ApiError } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';

export interface AssetFormState {
  error?: string;
}

export async function createAssetAction(
  _prevState: AssetFormState,
  formData: FormData,
): Promise<AssetFormState> {
  const accessToken = await getAccessToken();

  let thumbnailKey: string | undefined;
  const file = formData.get('thumbnail');
  if (file instanceof File && file.size > 0) {
    const uploadForm = new FormData();
    uploadForm.set('file', file);
    const uploadRes = await apiFetchRaw('/uploads/images', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
      body: uploadForm,
    });
    if (!uploadRes.ok) {
      const body = await uploadRes.json().catch(() => ({ message: 'Upload failed' }));
      return { error: body.message ?? 'Upload failed' };
    }
    const uploadData: { key: string } = await uploadRes.json();
    thumbnailKey = uploadData.key;
  }

  const priceDollars = formData.get('priceDollars');
  const priceCents = priceDollars && String(priceDollars).trim() ? Math.round(Number(priceDollars) * 100) : undefined;
  const vendorName = String(formData.get('vendorName') ?? '').trim() || undefined;
  const vendorUrl = String(formData.get('vendorUrl') ?? '').trim() || undefined;

  try {
    await apiFetch('/assets', accessToken, {
      method: 'POST',
      body: JSON.stringify({
        category: formData.get('category'),
        name: formData.get('name'),
        defaultWidthMm: Number(formData.get('defaultWidthMm')),
        defaultDepthMm: Number(formData.get('defaultDepthMm')),
        defaultHeightMm: Number(formData.get('defaultHeightMm')),
        color: formData.get('color'),
        thumbnailKey,
        priceCents,
        vendorName,
        vendorUrl,
      }),
    });
  } catch (err) {
    return { error: err instanceof ApiError ? err.message : 'Could not create asset' };
  }

  revalidatePath('/admin/assets');
  return {};
}

export async function updateAssetAction(
  id: string,
  patch: {
    name?: string;
    defaultWidthMm?: number;
    defaultDepthMm?: number;
    defaultHeightMm?: number;
    color?: string;
    priceCents?: number;
    vendorName?: string;
    vendorUrl?: string;
  },
) {
  const accessToken = await getAccessToken();
  await apiFetch(`/assets/${id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  revalidatePath('/admin/assets');
}

// The API's DELETE is a soft-deactivate (isActive: false) rather than a hard
// delete, so this single action covers both "delete" and "reactivate" from
// the UI's perspective.
export async function setAssetActiveAction(id: string, isActive: boolean) {
  const accessToken = await getAccessToken();
  await apiFetch(`/assets/${id}`, accessToken, {
    method: 'PATCH',
    body: JSON.stringify({ isActive }),
  });
  revalidatePath('/admin/assets');
}
