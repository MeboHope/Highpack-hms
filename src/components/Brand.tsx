import { Link } from '@/context/RouterContext';
import highparkLogo from '@/assets/highpark-logo.jpg';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="inline-flex shrink-0 items-center" aria-label="HighPark Consult Ltd">
      <img
        src={highparkLogo}
        alt="HighPark Consult Ltd"
        className={compact ? 'h-16 w-24 object-contain' : 'h-24 w-36 object-contain'}
      />
    </Link>
  );
}
