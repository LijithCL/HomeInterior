import { Logo } from '@/components/Logo';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="bg-grid relative flex min-h-screen items-center justify-center bg-cream px-4">
      <div className="animate-float-blob absolute -right-20 -top-20 h-64 w-64 rounded-full bg-accent-light blur-3xl" aria-hidden />
      <div className="animate-float-blob absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-sage-light blur-3xl [animation-delay:2s]" aria-hidden />

      <div className="animate-fade-in-up relative flex w-full max-w-sm flex-col items-center">
        <Logo className="mb-6" />
        <div className="w-full rounded-xl border border-neutral-200 bg-white p-8 shadow-xl">
          <h1 className="mb-6 text-xl font-semibold text-neutral-900">Sign in</h1>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
