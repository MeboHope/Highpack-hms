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
  TenantMessages, TenantSettings,
} from '@/pages/TenantPages';
import {
  AdminDashboard, AdminProperties, AdminUsers, AdminReservations, AdminPayments, AdminSettings,
} from '@/pages/AdminPages';
import type { JSX } from 'react';

function PublicLayout({ children }: { children: JSX.Element }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Routes() {
  const { path } = useRouter();
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner className="w-8 h-8 text-brand-500" />
      </div>
    );
  }

  // Auth pages (no layout)
  if (path === '/login') return <AuthPage mode="login" />;
  if (path === '/register') return <AuthPage mode="register" />;

  // Dashboard routes — require auth
  const isOwner = profile?.role === 'owner' || profile?.role === 'admin';
  const isTenant = profile?.role === 'customer' || profile?.role === 'admin';
  const isAdmin = profile?.role === 'admin';

  // Owner routes
  if (path === '/owner' && isOwner) return <OwnerDashboard />;
  if (path === '/owner/properties' && isOwner) return <OwnerProperties />;
  if (path.startsWith('/owner/units/') && isOwner) return <OwnerUnits propertyId={path.split('/owner/units/')[1]} />;
  if (path === '/owner/reservations' && isOwner) return <OwnerReservations />;
  if (path === '/owner/expenses' && isOwner) return <OwnerExpenses />;
  if (path === '/owner/tax' && isOwner) return <OwnerTax />;
  if (path === '/owner/maintenance' && isOwner) return <OwnerMaintenance />;
  if (path === '/owner/tenants' && isOwner) return <OwnerTenants />;
  if (path === '/owner/payments' && isOwner) return <OwnerPayments />;
  if (path === '/owner/reports' && isOwner) return <OwnerReports />;
  if (path === '/owner/settings' && isOwner) return <OwnerSettings />;

  // Tenant routes
  if (path === '/tenant' && isTenant) return <TenantDashboard />;
  if (path === '/tenant/house' && isTenant) return <TenantHouse />;
  if (path === '/tenant/rent' && isTenant) return <TenantRent />;
  if (path === '/tenant/maintenance' && isTenant) return <TenantMaintenance />;
  if (path === '/tenant/lease' && isTenant) return <TenantLease />;
  if (path === '/tenant/messages' && isTenant) return <TenantMessages />;
  if (path === '/tenant/settings' && isTenant) return <TenantSettings />;

  // Admin routes
  if (path === '/admin' && isAdmin) return <AdminDashboard />;
  if (path === '/admin/properties' && isAdmin) return <AdminProperties />;
  if (path === '/admin/users' && isAdmin) return <AdminUsers />;
  if (path === '/admin/reservations' && isAdmin) return <AdminReservations />;
  if (path === '/admin/payments' && isAdmin) return <AdminPayments />;
  if (path === '/admin/settings' && isAdmin) return <AdminSettings />;

  // Account pages (with header/footer)
  if (path === '/favorites') return <FavoritesPage />;
  if (path === '/notifications') return <NotificationsPage />;

  // Public pages
  if (path === '/') return <PublicLayout><HomePage /></PublicLayout>;
  if (path === '/properties' || path.startsWith('/properties?')) return <PublicLayout><PropertiesPage /></PublicLayout>;
  if (path.startsWith('/property/')) return <PublicLayout><PropertyDetailsPage propertyId={path.split('/property/')[1]} /></PublicLayout>;
  if (path === '/about') return <PublicLayout><AboutPage /></PublicLayout>;
  if (path === '/contact') return <PublicLayout><ContactPage /></PublicLayout>;
  if (path === '/faqs') return <PublicLayout><FAQsPage /></PublicLayout>;

  // Default redirect
  return <PublicLayout><HomePage /></PublicLayout>;
}

function App() {
  return (
    <RouterProvider>
      <AuthProvider>
        <ToastProvider>
          <Routes />
        </ToastProvider>
      </AuthProvider>
    </RouterProvider>
  );
}

export default App;
