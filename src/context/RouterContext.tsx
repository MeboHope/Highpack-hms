import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';

interface RouterContextValue {
  path: string;
  navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterContextValue | undefined>(undefined);

function getHashPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const query = new URLSearchParams(window.location.search);

  // Supabase password-recovery and staff-invitation callbacks arrive in the URL fragment
  // (access_token=...&type=recovery...). Our app also uses the hash for
  // client-side routing, so detect that callback before interpreting it as
  // a normal route. Supabase establishes the recovery session automatically.
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

    // Supabase emits PASSWORD_RECOVERY after it exchanges the recovery
    // callback for a session. This is the authoritative signal that a valid
    // password-reset session exists, so it also works when the provider or
    // browser normalises the callback URL differently.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setPath('/reset-password');
        window.scrollTo(0, 0);
      }
    });

    // Supabase invitation/recovery links may arrive as a real pathname such as
    // /reset-password rather than a hash route. Keep that pathname long enough
    // for getHashPath() to recognise the callback, then normalise the browser URL
    // into the app's hash router without losing the callback tokens.
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

export function Link({ to, children, className, onClick }: { to: string; children: ReactNode; className?: string; onClick?: () => void }) {
  const { navigate } = useRouterInternal();
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onClick?.();
        navigate(to);
      }}
    >
      {children}
    </a>
  );
}
