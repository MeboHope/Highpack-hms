import { Link } from '@/context/RouterContext';
import highparkLogo from '@/assets/highpark-logo-clean.png';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className={compact
        ? 'inline-flex min-w-0 shrink-0 items-center gap-2 px-0.5 py-1 transition-transform hover:opacity-90 sm:gap-3'
        : 'inline-flex items-center gap-4 px-2 py-2'}
      aria-label="HighPark Consult Ltd — Strategy, Solutions, Success"
      style={{ borderRadius: '2px' }}
    >
      <span className={compact
        ? 'flex h-[48px] w-[54px] shrink-0 items-center justify-center overflow-hidden bg-white border border-ink-100 sm:h-[52px] sm:w-[60px]'
        : 'flex h-20 w-24 shrink-0 items-center justify-center bg-white border border-ink-100'}
        style={{ borderRadius: '2px' }}>
        <img
          src={highparkLogo}
          alt="HighPark Consult Ltd"
          className="h-full w-full object-contain"
          loading="eager"
          decoding="async"
        />
      </span>
      <span className="block min-w-0">
        <span className={compact
          ? 'block truncate text-[12px] font-extrabold leading-tight tracking-[0.08em] text-brand-950 sm:text-[14px]'
          : 'block truncate text-[15px] font-extrabold leading-tight tracking-[0.08em] text-brand-950'}>HIGH<span className="text-accent-600">PARK</span></span>
        <span className={compact
          ? 'mt-0.5 block truncate text-[8px] font-semibold uppercase tracking-[0.18em] text-ink-500 sm:text-[9px]'
          : 'mt-0.5 block text-[10px] font-semibold uppercase tracking-[0.20em] text-ink-500'}>Consult Ltd</span>
        <span className={compact
          ? 'mt-0.5 block truncate text-[6px] font-bold uppercase tracking-[0.12em] text-brand-700 sm:text-[7px] sm:tracking-[0.16em]'
          : 'mt-1 block text-[8px] font-bold uppercase tracking-[0.16em] text-brand-700'}>Strategy • Solutions • Success</span>
      </span>
    </Link>
  );
}
