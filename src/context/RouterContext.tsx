import { createContext, useContext, useEffect, useState, type ReactNode, type CSSProperties, type AnchorHTMLAttributes } from 'react';
import { supabase } from '@/lib/supabase';

interface RouterContextValue {
  path: string;
  navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterContextValue | undefined>(undefined);

function getHashPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const query = new URLSearchParams(window.location.search);

  if (
    window.location.pathname === '/reset-password' ||
    hash.startsWith('access_token=') ||
    hash.includes('type=recovery') ||
    hash.includes('type=invite') ||
    query.get('auth') === 'recovery' ||
    query.get('type') === 'recovery' ||
    query.get('type') === 'invite' ||
    query.has('token_hash') ||
    query.has('code')
  ) {
    return '/reset-password';
  }

  return hash || '/';
}

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(getHashPath());

  useEffect(() => {
    const onHashChange = () => {
      setPath(getHashPath());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHashChange);

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPath('/reset-password');
        window.scrollTo(0, 0);
      }
    });

    const queryParams = new URLSearchParams(window.location.search);
    const isAuthCallback = queryParams.get('auth') === 'recovery' ||
      queryParams.get('type') === 'invite' ||
      queryParams.get('type') === 'recovery' ||
      queryParams.has('token_hash') ||
      queryParams.has('code') ||
      window.location.hash.includes('type=invite') ||
      window.location.hash.includes('type=recovery') ||
      window.location.hash.includes('access_token=');

    if (isAuthCallback && window.location.pathname === '/reset-password') {
      const callback = `${window.location.search}${window.location.hash}`;
      window.history.replaceState({}, document.title, `/#/reset-password${callback}`);
      setPath('/reset-password');
    }

    if (!window.location.hash) window.location.hash = '#/';
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const navigate = (to: string) => {
    window.location.hash = to.startsWith('#') ? to : `#${to}`;
  };

  return (
    <RouterContext.Provider value={{ path, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

function useRouterInternal() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}

interface LinkProps {
  to: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  [key: string]: unknown;
}

export function Link({ to, children, className, style, onClick, ...rest }: LinkProps) {
  const { navigate } = useRouterInternal();
  return (
    <a
      href={`#${to}`}
      className={className}
      style={style as CSSProperties}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
        navigate(to);
      }}
      {...(rest as AnchorHTMLAttributes<HTMLAnchorElement>)}
    >
      {children}
    </a>
  );
}
