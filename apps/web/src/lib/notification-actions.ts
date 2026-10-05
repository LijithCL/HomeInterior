'use server';

import { apiFetch } from '@/lib/api-client';
import { getAccessToken } from '@/lib/session';
import type { Notification } from '@/lib/notification-types';

export async function listNotificationsAction(): Promise<Notification[]> {
  const accessToken = await getAccessToken();
  return apiFetch<Notification[]>('/notifications', accessToken);
}

export async function unreadNotificationCountAction(): Promise<number> {
  const accessToken = await getAccessToken();
  const { count } = await apiFetch<{ count: number }>('/notifications/unread-count', accessToken);
  return count;
}

export async function markNotificationReadAction(id: string): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch(`/notifications/${id}/read`, accessToken, { method: 'PATCH' });
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const accessToken = await getAccessToken();
  await apiFetch('/notifications/read-all', accessToken, { method: 'PATCH' });
}
