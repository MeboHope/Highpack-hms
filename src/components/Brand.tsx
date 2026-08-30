import { Link } from '@/context/RouterContext';
import highparkLogo from '@/assets/highpark-logo.jpg';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      to="/"
      className="inline-flex items-center shrink-0"
      aria-label="HighPark Consult Ltd"
    >
      <img
        src={highparkLogo}
        alt="HighPark Consult Ltd"
        className={
          compact
            ? 'w-16 h-16 object-contain'
            : 'w-20 h-20 object-contain'
        }
      />
    </Link>
  );
}