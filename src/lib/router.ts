import { useRouter } from '@/context/RouterContext';

export function useHashRoute() {
  const { path, navigate } = useRouter();
  return { path, navigate };
}
