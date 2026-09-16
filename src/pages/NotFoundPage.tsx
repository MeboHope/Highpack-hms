import { ArrowLeft, Home, Search } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';

export function NotFoundPage() {
  const { navigate } = useRouter();
  return (
    <div className="relative flex min-h-[68vh] items-center overflow-hidden bg-ink-50 px-4 py-16 sm:px-6 lg:px-8">
      <div className="absolute -right-24 top-12 h-72 w-72 rounded-full bg-brand-200/30 blur-3xl" />
      <div className="absolute -left-24 bottom-0 h-64 w-64 rounded-full bg-accent-200/30 blur-3xl" />
      <div className="relative mx-auto w-full max-w-3xl text-center">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-950 text-white shadow-[0_18px_50px_rgba(7,25,53,0.18)]">
          <Search className="h-7 w-7" />
        </div>
        <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-accent-700">HighPark Consult</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight text-brand-950 sm:text-7xl">404</h1>
        <h2 className="mt-3 text-2xl font-bold text-ink-900 sm:text-3xl">That page is not available.</h2>
        <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-ink-500 sm:text-base">
          The address may have changed, or the page may no longer be available. Continue from the marketplace or return to the HighPark Consult home page.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-primary"><Home className="h-4 w-4" /> Home</Link>
          <Link to="/properties" className="btn-secondary"><Search className="h-4 w-4" /> Browse opportunities</Link>
          <button type="button" onClick={() => { if (window.history.length > 1) window.history.back(); else navigate("/"); }} className="btn-ghost"><ArrowLeft className="h-4 w-4" /> Go back</button>
        </div>
      </div>
    </div>
  );
}
