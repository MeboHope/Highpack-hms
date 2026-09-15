import { useEffect, useState, type ReactNode } from 'react';
import { Bell, LogOut, Menu, X, Heart, Search } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';
import { useAuth } from '@/context/hooks';
import { useToast } from '@/context/hooks';
import { Brand } from '@/components/Brand';
import { supabase } from '@/lib/supabase';
import { titleCase } from '@/lib/constants';
import { hasStaffPermission } from '@/lib/staffAccess';

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
  section?: string;
  requiredPermission?: string;
  superAdminOnly?: boolean;
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
  const { profile, staffAccess, signOut } = useAuth();
  const { toast } = useToast();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState('');
  const [globalResults, setGlobalResults] = useState<Array<{ type: string; title: string; subtitle: string; to: string }>>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [workspaceAsset, setWorkspaceAsset] = useState<{ name: string; subtitle: string } | null>(null);

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
    let cancelled = false;
    const loadWorkspaceAsset = async () => {
      if (profile?.role === 'customer') {
        const leaseId = new URLSearchParams(window.location.search).get('asset') || window.localStorage.getItem('highpark:tenant-active-asset');
        if (!leaseId) { if (!cancelled) setWorkspaceAsset(null); return; }
        const { data } = await supabase.from('leases').select('id, properties(name, property_type, asset_class, operation_model), property_units(unit_number)').eq('id', leaseId).eq('tenant_id', profile.id).maybeSingle();
        if (!cancelled && data) { const property = Array.isArray(data.properties) ? data.properties[0] : data.properties; const unit = Array.isArray(data.property_units) ? data.property_units[0] : data.property_units; setWorkspaceAsset({ name: String(property?.name || 'Selected asset'), subtitle: `${String(property?.property_type || property?.asset_class || 'managed asset')}${unit?.unit_number ? ` · Unit ${String(unit.unit_number)}` : ''}` }); }
        return;
      }
      if (profile?.role === 'owner') {
        const propertyId = new URLSearchParams(window.location.search).get('asset') || window.localStorage.getItem('highpark:owner-active-asset');
        if (!propertyId) { if (!cancelled) setWorkspaceAsset(null); return; }
        const { data } = await supabase.from('properties').select('id,name,asset_class,town,county').eq('id', propertyId).eq('owner_id', profile.id).maybeSingle();
        if (!cancelled && data) setWorkspaceAsset({ name: String(data.name || 'Selected asset'), subtitle: `${String(data.asset_class || 'managed asset').replace(/_/g, ' ')}${data.town ? ` · ${String(data.town)}` : ''}` });
        return;
      }
      if (!cancelled) setWorkspaceAsset(null);
    };
    void loadWorkspaceAsset();
    return () => { cancelled = true; };
  }, [profile?.id, profile?.role, path]);

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
      (properties.data || []).forEach((row) => results.push({ type: 'Property', title: String(row.name), subtitle: `${String(row.town || '')}${row.county ? `, ${String(row.county)}` : ''}`, to: profile?.role === 'admin' ? `/admin/properties/${row.id}` : `/property/${row.id}` }));
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

  const visibleNavItems = profile?.role === 'admin'
    ? navItems.filter((item) => (item.superAdminOnly ? staffAccess.isSuperAdmin : !item.requiredPermission || hasStaffPermission(staffAccess, item.requiredPermission)))
    : navItems;

  const roleLabel = profile?.role === 'admin' ? 'Administration' : profile?.role === 'owner' ? 'Asset owner' : 'Client workspace';

  return (
    <div className="min-h-screen flex bg-white">
      {/* Desktop sidebar — solid, minimal */}
      <aside className="hidden lg:flex w-64 bg-white border-r border-ink-100 flex-col fixed h-screen z-40">
        <div className="px-4 py-5 border-b border-ink-100 flex items-center justify-center">
          <Brand compact />
        </div>

        <div className="p-4 border-b border-ink-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center bg-brand-900 text-white font-bold" style={{ borderRadius: '2px' }}>
              {profile?.full_name?.[0]?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-ink-900 text-sm truncate">{profile?.full_name || 'User'}</p>
              <p className="text-[11px] text-ink-500 capitalize">{profile?.role || 'user'}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {visibleNavItems.map((item, index) => (
            <div key={item.to}>
              {item.section && (index === 0 || item.section !== visibleNavItems[index - 1]?.section) && (
                <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wide text-ink-400">{item.section}</p>
              )}
              <Link
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm font-semibold transition-colors ${isActive(item.to) ? 'bg-ink-50 text-brand-900 border border-ink-100' : 'text-ink-600 hover:bg-ink-50 hover:text-ink-900 border border-transparent'}`}
                style={{ borderRadius: '2px', minHeight: '44px' }}
              >
                <span className={isActive(item.to) ? 'text-brand-900' : 'text-ink-400'}>{item.icon}</span>
                {item.label}
              </Link>
            </div>
          ))}
        </nav>

        <div className="p-3 border-t border-ink-100">
          <Link to="/" className="flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-50" style={{ borderRadius: '2px', minHeight: '44px' }}>
            <Search className="w-5 h-5" /> View marketplace
          </Link>
          <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50" style={{ borderRadius: '2px', minHeight: '44px' }}>
            <LogOut className="w-5 h-5" /> Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-white flex flex-col border-r border-ink-100">
            <div className="p-4 border-b border-ink-100 flex items-center justify-between">
              <Brand compact />
              <button onClick={() => setMobileOpen(false)} className="flex h-10 w-10 items-center justify-center border border-ink-100 bg-white text-ink-600 hover:bg-ink-50" style={{ borderRadius: '2px' }} aria-label="Close navigation">
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item, index) => (
                <div key={item.to}>
                  {item.section && (index === 0 || item.section !== visibleNavItems[index - 1]?.section) && (
                    <p className="px-3 pb-1 pt-4 text-[10px] font-bold uppercase tracking-wide text-ink-400">{item.section}</p>
                  )}
                  <Link
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 text-sm font-medium ${isActive(item.to) ? 'bg-ink-50 text-brand-900 border border-ink-100' : 'text-ink-600 hover:bg-ink-50 border border-transparent'}`}
                    style={{ borderRadius: '2px', minHeight: '44px' }}
                  >
                    {item.icon}
                    {item.label}
                  </Link>
                </div>
              ))}
            </nav>
            <div className="p-3 border-t border-ink-100">
              <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50" style={{ borderRadius: '2px', minHeight: '44px' }}>
                <LogOut className="w-5 h-5" /> Sign Out
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        <header className="sticky top-0 z-30 bg-white border-b border-ink-100">
          <div className="flex items-center justify-between px-4 sm:px-6 h-[64px]">
            <div className="flex items-center gap-3">
              <button className="lg:hidden flex h-10 w-10 items-center justify-center border border-ink-100 bg-white text-ink-700 hover:bg-ink-50" style={{ borderRadius: '2px' }} onClick={() => setMobileOpen(true)} aria-label="Open navigation">
                <Menu className="w-5 h-5" />
              </button>
              <div>
                <p className="hidden sm:block text-[10px] font-bold uppercase tracking-wide text-ink-400">{roleLabel}</p>
                <h1 className="text-lg font-bold tracking-tight" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {profile?.role === 'admin' && <button type="button" onClick={() => setGlobalSearchOpen(true)} className="hidden md:flex h-10 min-w-52 items-center justify-between gap-3 border border-ink-200 bg-ink-50 px-3 text-left text-xs text-ink-500 hover:border-ink-300 hover:bg-white" style={{ borderRadius: '2px' }} aria-label="Search"><span className="flex items-center gap-2"><Search className="h-4 w-4" />Search…</span><kbd className="border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-400" style={{ borderRadius: '2px' }}>Ctrl K</kbd></button>}
              {profile?.role === 'admin' && <button type="button" onClick={() => setGlobalSearchOpen(true)} className="flex h-10 w-10 items-center justify-center border border-ink-100 bg-white text-ink-600 hover:bg-ink-50 md:hidden" style={{ borderRadius: '2px' }} aria-label="Search"><Search className="w-5 h-5" /></button>}
              <Link to="/notifications" className="flex h-10 w-10 items-center justify-center border border-ink-100 bg-white text-ink-600 hover:bg-ink-50" style={{ borderRadius: '2px' }} aria-label="Notifications">
                <Bell className="w-5 h-5" />
              </Link>
              <Link to="/favorites" className="flex h-10 w-10 items-center justify-center border border-ink-100 bg-white text-ink-600 hover:bg-ink-50" style={{ borderRadius: '2px' }} aria-label="Favorites">
                <Heart className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </header>

        {globalSearchOpen && profile?.role === 'admin' && (
          <div className="fixed inset-0 z-[60] bg-ink-950/40 p-4" onMouseDown={() => setGlobalSearchOpen(false)}>
            <div className="mx-auto mt-[10vh] w-full max-w-2xl overflow-hidden border border-ink-200 bg-white" style={{ borderRadius: '4px' }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 border-b border-ink-100 px-4 py-3">
                <Search className="h-5 w-5 text-ink-400" />
                <input autoFocus value={globalQuery} onChange={(e) => setGlobalQuery(e.target.value)} placeholder="Search properties, units or users…" className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400" />
                <button type="button" onClick={() => setGlobalSearchOpen(false)} className="px-2 py-1 text-xs font-semibold text-ink-400 hover:bg-ink-50" style={{ borderRadius: '2px' }}>Esc</button>
              </div>
              <div className="max-h-[55vh] overflow-y-auto p-2">
                {globalQuery.trim().length < 2 ? (
                  <div className="px-4 py-10 text-center"><Search className="mx-auto h-8 w-8 text-ink-300" /><p className="mt-3 text-sm font-semibold text-ink-700">Search workspace</p><p className="mt-1 text-xs text-ink-400">Find a property, unit or user.</p></div>
                ) : globalSearching ? (
                  <div className="px-4 py-10 text-center text-sm text-ink-500">Searching…</div>
                ) : globalResults.length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-ink-500">No matching records found.</div>
                ) : (
                  globalResults.map((result, index) => (
                    <button key={`${result.type}-${result.title}-${index}`} type="button" onClick={() => openSearchResult(result.to)} className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-ink-50" style={{ borderRadius: '2px' }}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-ink-50 text-ink-600 border border-ink-100" style={{ borderRadius: '2px' }}><Search className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink-900">{result.title}</span><span className="block truncate text-xs text-ink-500">{result.type} · {result.subtitle}</span></span>
                      <span className="text-xs font-semibold" style={{ color: '#0d2342' }}>Open →</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <main className="p-4 sm:p-6 lg:p-6 max-w-[1200px] mx-auto min-h-[calc(100vh-64px)]">
          <div className="mb-4 flex flex-col gap-2 border border-ink-100 bg-ink-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderRadius: '4px' }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wide text-ink-500"><span>HighPark Consult</span><span className="text-ink-300">•</span><span>{roleLabel}</span></div>
              <h2 className="mt-1 truncate text-sm font-bold tracking-tight">{title}</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-ink-500">
              {workspaceAsset && <span className="hidden max-w-[280px] truncate bg-white px-2.5 py-1 font-semibold border border-ink-100 sm:inline-flex" style={{ borderRadius: '2px' }}>{workspaceAsset.name}</span>}
              <span className="h-1.5 w-1.5 bg-green-600" style={{ borderRadius: '2px' }} />
              <span className="text-green-700 font-medium">Live</span>
            </div>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
