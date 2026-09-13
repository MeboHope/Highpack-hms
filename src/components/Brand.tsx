import { Link } from '@/context/RouterContext';
import highparkLogo from '@/assets/highpark-logo-clean.png';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className={compact
        ? 'inline-flex min-w-0 shrink-0 items-center gap-3 rounded-2xl px-1 py-1.5 transition-transform hover:scale-[1.01]'
        : 'inline-flex items-center gap-4 rounded-2xl px-2 py-2'}
      aria-label="HighPark Consult Ltd — Strategy, Solutions, Success"
    >
      <span className={compact
        ? 'flex h-[62px] w-[78px] shrink-0 items-center justify-center overflow-visible rounded-xl bg-white ring-1 ring-ink-100 shadow-sm'
        : 'flex h-24 w-28 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-ink-100'}>
        <img
          src={highparkLogo}
          alt="HighPark Consult Ltd"
          className="h-full w-full object-contain"
        />
      </span>
      <span className={compact ? 'hidden min-w-0 lg:block' : 'block'}>
        <span className="block truncate text-[15px] font-extrabold leading-tight tracking-[0.08em] text-brand-950">HIGH<span className="text-accent-600">PARK</span></span>
        <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-500">Consult Ltd</span>
        <span className="mt-1 block text-[8px] font-bold uppercase tracking-[0.18em] text-brand-700">Strategy • Solutions • Success</span>
      </span>
    </Link>
  );
}
