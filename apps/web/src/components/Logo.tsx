import Link from 'next/link';

export function Logo({ className = '', href = '/' }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 ${className}`}>
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M5.5 10v9.5h13V10" />
          <path d="M9.5 19.5v-6h5v6" />
        </svg>
      </span>
      <span className="text-base font-semibold text-neutral-900">Home Interior</span>
    </Link>
  );
}
