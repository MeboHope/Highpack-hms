import { Link } from '@/context/RouterContext';
import highparkLogo from '@/assets/highpark-logo-clean.png';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center" aria-label="HighPark Consult Ltd">
      <img
        src={highparkLogo}
        alt="HighPark Consult Ltd"
        className={compact ? 'h-24 w-32 object-contain' : 'h-32 w-44 object-contain'}
      />
    </Link>
  );
}
