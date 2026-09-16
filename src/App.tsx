import { AuthProvider } from '@/context/AuthContext';
import { useAuth } from '@/context/hooks';
import { ToastProvider } from '@/context/ToastContext';
import { RouterProvider } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';
import { Header, Footer } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { PropertyDetailsPage } from '@/pages/PropertyDetailsPage';
import { AuthPage } from '@/pages/AuthPage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/PasswordPages';
import { AboutPage, ContactPage, FAQsPage } from '@/pages/StaticPages';
import { FavoritesPage, NotificationsPage, StaysPage } from '@/pages/AccountPages';
import {
  OwnerDashboard, OwnerProperties, OwnerUnits, OwnerReservations, OwnerExpenses,
  OwnerTax, OwnerMaintenance, OwnerTenants, OwnerPayments, OwnerReports, OwnerSettings,
} from '@/pages/OwnerPages';
import {
  TenantDashboard, TenantRent, TenantMaintenance, TenantLease, TenantHouse,
  TenantMessages, TenantSettings, TenantReservations, TenantViewings,
} from '@/pages/TenantPages';
import {
  AdminDashboard, AdminProperties, AdminPropertyDetail, AdminUsers, AdminReservations, AdminPayments, AdminSettings, AdminUnits, AdminTax, AdminExpenses, AdminMaintenance, AdminLeases, AdminActivity,
} from '@/pages/AdminPages';
import { AdminDocuments, OwnerDocuments, TenantDocuments } from '@/pages/DocumentPages';
import { OwnerMessages } from '@/pages/OwnerMessages';
import { AdminKra } from '@/pages/AdminKra';
import { AdminStaffPage } from '@/pages/AdminStaffPage';
import { AdminPortfolio, OwnerPortfolio } from '@/pages/PortfolioPages';
import { ShortStayOperations } from '@/pages/ShortStayPages';
import { AdminSales, OwnerSales } from '@/pages/SalesPages';
import React, { useEffect, type JSX } from 'react';
import { ShieldCheck } from 'lucide-react';
import highparkLogo from '@/assets/highpark-logo-clean.png';
import { PropertyAIChat } from '@/components/PropertyAIChat';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { MFAPage } from '@/pages/MFAPage';
import { SecurityPage } from '@/pages/SecurityPage';
import { hasStaffPermission, canStaffAccessProperty, ADMIN_PERMISSION } from '@/lib/staffAccess';
import { isRoleHostAllowed, expectedRoleArea, roleSubdomain } from '@/lib/roleSubdomains';
import { supabase } from '@/lib/supabase';


function ScrollRevealObserver() {
  const { path } = useRouter();

  useEffect(() => {
    // Observe the complete rendered application rather than only selected
    // cards/sections. This deliberately includes the lower portions of long
    // pages, footers, tables, controls and dynamically-created content.
    const root = document.getElementById('root');
    if (!root) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsObserver = 'IntersectionObserver' in window;
    // Phase 50 intentionally broadens the target from selected components to
    // every rendered visual element inside main/footer. This catches lower
    // homepage/about-page content and custom div-based sections that do not
    // carry semantic section/card classes. SVG internals and non-visual nodes
    // are excluded below so icons do not animate piece-by-piece.
    const selector = [
      'main *',
      'footer *',
      '[data-scroll-reveal]', '[data-live-motion]'
    ].join(',');
    const candidates = new Set<HTMLElement>();

    const isMotionExcluded = (element: HTMLElement) => {
      const tag = element.tagName.toLowerCase();
      return element.closest('script,style,noscript,[aria-hidden="true"],.site-header') !== null ||
        element.classList.contains('scroll-progress') ||
        tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'line' ||
        tag === 'polyline' || tag === 'polygon' || tag === 'rect' || tag === 'defs' ||
        tag === 'title' || tag === 'desc' || tag === 'source' || tag === 'track';
    };

    const isRenderable = (element: HTMLElement) => {
      if (isMotionExcluded(element)) return false;
      if (element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0 || element.matches('input,select,textarea,button,a');
    };

    const collect = (scope: ParentNode) => {
      if (scope instanceof HTMLElement && scope.matches(selector) && isRenderable(scope)) {
        candidates.add(scope);
      }
      scope.querySelectorAll<HTMLElement>(selector).forEach((element) => {
        if (isRenderable(element)) candidates.add(element);
      });
    };
    collect(root);

    const reveal = (element: HTMLElement) => {
      element.classList.add('hp-live-visible');
      element.classList.remove('hp-live-pending');
    };

    if (reducedMotion || !supportsObserver) {
      candidates.forEach((element) => {
        element.classList.add('hp-live-motion');
        reveal(element);
      });
      return;
    }

    let sequence = 0;
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const element = entry.target as HTMLElement;
        reveal(element);
        currentObserver.unobserve(element);
      });
    }, { threshold: 0.02, rootMargin: '0px 0px -8% 0px' });

    const observeCandidates = () => {
      candidates.forEach((element) => {
        if (element.classList.contains('hp-live-motion')) return;
        element.classList.add('hp-live-motion', 'hp-live-pending');
        // Restart the rhythm on each rendered route while keeping nearby
        // objects subtly staggered instead of making the page feel random.
        const delay = Math.min(sequence % 8, 7) * 40;
        element.style.setProperty('--hp-live-delay', `${delay}ms`);
        sequence += 1;
        observer.observe(element);
      });
    };
    observeCandidates();

    const mutationObserver = new MutationObserver((mutations) => {
      let changed = false;
      mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement)) return;
        collect(node);
        changed = true;
      }));
      if (changed) observeCandidates();
    });
    mutationObserver.observe(root, { childList: true, subtree: true });

    // Safety net: content is never allowed to remain invisible if a browser
    // delays IntersectionObserver work or a very tall page is opened directly.
    const fallbackTimer = window.setTimeout(() => {
      candidates.forEach((element) => {
        element.classList.add('hp-live-motion');
        if (!element.classList.contains('hp-live-visible')) reveal(element);
      });
    }, 4200);

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
      window.clearTimeout(fallbackTimer);
    };
  }, [path]);

  return null;
}

function ScrollProgress() {
  const [progress, setProgress] = React.useState(0);

  useEffect(() => {
    const update = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const next = scrollable > 0 ? (window.scrollY / scrollable) * 100 : 0;
      setProgress(Math.min(100, Math.max(0, next)));
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return <div className="scroll-progress" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message: string }> {
  state = { hasError: false, message: '' };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error?.message || 'An unexpected application error occurred.' };
  }
  componentDidCatch(error: Error) {
    console.error('HighPark application render error:', error);
  }
  render() {
    if (this.state.hasError) {
      return <div className="min-h-screen bg-ink-50 px-6 py-16 text-center"><div className="mx-auto max-w-xl rounded-3xl border border-red-100 bg-white p-8 shadow-soft-lg"><div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-red-600">!</div><h1 className="text-2xl font-bold text-ink-900">HighPark Consult could not load this page</h1><p className="mt-3 text-sm leading-6 text-ink-500">A page component encountered an unexpected error. Refresh the page and try again.</p><details className="mt-5 text-left"><summary className="cursor-pointer text-xs font-semibold text-ink-500">Technical details</summary><pre className="mt-2 overflow-auto rounded-xl bg-ink-50 p-3 text-xs text-red-700">{this.state.message}</pre></details><button type="button" onClick={() => window.location.reload()} className="btn-primary mt-6">Refresh page</button></div></div>;
    }
    return this.props.children;
  }
}

function SessionSecurityGuard() {
  const { session, signOut } = useAuth();
  const { path, navigate } = useRouter();
  const [secondsLeft, setSecondsLeft] = React.useState<number | null>(null);

  useEffect(() => {
    if (!session || path === '/mfa') return;
    let active = true;
    const enforceMfaStepUp = async () => {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!active || data?.currentLevel === 'aal2' || data?.nextLevel !== 'aal2') return;
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const hasVerifiedFactor = [...(factors?.totp ?? []), ...(factors?.phone ?? [])].some((factor) => factor.status === 'verified');
      if (hasVerifiedFactor && active) navigate('/mfa');
    };
    void enforceMfaStepUp();
    return () => { active = false; };
  }, [session, path, navigate]);

  useEffect(() => {
    if (!session) { setSecondsLeft(null); return; }
    const idleLimit = 15 * 60 * 1000;
    const warningWindow = 2 * 60 * 1000;
    let lastActivity = Date.now();
    let warningShown = false;
    const activity = () => { lastActivity = Date.now(); warningShown = false; setSecondsLeft(null); };
    const events = ['pointerdown', 'keydown', 'touchstart', 'scroll', 'mousemove'] as const;
    events.forEach((event) => window.addEventListener(event, activity, { passive: true }));
    const tick = () => {
      const idleFor = Date.now() - lastActivity;
      const remaining = Math.max(0, idleLimit - idleFor);
      if (remaining <= warningWindow && remaining > 0 && !warningShown) { warningShown = true; }
      setSecondsLeft(remaining <= warningWindow ? Math.ceil(remaining / 1000) : null);
      if (remaining <= 0) void signOut('local');
    };
    const timer = window.setInterval(tick, 1000);
    const onVisibility = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVisibility);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisibility); events.forEach((event) => window.removeEventListener(event, activity)); };
  }, [session, signOut]);

  if (!session || secondsLeft === null || secondsLeft <= 0) return null;
  return <div className="fixed inset-x-4 bottom-4 z-[100] mx-auto max-w-md rounded-2xl border border-amber-200 bg-white p-4 shadow-soft-lg" role="status"><div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" /><div className="min-w-0"><p className="font-semibold text-brand-950">Your session is about to expire</p><p className="mt-1 text-sm text-ink-500">For your protection, HighPark will sign you out after inactivity. Move the pointer or press a key to stay signed in. About {secondsLeft}s remaining.</p></div></div></div>;
}

function PageMeta() {
  const { path } = useRouter();
  useEffect(() => {
    const cleanPath = path.split('?')[0];
    const meta: Record<string, { title: string; description: string }> = {
      '/': {
        title: 'HighPark Consult | Verified Property, Land & Investment Opportunities in Kenya',
        description: 'Discover verified homes, land, plots, commercial spaces, mixed-use opportunities and short stays across Kenya. Explore with confidence and move forward with clarity.',
      },
      '/properties': {
        title: 'Verified Property Marketplace | Homes, Land, Plots & Stays | HighPark Consult',
        description: 'Browse verified homes, land, plots, commercial spaces, mixed-use assets and short-stay opportunities across Kenya.',
      },
      '/about': {
        title: 'About HighPark Consult | A More Trusted Way to Navigate Property in Kenya',
        description: 'Learn how HighPark Consult connects property discovery, transactions and professional property management across Kenya.',
      },
      '/contact': {
        title: 'Contact HighPark Consult | Property & Real Estate Support in Kenya',
        description: 'Connect with HighPark Consult for property enquiries, viewings, management services and real estate support in Kenya.',
      },
      '/faqs': {
        title: 'FAQs | HighPark Consult',
        description: 'Find answers about verified properties, enquiries, reservations, tenancy, payments and property services with HighPark Consult.',
      },
      '/login': {
        title: 'Sign In | HighPark Consult',
        description: 'Sign in to your HighPark Consult account to continue your property, tenancy or management journey.',
      },
      '/register': {
        title: 'Create Your HighPark Consult Account',
        description: 'Create a HighPark Consult account to save opportunities, make enquiries and continue your property journey online.',
      },
    };
    const fallback = cleanPath.startsWith('/property/')
      ? { title: 'Property Opportunity | HighPark Consult', description: 'View property details, location, availability and next steps with HighPark Consult.' }
      : { title: 'HighPark Consult | Property & Real Estate in Kenya', description: 'Discover verified property opportunities and professional property services with HighPark Consult.' };
    const current = meta[cleanPath] || fallback;
    document.title = current.title;

    const setMeta = (selector: string, content: string) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute('content', content);
    };
    setMeta('meta[name="description"]', current.description);
    setMeta('meta[property="og:title"]', current.title);
    setMeta('meta[property="og:description"]', current.description);
    setMeta('meta[name="twitter:title"]', current.title);
    setMeta('meta[name="twitter:description"]', current.description);
  }, [path]);
  return null;
}

function PublicLayout({ children }: { children: JSX.Element }) {
  const { path } = useRouter();
  return (
    <div className="public-site min-h-screen flex flex-col">
      <PageMeta />
      <Header />
      <main key={path} className="flex-1 hp-page-enter">{children}</main>
      <Footer />
      <PropertyAIChat />
    </div>
  );
}

function AccessDenied() {
  const { navigate } = useRouter();
  return (
    <PublicLayout>
      <div className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-4 text-center">
        <div className="mb-5 rounded-2xl bg-red-50 px-5 py-3 text-sm font-semibold text-red-700">Access restricted</div>
        <h1 className="text-3xl font-bold text-brand-950">You do not have permission to view this page.</h1>
        <p className="mt-3 text-ink-500">Please sign in with an account that has the required access.</p>
        <button type="button" onClick={() => navigate('/')} className="btn-primary mt-7">Return Home</button>
      </div>
    </PublicLayout>
  );
}

function Routes() {
  const { path } = useRouter();
  const { profile, staffAccess, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (path === '/login') return <AuthPage mode="login" />;
  if (path === '/register') return <AuthPage mode="register" />;
  if (path === '/forgot-password') return <ForgotPasswordPage />;
  if (path === '/reset-password') return <ResetPasswordPage />;
  const isOwner = profile?.role === 'owner' || profile?.role === 'agent' || (profile?.role === 'admin' && staffAccess.isSuperAdmin);
  const isTenant = profile?.role === 'customer' || (profile?.role === 'admin' && staffAccess.isSuperAdmin);
  const isAdmin = profile?.role === 'admin';

  if (path === '/mfa') return profile ? <MFAPage /> : <AuthPage mode="login" />;
  if (path === '/security') return profile ? <SecurityPage /> : <AuthPage mode="login" />;

  // Hostname-aware role isolation. The public domain remains available for
  // discovery; configured role subdomains are accepted only by the matching
  // authenticated role. Database/RLS permissions remain the authoritative
  // security boundary.
  if (profile && !isRoleHostAllowed(profile, staffAccess)) {
    const area = expectedRoleArea(profile, staffAccess);
    return (
      <PublicLayout>
        <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="section-kicker">Secure workspace routing</p>
          <h1 className="mt-2 text-3xl font-bold text-brand-950">This workspace belongs to another role.</h1>
          <p className="mt-3 max-w-xl text-sm leading-7 text-ink-500">For security, role-specific workspaces are isolated by subdomain. Continue to your assigned HighPark workspace.</p>
          <a className="btn-primary mt-7" href={`https://${roleSubdomain(area)}`}>Open my secure workspace</a>
        </div>
      </PublicLayout>
    );
  }

  const isProtectedPath =
    path === '/tenant' || path.startsWith('/tenant/') ||
    path === '/owner' || path.startsWith('/owner/') ||
    path === '/admin' || path.startsWith('/admin/') ||
    path === '/favorites' || path === '/notifications' || path === '/stays';

  if (isProtectedPath && !profile) return <AuthPage mode="login" />;

  // Owner / property-manager routes
  if (path === '/owner') return isOwner ? <OwnerDashboard /> : <AccessDenied />;
  if (path === '/owner/properties') return isOwner ? <OwnerProperties /> : <AccessDenied />;
  if (path.startsWith('/owner/units/')) return isOwner ? <OwnerUnits propertyId={path.split('/owner/units/')[1]} /> : <AccessDenied />;
  if (path === '/owner/reservations') return isOwner ? <OwnerReservations /> : <AccessDenied />;
  if (path === '/owner/expenses') return isOwner ? <OwnerExpenses /> : <AccessDenied />;
  if (path === '/owner/tax') return isOwner ? <OwnerTax /> : <AccessDenied />;
  if (path === '/owner/maintenance') return isOwner ? <OwnerMaintenance /> : <AccessDenied />;
  if (path === '/owner/tenants') return isOwner ? <OwnerTenants /> : <AccessDenied />;
  if (path === '/owner/payments') return isOwner ? <OwnerPayments /> : <AccessDenied />;
  if (path === '/owner/reports') return isOwner ? <OwnerReports /> : <AccessDenied />;
  if (path === '/owner/settings') return isOwner ? <OwnerSettings /> : <AccessDenied />;
  if (path === '/owner/messages') return isOwner ? <OwnerMessages /> : <AccessDenied />;
  if (path === '/owner/documents') return isOwner ? <OwnerDocuments /> : <AccessDenied />;
  if (path === '/owner/portfolio') return isOwner ? <OwnerPortfolio /> : <AccessDenied />;
  if (path === '/owner/short-stay') return isOwner ? <ShortStayOperations ownerOnly /> : <AccessDenied />;
  if (path === '/owner/sales') return isOwner ? <OwnerSales /> : <AccessDenied />;

  // Tenant routes
  if (path === '/tenant') return isTenant ? <TenantDashboard /> : <AccessDenied />;
  if (path === '/tenant/reservations') return isTenant ? <TenantReservations /> : <AccessDenied />;
  if (path === '/tenant/viewings') return isTenant ? <TenantViewings /> : <AccessDenied />;
  if (path === '/tenant/house') return isTenant ? <TenantHouse /> : <AccessDenied />;
  if (path === '/tenant/rent') return isTenant ? <TenantRent /> : <AccessDenied />;
  if (path === '/tenant/maintenance') return isTenant ? <TenantMaintenance /> : <AccessDenied />;
  if (path === '/tenant/lease') return isTenant ? <TenantLease /> : <AccessDenied />;
  if (path === '/tenant/messages') return isTenant ? <TenantMessages /> : <AccessDenied />;
  if (path === '/tenant/settings') return isTenant ? <TenantSettings /> : <AccessDenied />;
  if (path === '/tenant/documents') return isTenant ? <TenantDocuments /> : <AccessDenied />;

  // Admin routes. Operational staff are allowed only through their assigned
  // permission set; Super Admin remains unrestricted.
  const adminAllowed = (permission: string) => isAdmin && hasStaffPermission(staffAccess, permission);
  const adminPropertyAllowed = (permission: string, propertyId: string | null) => isAdmin && canStaffAccessProperty(staffAccess, propertyId, permission);

  if (path === '/admin') return adminAllowed(ADMIN_PERMISSION.dashboard) ? <AdminDashboard /> : <AccessDenied />;
  if (path.startsWith('/admin/properties/')) {
    const propertyId = path.split('/admin/properties/')[1].split('?')[0];
    return adminPropertyAllowed(ADMIN_PERMISSION.propertiesView, propertyId) ? <AdminPropertyDetail propertyId={propertyId} /> : <AccessDenied />;
  }
  if (path === '/admin/properties' || path.startsWith('/admin/properties?')) return adminAllowed(ADMIN_PERMISSION.propertiesView) ? <AdminProperties /> : <AccessDenied />;
  if (path === '/admin/units' || path.startsWith('/admin/units?')) return adminAllowed(ADMIN_PERMISSION.unitsView) ? <AdminUnits /> : <AccessDenied />;
  if (path === '/admin/users' || path.startsWith('/admin/users?')) return staffAccess.isSuperAdmin ? <AdminUsers /> : <AccessDenied />;
  if (path === '/admin/staff' || path.startsWith('/admin/staff?')) return staffAccess.isSuperAdmin ? <AdminStaffPage /> : <AccessDenied />;
  if (path === '/admin/leases' || path.startsWith('/admin/leases?')) return adminAllowed(ADMIN_PERMISSION.leasesView) ? <AdminLeases /> : <AccessDenied />;
  if (path === '/admin/reservations') return adminAllowed(ADMIN_PERMISSION.reservationsView) ? <AdminReservations /> : <AccessDenied />;
  if (path === '/admin/payments') return adminAllowed(ADMIN_PERMISSION.paymentsView) ? <AdminPayments /> : <AccessDenied />;
  if (path === '/admin/expenses') return adminAllowed(ADMIN_PERMISSION.expensesView) ? <AdminExpenses /> : <AccessDenied />;
  if (path === '/admin/maintenance') return adminAllowed(ADMIN_PERMISSION.maintenanceView) ? <AdminMaintenance /> : <AccessDenied />;
  if (path === '/admin/tax' || path.startsWith('/admin/tax?')) return adminAllowed(ADMIN_PERMISSION.taxView) ? <AdminTax /> : <AccessDenied />;
  if (path === '/admin/kra' || path.startsWith('/admin/kra?')) return adminAllowed(ADMIN_PERMISSION.taxView) ? <AdminKra /> : <AccessDenied />;
  if (path === '/admin/settings') return staffAccess.isSuperAdmin ? <AdminSettings /> : <AccessDenied />;
  if (path === '/admin/activity') return adminAllowed(ADMIN_PERMISSION.auditView) ? <AdminActivity /> : <AccessDenied />;
  if (path === '/admin/documents') return adminAllowed(ADMIN_PERMISSION.documentsView) ? <AdminDocuments /> : <AccessDenied />;
  if (path === '/admin/portfolio') return adminAllowed(ADMIN_PERMISSION.propertiesView) ? <AdminPortfolio /> : <AccessDenied />;
  if (path === '/admin/short-stay') return adminAllowed(ADMIN_PERMISSION.shortStayView) ? <ShortStayOperations /> : <AccessDenied />;
  if (path === '/admin/sales') return adminAllowed(ADMIN_PERMISSION.salesView) ? <AdminSales /> : <AccessDenied />;

  if (path === '/favorites') return profile ? <FavoritesPage /> : <AuthPage mode="login" />;
  if (path === '/notifications') return profile ? <NotificationsPage /> : <AuthPage mode="login" />;
  if (path === '/stays') return profile ? <StaysPage /> : <AuthPage mode="login" />;

  if (path === '/') return <PublicLayout><HomePage /></PublicLayout>;
  if (path === '/properties' || path.startsWith('/properties?')) return <PublicLayout><PropertiesPage /></PublicLayout>;
  if (path.startsWith('/property/')) return <PublicLayout><PropertyDetailsPage propertyId={path.split('/property/')[1]} /></PublicLayout>;
  if (path === '/about') return <PublicLayout><AboutPage /></PublicLayout>;
  if (path === '/contact') return <PublicLayout><ContactPage /></PublicLayout>;
  if (path === '/faqs') return <PublicLayout><FAQsPage /></PublicLayout>;

  return <PublicLayout><NotFoundPage /></PublicLayout>;
}

function App() {
  return (
    <div className="app-shell">
      <ScrollProgress />
      <div className="site-watermark" aria-hidden="true"><img src={highparkLogo} alt="" /></div>
      <AppErrorBoundary>
        <RouterProvider>
        <AuthProvider>
          <ToastProvider>
            <ScrollRevealObserver />
            <SessionSecurityGuard />
            <Routes />
          </ToastProvider>
        </AuthProvider>
        </RouterProvider>
      </AppErrorBoundary>
    </div>
  );
}

export default App;
