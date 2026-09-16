import { Link } from '@/context/RouterContext';
import highparkLogo from '@/assets/highpark-logo-clean.png';

export function Brand({ compact = false, onDark = false, variant = 'default' }: { compact?: boolean; onDark?: boolean; variant?: 'default' | 'auth' }) {
  return (
    <Link
      to="/"
      className={`${variant === 'auth' ? 'auth-brand-lockup' : ''} ${compact
        ? 'inline-flex min-w-0 shrink-0 items-center gap-2 px-0.5 py-1 transition-transform hover:scale-[1.01] sm:gap-3'
        : 'inline-flex items-center gap-4 px-2 py-2'}`}
      aria-label="HighPark Consult Ltd — Strategy, Solutions, Success"
    >
      <span className={compact
        ? 'flex h-[54px] w-[60px] shrink-0 items-center justify-center overflow-hidden bg-white shadow-sm sm:h-[60px] sm:w-[70px]'
        : 'flex h-24 w-28 shrink-0 items-center justify-center bg-white'}>
        <img
          src={highparkLogo}
          alt="HighPark Consult Ltd"
          className="h-full w-full object-contain"
        />
      </span>
      <span className="block min-w-0">
        <span className={compact
          ? `block truncate text-[12px] font-extrabold leading-tight tracking-[0.09em] ${onDark ? 'text-white' : 'text-brand-950'} sm:text-[15px]`
          : `block truncate text-[15px] font-extrabold leading-tight tracking-[0.08em] ${onDark ? 'text-white' : 'text-brand-950'}`}>HIGH<span className="text-accent-600">PARK</span></span>
        <span className={compact
          ? `mt-0.5 block truncate text-[8px] font-semibold uppercase tracking-[0.2em] ${onDark ? 'text-white/80' : 'text-ink-500'} sm:text-[10px]`
          : `mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.22em] ${onDark ? 'text-white/80' : 'text-ink-500'}`}>Consult Ltd</span>
        <span className={compact
          ? `mt-0.5 block truncate text-[6px] font-bold uppercase tracking-[0.12em] ${onDark ? 'text-accent-300' : 'text-brand-700'} sm:text-[8px] sm:tracking-[0.18em]`
          : `mt-1 block text-[8px] font-bold uppercase tracking-[0.18em] ${onDark ? 'text-accent-300' : 'text-brand-700'}`}>Strategy • Solutions • Success</span>
      </span>
    </Link>
  );
}
