import { useEffect, useState, type ReactNode } from 'react';

import {
  Home,
  LayoutDashboard,
  Building2,
  Calendar,
  Users,
  Wallet,
  FileText,
  Settings,
  Bell,
  LogOut,
  Menu,
  X,
  Receipt,
  Wrench,
  TrendingUp,
  Heart,
  Search,
} from 'lucide-react';

import { Link, useRouter } from '@/context/RouterContext';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Brand } from '@/components/Brand';
import { supabase } from '@/lib/supabase';
import { titleCase } from '@/lib/constants';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

export function DashboardLayout({
  children,
  navItems,
  title,
}: {
  children: ReactNode;
  navItems: NavItem[];
  title: string;
}) {
  const { path, navigate } = useRouter();
  const { profile, signOut } = useAuth();
  const { toast } = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<Array<{ type: string; title: string; subtitle: string; to: string }>>([]);
  const [globalSearching, setGlobalSearching] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    toast('Signed out successfully', 'success');
    navigate('/');
  };

  const isActive = (to: string) =>
    path === to ||
    (to !== `/${title.toLowerCase()}` && path.startsWith(to));

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (profile?.role === 'admin') setGlobalSearchOpen(true);
      }
      if (event.key === 'Escape') setGlobalSearchOpen(false);
    };
    window.addEventListener('keydown', onShortcut);
    return () => window.removeEventListener('keydown', onShortcut);
  }, [profile?.role]);

  useEffect(() => {
    if (!globalSearchOpen || profile?.role !== 'admin') return;
    const q = globalQuery.trim();
    if (q.length < 2) { setGlobalResults([]); setGlobalSearching(false); return; }
    const timer = window.setTimeout(async () => {
      setGlobalSearching(true);
      const safe = q.replace(/[%_]/g, '');
      const term = `%${safe}%`;
      const [properties, units, users] = await Promise.all([
        supabase.from('properties').select('id,name,town,county').or(`name.ilike.${term},town.ilike.${term},county.ilike.${term}`).order('created_at', { ascending: false }).limit(5),
        supabase.from('property_units').select('id,unit_number,property_id,properties(name)').ilike('unit_number', term).order('created_at', { ascending: false }).limit(5),
        supabase.from('profiles').select('id,full_name,phone,role').or(`full_name.ilike.${term},phone.ilike.${term}`).limit(5),
      ]);
      const results: Array<{ type: string; title: string; subtitle: string; to: string }> = [];
      (properties.data || []).forEach((row) => results.push({ type: 'Property', title: String(row.name), subtitle: `${String(row.town || '')}${row.county ? `, ${String(row.county)}` : ''}`, to: `/property/${row.id}` }));
      (units.data || []).forEach((row) => {
        const property = Array.isArray(row.properties) ? row.properties[0] : row.properties;
        results.push({ type: 'Unit', title: `Unit ${String(row.unit_number)}`, subtitle: property?.name ? String(property.name) : 'Property unit', to: '/admin/units' });
      });
      (users.data || []).forEach((row) => results.push({ type: titleCase(String(row.role || 'User')), title: String(row.full_name || 'Unnamed user'), subtitle: String(row.phone || row.role || ''), to: '/admin/users' }));
      setGlobalResults(results);
      setGlobalSearching(false);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [globalQuery, globalSearchOpen, profile?.role]);

  const openSearchResult = (to: string) => {
    setGlobalSearchOpen(false);
    setGlobalQuery('');
    setGlobalResults([]);
    navigate(to);
  };

  return (
    <div className="app-shell min-h-screen bg-ink-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 bg-white/95 backdrop-blur-xl border-r border-ink-100 flex-col fixed h-screen z-40 shadow-[8px_0_30px_rgba(13,35,66,0.03)]">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-ink-100 flex items-center justify-center bg-gradient-to-b from-white to-brand-50/30">
          <Brand compact />
        </div>

        {/* User profile */}
        <div className="p-4 border-b border-ink-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold">
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>

            <div className="min-w-0">
              <p className="font-medium text-ink-900 text-sm truncate">
                {profile?.full_name || 'User'}
              </p>

              <p className="text-xs text-ink-400 capitalize">
                {profile?.role || 'user'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive(item.to)
                  ? 'bg-brand-50 text-brand-800 shadow-sm ring-1 ring-brand-100'
                  : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900'
              }`}
            >
              <span className={isActive(item.to) ? 'text-brand-700' : 'text-ink-400 group-hover:text-brand-600'}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-ink-100">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-600 hover:bg-ink-50"
          >
            <Search className="w-5 h-5" />
            Browse Properties
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-ink-950/50"
            onClick={() => setMobileOpen(false)}
          />

          <aside className="relative w-64 bg-white flex flex-col animate-slide-up">
            {/* Mobile logo */}
            <div className="p-4 border-b border-ink-100 flex items-center justify-between">
              <Brand compact />

              <button
                onClick={() => setMobileOpen(false)}
                className="text-ink-400 hover:text-ink-700"
                aria-label="Close navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile navigation */}
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium ${
                    isActive(item.to)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-ink-600 hover:bg-ink-50'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>

            <div className="p-3 border-t border-ink-100">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-white/85 backdrop-blur-xl border-b border-ink-100 shadow-[0_4px_24px_rgba(13,35,66,0.03)]">
          <div className="flex items-center justify-between px-4 sm:px-6 h-16">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden btn-ghost p-2"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
              >
                <Menu className="w-6 h-6" />
              </button>

              <div><p className="hidden sm:block text-[10px] font-bold uppercase tracking-[0.18em] text-brand-600">HighPark Consult</p><h1 className="text-lg font-bold text-ink-900 capitalize">{title}</h1></div>
            </div>

            <div className="flex items-center gap-2">
              {profile?.role === 'admin' && <button type="button" onClick={() => setGlobalSearchOpen(true)} className="hidden md:flex h-10 min-w-52 items-center justify-between gap-3 rounded-xl border border-ink-200 bg-ink-50/70 px-3 text-left text-xs text-ink-400 hover:border-brand-200 hover:bg-white" aria-label="Search the administration workspace"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search properties, units, users…</span><kbd className="rounded-md border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-400">Ctrl K</kbd></button>}
              {profile?.role === 'admin' && <button type="button" onClick={() => setGlobalSearchOpen(true)} className="btn-ghost md:hidden" aria-label="Search"><Search className="w-5 h-5" /></button>}
              <Link
                to="/notifications"
                className="btn-ghost relative"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
              </Link>

              <Link
                to="/favorites"
                className="btn-ghost"
                aria-label="Favorites"
              >
                <Heart className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </header>

        {globalSearchOpen && profile?.role === 'admin' && <div className="fixed inset-0 z-[60] bg-ink-950/40 p-4 backdrop-blur-sm" onMouseDown={() => setGlobalSearchOpen(false)}>
          <div className="mx-auto mt-[10vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3"><Search className="h-5 w-5 text-brand-600" /><input autoFocus value={globalQuery} onChange={(event) => setGlobalQuery(event.target.value)} placeholder="Search properties, units or users…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400" /><button type="button" onClick={() => setGlobalSearchOpen(false)} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-400 hover:bg-ink-50">Esc</button></div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {globalQuery.trim().length < 2 ? <div className="px-4 py-10 text-center"><Search className="mx-auto h-8 w-8 text-ink-300" /><p className="mt-3 text-sm font-semibold text-ink-700">Search the administration workspace</p><p className="mt-1 text-xs text-ink-400">Find a property, unit or user in seconds.</p></div> : globalSearching ? <div className="px-4 py-10 text-center text-sm text-ink-500">Searching live records…</div> : globalResults.length === 0 ? <div className="px-4 py-10 text-center text-sm text-ink-500">No matching records found.</div> : globalResults.map((result, index) => <button key={`${result.type}-${result.title}-${index}`} type="button" onClick={() => openSearchResult(result.to)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-brand-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Search className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-900">{result.title}</span><span className="block truncate text-xs text-ink-500">{result.type} · {result.subtitle}</span></span><span className="text-xs font-semibold text-brand-700">Open →</span></button>)}
            </div>
          </div>
        </div>}

        <main className="p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto">
          <div className="mb-4 hidden items-center gap-2 text-[11px] font-medium text-ink-400 lg:flex"><span>HighPark Consult</span><span>•</span><span className="capitalize">{profile?.role || 'workspace'}</span><span>•</span><span className="text-brand-700">{title}</span></div>
          {children}
        </main>
      </div>
    </div>
  );
}

export const ownerNav = [
  {
    label: 'Dashboard',
    to: '/owner',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Properties',
    to: '/owner/properties',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    to: '/owner/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Tenants',
    to: '/owner/tenants',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Rent & Payments',
    to: '/owner/payments',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Expenses',
    to: '/owner/expenses',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Viewings',
    to: '/tenant/viewings',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    to: '/owner/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Tax & KRA',
    to: '/owner/tax',
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    label: 'Reports',
    to: '/owner/reports',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    to: '/owner/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const tenantNav = [
  {
    label: 'Dashboard',
    to: '/tenant',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Find a Home',
    to: '/properties',
    icon: <Search className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    to: '/tenant/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'My House',
    to: '/tenant/house',
    icon: <Home className="w-5 h-5" />,
  },
  {
    label: 'Rent & Payments',
    to: '/tenant/rent',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Lease',
    to: '/tenant/lease',
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: 'Viewings',
    to: '/tenant/viewings',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    to: '/tenant/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Messages',
    to: '/tenant/messages',
    icon: <Bell className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    to: '/tenant/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];

export const adminNav = [
  {
    label: 'Dashboard',
    to: '/admin',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: 'Properties',
    to: '/admin/properties',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Users',
    to: '/admin/users',
    icon: <Users className="w-5 h-5" />,
  },
  {
    label: 'Units & Inventory',
    to: '/admin/units',
    icon: <Building2 className="w-5 h-5" />,
  },
  {
    label: 'Reservations',
    to: '/admin/reservations',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    label: 'Payments',
    to: '/admin/payments',
    icon: <Wallet className="w-5 h-5" />,
  },
  {
    label: 'Expenses',
    to: '/admin/expenses',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Maintenance',
    to: '/admin/maintenance',
    icon: <Wrench className="w-5 h-5" />,
  },
  {
    label: 'Tax',
    to: '/admin/tax',
    icon: <Receipt className="w-5 h-5" />,
  },
  {
    label: 'Settings',
    to: '/admin/settings',
    icon: <Settings className="w-5 h-5" />,
  },
];