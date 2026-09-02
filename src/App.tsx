import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { RouterProvider, useRouter } from '@/context/RouterContext';
import { Header, Footer } from '@/components/Layout';
import { Spinner } from '@/components/ui';
import { HomePage } from '@/pages/HomePage';
import { PropertiesPage } from '@/pages/PropertiesPage';
import { PropertyDetailsPage } from '@/pages/PropertyDetailsPage';
import { AuthPage } from '@/pages/AuthPage';
import { AboutPage, ContactPage, FAQsPage } from '@/pages/StaticPages';
import { FavoritesPage, NotificationsPage } from '@/pages/AccountPages';
import {
  OwnerDashboard, OwnerProperties, OwnerUnits, OwnerReservations, OwnerExpenses,
  OwnerTax, OwnerMaintenance, OwnerTenants, OwnerPayments, OwnerReports, OwnerSettings,
} from '@/pages/OwnerPages';
import {
  TenantDashboard, TenantRent, TenantMaintenance, TenantLease, TenantHouse,
  TenantMessages, TenantSettings, TenantReservations, TenantViewings,
} from '@/pages/TenantPages';
import {
  AdminDashboard, AdminProperties, AdminUsers, AdminReservations, AdminPayments, AdminSettings, AdminUnits, AdminTax, AdminExpenses, AdminMaintenance,
} from '@/pages/AdminPages';
import type { JSX } from 'react';
import highparkLogo from '@/assets/highpark-logo-clean.png';

function PublicLayout({ children }: { children: JSX.Element }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
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
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <Spinner className="h-8 w-8 text-brand-500" />
      </div>
    );
  }

  if (path === '/login') return <AuthPage mode="login" />;
  if (path === '/register') return <AuthPage mode="register" />;

  const isOwner = profile?.role === 'owner' || profile?.role === 'agent' || profile?.role === 'admin';
  const isTenant = profile?.role === 'customer' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  const isProtectedPath =
    path === '/tenant' || path.startsWith('/tenant/') ||
    path === '/owner' || path.startsWith('/owner/') ||
    path === '/admin' || path.startsWith('/admin/') ||
    path === '/favorites' || path === '/notifications';

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

  // Admin routes
  if (path === '/admin') return isAdmin ? <AdminDashboard /> : <AccessDenied />;
  if (path === '/admin/properties' || path.startsWith('/admin/properties?')) return isAdmin ? <AdminProperties /> : <AccessDenied />;
  if (path === '/admin/units' || path.startsWith('/admin/units?')) return isAdmin ? <AdminUnits /> : <AccessDenied />;
  if (path === '/admin/users' || path.startsWith('/admin/users?')) return isAdmin ? <AdminUsers /> : <AccessDenied />;
  if (path === '/admin/reservations') return isAdmin ? <AdminReservations /> : <AccessDenied />;
  if (path === '/admin/payments') return isAdmin ? <AdminPayments /> : <AccessDenied />;
  if (path === '/admin/expenses') return isAdmin ? <AdminExpenses /> : <AccessDenied />;
  if (path === '/admin/maintenance') return isAdmin ? <AdminMaintenance /> : <AccessDenied />;
  if (path === '/admin/tax' || path.startsWith('/admin/tax?')) return isAdmin ? <AdminTax /> : <AccessDenied />;
  if (path === '/admin/settings') return isAdmin ? <AdminSettings /> : <AccessDenied />;

  if (path === '/favorites') return profile ? <FavoritesPage /> : <AuthPage mode="login" />;
  if (path === '/notifications') return profile ? <NotificationsPage /> : <AuthPage mode="login" />;

  if (path === '/') return <PublicLayout><HomePage /></PublicLayout>;
  if (path === '/properties' || path.startsWith('/properties?')) return <PublicLayout><PropertiesPage /></PublicLayout>;
  if (path.startsWith('/property/')) return <PublicLayout><PropertyDetailsPage propertyId={path.split('/property/')[1]} /></PublicLayout>;
  if (path === '/about') return <PublicLayout><AboutPage /></PublicLayout>;
  if (path === '/contact') return <PublicLayout><ContactPage /></PublicLayout>;
  if (path === '/faqs') return <PublicLayout><FAQsPage /></PublicLayout>;

  return <PublicLayout><HomePage /></PublicLayout>;
}

function App() {
  return (
    <div className="app-shell">
      <div className="site-watermark" aria-hidden="true"><img src={highparkLogo} alt="" /></div>
      <RouterProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes />
          </ToastProvider>
        </AuthProvider>
      </RouterProvider>
    </div>
  );
}

export default App;
