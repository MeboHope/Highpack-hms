import { useState } from 'react';
import {
  LayoutDashboard, Building2, Calendar, Eye, Users, Home, UserCog,
  CreditCard, FileText, Receipt, Landmark, KeyRound, Wrench, BarChart3,
  Bell, Shield, Settings, LogOut, Menu, X, ChevronDown, Plus, Upload,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

export type AdminPage =
  | 'dashboard' | 'properties' | 'add-property' | 'bulk-import'
  | 'reservations' | 'viewings' | 'customers' | 'landlords' | 'agents'
  | 'payments' | 'invoices' | 'tax' | 'tenancy' | 'maintenance'
  | 'reports' | 'notifications' | 'users' | 'audit' | 'settings';

interface AdminLayoutProps {
  page: AdminPage;
  onNavigate: (page: AdminPage) => void;
  onExitAdmin: () => void;
  children: React.ReactNode;
  notificationCount?: number;
}

interface NavItem {
  id: AdminPage;
  label: string;
  icon: typeof Home;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: '',
    items: [{ id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'Properties',
    items: [
      { id: 'properties', label: 'All Properties', icon: Building2 },
      { id: 'add-property', label: 'Add Property', icon: Plus },
      { id: 'bulk-import', label: 'Bulk Import', icon: Upload },
    ],
  },
  {
    label: 'Bookings',
    items: [
      { id: 'reservations', label: 'Reservations', icon: Calendar },
      { id: 'viewings', label: 'Viewings', icon: Eye },
    ],
  },
  {
    label: 'People',
    items: [
      { id: 'customers', label: 'Customers', icon: Users },
      { id: 'landlords', label: 'Landlords', icon: Home },
      { id: 'agents', label: 'Agents', icon: UserCog },
    ],
  },
  {
    label: 'Finance',
    items: [
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'invoices', label: 'Invoices & Receipts', icon: FileText },
      { id: 'tax', label: 'Tax / KRA', icon: Landmark },
    ],
  },
  {
    label: 'Tenancy',
    items: [
      { id: 'tenancy', label: 'Leases & Rent', icon: KeyRound },
      { id: 'maintenance', label: 'Maintenance', icon: Wrench },
    ],
  },
  {
    label: 'System',
    items: [
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'notifications', label: 'Notifications', icon: Bell },
      { id: 'users', label: 'Users & Permissions', icon: Shield },
      { id: 'audit', label: 'Audit Logs', icon: FileText },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export function AdminLayout({ page, onNavigate, onExitAdmin, children, notificationCount = 0 }: AdminLayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleNavigate = (p: AdminPage) => {
    onNavigate(p);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 transform border-r border-slate-200 bg-white transition-transform duration-200 lg:translate-x-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white">
            <Home className="h-4 w-4" />
          </div>
          <span className="text-lg font-bold text-slate-900">Nyumba<span className="text-teal-700">254</span></span>
          <span className="ml-auto rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">Admin</span>
        </div>

        <nav className="h-[calc(100vh-4rem)] overflow-y-auto px-3 py-4">
          {navGroups.map((group, gi) => (
            <div key={gi} className="mb-4">
              {group.label && (
                <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
              )}
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigate(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    page === item.id
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'notifications' && notificationCount > 0 && (
                    <span className={cn('rounded-full px-1.5 py-0.5 text-xs font-bold', page === item.id ? 'bg-white text-teal-700' : 'bg-red-500 text-white')}>{notificationCount}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {mobileOpen && <div className="fixed inset-0 z-40 bg-black/30 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(!mobileOpen)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="text-lg font-semibold text-slate-900 capitalize">{page.replace(/-/g, ' ')}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExitAdmin} className="hidden items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex">
              <LayoutDashboard className="h-4 w-4" /> View Site
            </button>
            <div className="relative">
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 text-sm font-semibold text-teal-800">
                  {profile?.full_name?.charAt(0).toUpperCase() ?? 'A'}
                </div>
                <span className="hidden text-sm font-medium text-slate-700 sm:block">{profile?.full_name ?? 'Admin'}</span>
                <ChevronDown className="hidden h-4 w-4 text-slate-400 sm:block" />
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button onClick={onExitAdmin} className="flex w-full items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 sm:hidden">
                      <LayoutDashboard className="h-4 w-4" /> View Site
                    </button>
                    <button onClick={() => { signOut(); onExitAdmin(); }} className="flex w-full items-center gap-2 border-t border-slate-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50">
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

// Quick Actions component for dashboard
export function QuickActions({ onNavigate }: { onNavigate: (page: AdminPage) => void }) {
  const actions: { label: string; icon: typeof Plus; page: AdminPage; color: string }[] = [
    { label: 'Add Property', icon: Plus, page: 'add-property', color: 'bg-teal-50 text-teal-700' },
    { label: 'Bulk Import', icon: Upload, page: 'bulk-import', color: 'bg-blue-50 text-blue-700' },
    { label: 'View Reservations', icon: Calendar, page: 'reservations', color: 'bg-amber-50 text-amber-700' },
    { label: 'View Payments', icon: DollarSign, page: 'payments', color: 'bg-green-50 text-green-700' },
    { label: 'Tax/KRA', icon: Landmark, page: 'tax', color: 'bg-purple-50 text-purple-700' },
    { label: 'Reports', icon: BarChart3, page: 'reports', color: 'bg-rose-50 text-rose-700' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {actions.map((a) => (
        <button key={a.label} onClick={() => onNavigate(a.page)} className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition-all hover:shadow-md hover:border-teal-200">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', a.color)}>
            <a.icon className="h-5 w-5" />
          </div>
          <span className="text-xs font-medium text-slate-700">{a.label}</span>
        </button>
      ))}
    </div>
  );
}
