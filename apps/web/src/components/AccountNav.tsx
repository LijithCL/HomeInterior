import Link from 'next/link';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { logoutAction } from '@/lib/auth-actions';

const LINKS = [
  { href: '/dashboard', label: 'My Work' },
  { href: '/teams', label: 'Teams' },
  { href: '/billing', label: 'Billing' },
  { href: '/profile', label: 'Profile' },
  { href: '/settings', label: 'Settings' },
];

export function AccountNav({ active, extra }: { active?: string; extra?: React.ReactNode }) {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="flex items-center justify-between px-6 py-4 sm:px-10">
        <Logo />
        <nav className="flex items-center gap-4 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={active === link.href ? 'font-medium text-accent' : 'text-neutral-500 hover:text-accent'}
            >
              {link.label}
            </Link>
          ))}
          {extra}
          <NotificationBell />
          <form action={logoutAction}>
            <button type="submit" className="text-neutral-500 hover:text-accent">
              Sign out
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
