import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface RouterContextValue {
  path: string;
  navigate: (to: string) => void;
}

export const RouterContext = createContext<RouterContextValue | undefined>(undefined);

function getHashPath(): string {
  const hash = window.location.hash.replace(/^#/, '');
  const query = new URLSearchParams(window.location.search);

  // Supabase password-recovery callbacks arrive in the URL fragment
  // (access_token=...&type=recovery...). Our app also uses the hash for
  // client-side routing, so detect that callback before interpreting it as
  // a normal route. Supabase establishes the recovery session automatically.
  if (
    hash.startsWith('access_token=') ||
    hash.includes('type=recovery') ||
    query.get('auth') === 'recovery'
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

    // The recovery query is only a bootstrap signal. Remove it after the
    // initial route decision so later hash navigation can work normally.
    if (new URLSearchParams(window.location.search).get('auth') === 'recovery') {
      const cleanUrl = `${window.location.pathname}${window.location.hash}`;
      window.history.replaceState({}, document.title, cleanUrl || '/');
    }

    if (!window.location.hash) window.location.hash = '#/';
    return () => window.removeEventListener('hashchange', onHashChange);
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
