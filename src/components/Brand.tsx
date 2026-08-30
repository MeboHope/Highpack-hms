import { Link } from 'react-router-dom';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="flex items-center gap-3 group"
      aria-label="HighPark Consult Ltd"
    >
      <img
        src="/highpark-logo.png"
        alt="HighPark Consult Ltd"
        className={
          compact
            ? 'h-10 w-auto object-contain'
            : 'h-12 w-auto object-contain'
        }
      />

      {!compact && (
        <div className="hidden sm:block leading-tight">
          <div className="font-serif text-lg font-bold tracking-wide text-[#0B2A55]">
            HIGHPARK
          </div>
          <div className="text-[9px] tracking-[0.25em] text-[#C99A2E]">
            CONSULT LTD
          </div>
        </div>
      )}
    </Link>
  );
}