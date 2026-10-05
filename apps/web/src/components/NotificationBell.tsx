'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { Notification } from '@/lib/notification-types';
import {
  listNotificationsAction,
  unreadNotificationCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/lib/notification-actions';

const POLL_INTERVAL_MS = 20000;

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    function poll() {
      unreadNotificationCountAction()
        .then((count) => {
          if (!cancelled) setUnreadCount(count);
        })
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      const list = await listNotificationsAction().catch(() => []);
      setNotifications(list);
    }
  }

  async function markAllRead() {
    await markAllNotificationsReadAction();
    setUnreadCount(0);
    setNotifications((prev) => (prev ?? []).map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
  }

  async function handleClickNotification(notification: Notification) {
    if (!notification.readAt) {
      await markNotificationReadAction(notification.id);
      setUnreadCount((c) => Math.max(0, c - 1));
      setNotifications((prev) =>
        (prev ?? []).map((n) => (n.id === notification.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
    }
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        className="relative text-neutral-500 hover:text-accent"
      >
        Notifications
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-80 rounded-md border border-neutral-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2">
            <span className="text-xs font-semibold text-neutral-700">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-accent hover:underline">
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications === null && <p className="p-3 text-xs text-neutral-400">Loading…</p>}
            {notifications !== null && notifications.length === 0 && (
              <p className="p-3 text-xs text-neutral-400">No notifications yet.</p>
            )}
            {(notifications ?? []).map((notification) => {
              const content = (
                <div
                  className={`flex flex-col gap-0.5 border-b border-neutral-50 px-3 py-2 text-xs last:border-0 hover:bg-neutral-50 ${
                    notification.readAt ? 'text-neutral-500' : 'text-neutral-900'
                  }`}
                >
                  <span className={notification.readAt ? '' : 'font-medium'}>{notification.title}</span>
                  <span className="text-neutral-400">{timeAgo(notification.createdAt)}</span>
                </div>
              );
              return notification.linkPath ? (
                <Link
                  key={notification.id}
                  href={notification.linkPath}
                  onClick={() => handleClickNotification(notification)}
                >
                  {content}
                </Link>
              ) : (
                <div key={notification.id} onClick={() => handleClickNotification(notification)}>
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
