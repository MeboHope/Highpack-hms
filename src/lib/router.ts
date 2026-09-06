import { useRouter } from '@/context/hooks';

export function useHashRoute() {
  const { path, navigate } = useRouter();
  return { path, navigate };
}
