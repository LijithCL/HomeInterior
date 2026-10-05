import Link from 'next/link';
import { Logo } from '@/components/Logo';

const FEATURES = [
  {
    title: '2D Floor Plans',
    description: 'Draw walls, rooms, doors, and windows with precise real-world measurements.',
    icon: (
      <path d="M4 4h16v16H4z M4 12h16 M12 4v16" />
    ),
  },
  {
    title: '3D Walkthrough',
    description: 'See your design come to life with realistic furniture, lighting, and shadows.',
    icon: (
      <path d="M12 3 4 7.5v9L12 21l8-4.5v-9L12 3z M12 3v18 M4 7.5 12 12l8-4.5" />
    ),
  },
  {
    title: 'AI Design Assistant',
    description: 'Describe a room in plain language and get a starting layout in seconds.',
    icon: (
      <path d="M12 3v4 M12 17v4 M3 12h4 M17 12h4 M6 6l2.5 2.5 M15.5 15.5 18 18 M18 6l-2.5 2.5 M8.5 15.5 6 18" />
    ),
  },
  {
    title: 'Instant Photo Preview',
    description: 'Generate photo-style previews of every room as you design — no waiting.',
    icon: (
      <path d="M4 8h3l1.5-2h7L17 8h3v11H4z M12 18a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    ),
  },
];

const STEPS = [
  { label: 'Draw', description: 'Sketch your floor plan to scale in the 2D editor.' },
  { label: 'Visualize', description: 'Flip to 3D and furnish every room with real objects.' },
  { label: 'Share', description: 'Preview, render, and share the finished design with anyone.' },
];

export default function LandingPage() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="flex items-center gap-4">
            <Link href="/login" className="text-sm font-medium text-neutral-600 hover:text-neutral-900">
              Sign in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-dark"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-cream">
          <div className="bg-grid absolute inset-0 opacity-60" />
          <div
            className="animate-float-blob absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-light blur-3xl"
            aria-hidden
          />
          <div
            className="animate-float-blob absolute -bottom-24 left-[-6rem] h-72 w-72 rounded-full bg-sage-light blur-3xl [animation-delay:2s]"
            aria-hidden
          />

          <div className="relative mx-auto flex max-w-6xl flex-col items-center px-6 py-24 text-center">
            <span className="animate-fade-in-up mb-5 inline-flex items-center rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-dark">
              2D + 3D + AI Design Studio
            </span>
            <h1 className="animate-fade-in-up max-w-3xl text-4xl font-bold tracking-tight text-neutral-900 [animation-delay:80ms] sm:text-5xl">
              Design your dream home, <span className="text-accent">inside and out</span>
            </h1>
            <p className="animate-fade-in-up mt-5 max-w-xl text-lg text-neutral-600 [animation-delay:160ms]">
              Create 2D floor plans, walk through them in 3D, and manage every room from one place —
              with an AI assistant to help you lay it out.
            </p>
            <div className="animate-fade-in-up mt-8 flex flex-wrap items-center justify-center gap-3 [animation-delay:240ms]">
              <Link
                href="/register"
                className="rounded-md bg-accent px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-accent-dark hover:shadow-md"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="rounded-md border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition hover:-translate-y-0.5 hover:border-neutral-400"
              >
                Sign in
              </Link>
            </div>
            <p className="animate-fade-in-up mt-4 text-xs text-neutral-500 [animation-delay:320ms]">
              No credit card required.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
              Everything you need to design a home
            </h2>
            <p className="mt-3 text-neutral-600">
              From the first sketch to a finished, furnished walkthrough.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border border-neutral-200 bg-white p-6 transition hover:-translate-y-1 hover:border-accent-light hover:shadow-lg"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent-light text-accent-dark transition group-hover:bg-accent group-hover:text-white">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {feature.icon}
                  </svg>
                </div>
                <h3 className="mt-4 font-semibold text-neutral-900">{feature.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-sage-light py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">How it works</h2>
            </div>
            <div className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <div key={step.label} className="text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sage text-sm font-semibold text-white">
                    {i + 1}
                  </div>
                  <h3 className="mt-4 font-semibold text-neutral-900">{step.label}</h3>
                  <p className="mt-2 text-sm text-neutral-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-accent">
          <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold text-white sm:text-3xl">
              Ready to design your next home?
            </h2>
            <p className="max-w-md text-accent-light">
              Start with a blank floor plan and see it in 3D in minutes.
            </p>
            <Link
              href="/register"
              className="rounded-md bg-white px-6 py-3 text-sm font-semibold text-accent-dark shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              Get started free
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-sm text-neutral-500 sm:flex-row">
          <Logo />
          <p>© {new Date().getFullYear()} Home Interior. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
