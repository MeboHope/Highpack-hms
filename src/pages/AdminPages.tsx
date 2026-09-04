import { useState, useEffect, type ReactNode } from 'react';
import { Building2, Users, Calendar, Wallet, Home, CheckCircle, XCircle, ShieldCheck, Receipt, UserCheck, Wrench, Search, Download, Eye, RefreshCw, TrendingUp, ArrowUpRight, ArrowDownRight, CalendarClock, UserRound, LogOut, AlertTriangle } from 'lucide-react';
import { DashboardLayout, adminNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, LoadingPage, Pagination } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/ToastContext';
import { useRouter } from '@/context/RouterContext';
import { formatKES, formatDate, titleCase } from '@/lib/constants';
import { downloadPaymentReceiptPdf } from '@/lib/documents';
import { loadDashboardPropertyPerformance, loadManagedExpenses, loadManagedMaintenance } from '@/lib/operationalData';
import type { Property, Profile, Reservation, Payment, SystemSettings, TaxRecord } from '@/lib/supabase';
import type { ManagedExpenseRow } from '@/lib/operationalData';

export function AdminDashboard() {
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Array<{ id: string; name: string; type: string; units: number; occupied: number; available: number; reserved: number; tenants: number; rent: number; tax: number }>>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [unitMix, setUnitMix] = useState<Record<string, { total: number; occupied: number; available: number }>>({});
  const [attention, setAttention] = useState({ reservations: 0, payments: 0, maintenance: 0, expiringLeases: 0 });
  const [financial, setFinancial] = useState<AdminFinancialData | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [performance, customerResult, pendingReservations, pendingPayments, openMaintenance, expiringLeases, financialResult] = await Promise.all([
        loadDashboardPropertyPerformance('__admin__', 'admin', period),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'customer'),
        supabase.from('reservations').select('id', { count: 'exact', head: true }).in('status', ['requested', 'confirmed', 'rescheduled']),
        supabase.from('payments').select('id', { count: 'exact', head: true }).in('status', ['pending', 'submitted', 'under_review']),
        supabase.from('maintenance_requests').select('id', { count: 'exact', head: true }).not('status', 'in', '(completed,closed,cancelled)'),
        supabase.from('leases').select('id', { count: 'exact', head: true }).eq('status', 'active').gte('end_date', new Date().toISOString().slice(0, 10)).lte('end_date', new Date(Date.now() + 45 * 86400000).toISOString().slice(0, 10)),
        supabase.rpc('get_admin_financial_command_center', { p_period: period }),
      ]);
      setSummary(performance.map((row) => ({
        id: row.id, name: row.name, type: row.propertyType, units: row.units, occupied: row.occupied,
        available: row.available, reserved: row.reserved, tenants: row.tenants, rent: row.collectedRent, tax: row.tax,
      })));
      const mix: Record<string, { total: number; occupied: number; available: number }> = {};
      performance.forEach((row) => Object.entries(row.unitTypes).forEach(([type, total]) => {
        mix[type] ||= { total: 0, occupied: 0, available: 0 };
        mix[type].total += total;
      }));
      setUnitMix(mix);
      setCustomerCount(customerResult.count || 0);
      setAttention({ reservations: pendingReservations.count || 0, payments: pendingPayments.count || 0, maintenance: openMaintenance.count || 0, expiringLeases: expiringLeases.count || 0 });
      setFinancial((financialResult.data as AdminFinancialData | null) || null);
      setLoading(false);
    })();
  }, [period]);

  if (loading) return <DashboardLayout navItems={adminNav} title="Dashboard"><LoadingPage /></DashboardLayout>;
  const totals = summary.reduce((a, r) => ({ properties: a.properties + 1, units: a.units + r.units, occupied: a.occupied + r.occupied, available: a.available + r.available, reserved: a.reserved + r.reserved, tenants: a.tenants + r.tenants, rent: a.rent + r.rent, tax: a.tax + r.tax }), { properties: 0, units: 0, occupied: 0, available: 0, reserved: 0, tenants: 0, rent: 0, tax: 0 });

  return (
    <DashboardLayout navItems={adminNav} title="Dashboard">
      <div className="mb-7 rounded-2xl brand-gradient p-6 text-white shadow-soft-lg"><p className="text-sm font-semibold text-white/90">HighPark Consult administration</p><h2 className="mt-1 text-2xl font-bold text-white">Portfolio control centre</h2><p className="mt-2 max-w-2xl text-sm font-medium text-white/90">Monitor properties, unit types, occupancy, tenants, verified rent collection and tax records from one screen.</p></div>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-ink-900">Reporting period</p><p className="text-xs text-ink-500">Rent and tax figures are scoped to this month.</p></div><input type="month" className="input sm:w-52" value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-7">
        <StatCard label="Properties" value={totals.properties} icon={<Building2 className="w-5 h-5" />} onClick={() => navigate('/admin/properties')} />
        <StatCard label="Units" value={totals.units} icon={<Home className="w-5 h-5" />} accent="accent" onClick={() => navigate('/admin/units')} />
        <StatCard label="Occupied" value={totals.occupied} icon={<Users className="w-5 h-5" />} accent="blue" onClick={() => navigate('/admin/units?status=occupied')} />
        <StatCard label="Available" value={totals.available} icon={<Home className="w-5 h-5" />} accent="ink" onClick={() => navigate('/admin/units?status=available')} />
        <StatCard label="Reserved" value={totals.reserved} icon={<Calendar className="w-5 h-5" />} accent="accent" onClick={() => navigate('/admin/reservations')} />
        <StatCard label="Active Tenants" value={totals.tenants} icon={<UserCheck className="w-5 h-5" />} onClick={() => navigate('/admin/users?role=customer&active=true')} />
        <StatCard label={`Verified Rent · ${period}`} value={formatKES(totals.rent)} icon={<Wallet className="w-5 h-5" />} accent="blue" onClick={() => navigate('/admin/payments')} />
        <StatCard label={`Estimated Tax · ${period}`} value={formatKES(totals.tax)} icon={<Receipt className="w-5 h-5" />} accent="red" onClick={() => navigate(`/admin/tax?period=${period}`)} />
      </div>
      <Card className="mb-7 overflow-hidden">
        <div className="border-b border-ink-100 bg-gradient-to-r from-white to-brand-50/30 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-ink-900">Needs attention</h3><p className="text-xs text-ink-500">Live operational items that may require an administrator's action.</p></div><span className="badge bg-accent-50 text-accent-700">Action queue</span></div></div>
        <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
          <button type="button" onClick={() => navigate('/admin/reservations')} className="bg-white p-4 text-left hover:bg-brand-50"><p className="text-2xl font-bold text-ink-900">{attention.reservations}</p><p className="mt-1 text-xs font-medium text-ink-500">Reservations to review</p></button>
          <button type="button" onClick={() => navigate('/admin/payments')} className="bg-white p-4 text-left hover:bg-brand-50"><p className="text-2xl font-bold text-ink-900">{attention.payments}</p><p className="mt-1 text-xs font-medium text-ink-500">Payments to review</p></button>
          <button type="button" onClick={() => navigate('/admin/maintenance')} className="bg-white p-4 text-left hover:bg-brand-50"><p className="text-2xl font-bold text-ink-900">{attention.maintenance}</p><p className="mt-1 text-xs font-medium text-ink-500">Open maintenance</p></button>
          <button type="button" onClick={() => navigate('/admin/users?lease_expiring=45')} className="bg-white p-4 text-left hover:bg-brand-50"><p className="text-2xl font-bold text-ink-900">{attention.expiringLeases}</p><p className="mt-1 text-xs font-medium text-ink-500">Leases expiring in 45 days</p></button>
        </div>
      </Card>
      {financial && <AdminFinancialCommandCenter data={financial} />}
      <div className="mb-7 grid grid-cols-1 gap-4 md:grid-cols-2">
        <OperationalPreview title="Maintenance & service requests" description="Tenant issues requiring attention across the portfolio." href="/admin/maintenance" icon={<Wrench className="h-5 w-5" />} />
        <OperationalPreview title="Property expenses" description="Recorded operating costs across all managed properties." href="/admin/expenses" icon={<Receipt className="h-5 w-5" />} />
      </div>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-ink-900">Property performance</h3><p className="text-sm text-ink-500">Inspect each property independently and drill into its exact portfolio records.</p></div><span className="badge bg-brand-50 text-brand-700">Admin live view</span></div>
        <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">{summary.map(r=>{const occupancy=r.units?Math.round(r.occupied/r.units*100):0;return <button key={r.id} type="button" onClick={()=>navigate(`/admin/properties?property=${r.id}`)} className="group rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-ink-900 group-hover:text-brand-700">{r.name}</h4><span className="mt-1 inline-flex badge bg-ink-100 text-ink-600">{r.type}</span></div><span className="text-xs font-semibold text-brand-700">Inspect →</span></div><div className="mt-4"><div className="mb-1 flex justify-between text-[11px] text-ink-500"><span>Occupancy</span><span className="font-semibold text-ink-700">{occupancy}%</span></div><div className="h-1.5 rounded-full bg-ink-100"><div className="h-1.5 rounded-full bg-brand-500" style={{width:`${occupancy}%`}}/></div></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-ink-50 p-3"><p className="text-xl font-bold text-ink-900">{r.units}</p><p className="text-[10px] uppercase text-ink-400">Units</p></div><div className="rounded-xl bg-brand-50 p-3"><p className="text-xl font-bold text-brand-700">{r.available}</p><p className="text-[10px] uppercase text-brand-600">Available</p></div><div className="rounded-xl bg-accent-50 p-3"><p className="text-xl font-bold text-accent-700">{r.reserved}</p><p className="text-[10px] uppercase text-accent-600">Reserved</p></div></div><div className="mt-3 grid grid-cols-3 gap-3 border-t border-ink-100 pt-3 text-xs"><div><p className="text-ink-400">Tenants</p><p className="font-semibold">{r.tenants}</p></div><div><p className="text-ink-400">Verified rent</p><p className="font-semibold">{formatKES(r.rent)}</p></div><div><p className="text-ink-400">Est. tax</p><p className="font-semibold text-brand-700">{formatKES(r.tax)}</p></div></div></button>})}</div>
      </Card>
      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6"><div className="mb-4"><h3 className="font-semibold text-ink-900">Actual unit-type mix</h3><p className="text-xs text-ink-500">Bedsitters, 1-bedroom, 2-bedroom and other rentable unit types.</p></div><div className="grid grid-cols-2 gap-3">{Object.entries(unitMix).sort((a,b) => b[1].total-a[1].total).map(([type, x]) => <div key={type} className="rounded-xl border border-ink-100 bg-ink-50 p-3"><p className="text-sm font-semibold text-ink-800">{type}</p><p className="mt-1 text-2xl font-bold text-brand-700">{x.total}</p><p className="text-[11px] text-ink-500">{x.total === 1 ? '1 unit' : `${x.total} units`} across the portfolio</p></div>)}{!Object.keys(unitMix).length && <p className="text-sm text-ink-500">No units yet.</p>}</div></Card>
        <Card className="p-6"><h3 className="font-semibold text-ink-900 mb-4">Customer base</h3><p className="text-3xl font-bold text-brand-700">{customerCount}</p><p className="mt-1 text-sm text-ink-500">Registered customer/tenant accounts</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-brand-50 p-4"><p className="text-xs text-brand-700">Verified properties</p><p className="mt-1 text-lg font-bold text-brand-900">{summary.length}</p></div><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-500">Reserved units</p><p className="mt-1 text-lg font-bold text-ink-900">{totals.reserved}</p></div></div></Card>
      </div>
    </DashboardLayout>
  );
}

export function AdminProperties() {
  const { path, navigate } = useRouter();
  const { toast } = useToast();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const selectedProperty = params.get('property');
  const [properties, setProperties] = useState<(Property & { profiles: { full_name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProperties, setTotalProperties] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');

  const load = async () => {
    setLoading(true);
    let ownerIds: string[] = [];
    if (query.trim()) {
      const q = query.trim();
      const { data: owners } = await supabase.from('profiles').select('id').or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(100);
      ownerIds = (owners || []).map((owner) => owner.id);
    }
    const from = (page - 1) * 20;
    const to = from + 19;
    let dbQuery = supabase.from('properties').select('*, profiles!properties_owner_id_fkey(full_name)', { count: 'exact' });
    if (status !== 'all') dbQuery = dbQuery.eq('status', status);
    if (query.trim()) {
      const q = query.trim();
      const clauses = [`name.ilike.%${q}%`, `town.ilike.%${q}%`, `county.ilike.%${q}%`, `property_type.ilike.%${q}%`];
      if (ownerIds.length) clauses.push(`owner_id.in.(${ownerIds.join(',')})`);
      dbQuery = dbQuery.or(clauses.join(','));
    }
    dbQuery = sort === 'oldest'
      ? dbQuery.order('created_at', { ascending: true }).order('id', { ascending: true })
      : sort === 'name'
        ? dbQuery.order('name', { ascending: true }).order('id', { ascending: true })
        : dbQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
    const { data, count, error } = await dbQuery.range(from, to);
    if (error) toast(`Could not load properties: ${error.message}`, 'error');
    setProperties((data as typeof properties) || []);
    setTotalProperties(count || 0);
    setTotalPages(Math.max(1, Math.ceil((count || 0) / 20)));
    setLoading(false);
  };

  useEffect(() => { setPage(1); }, [query, status, sort]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [page, query, status, sort]);

  const updateStatus = async (id: string, nextStatus: Property['status']) => {
    const { error } = await supabase.from('properties').update({ status: nextStatus }).eq('id', id);
    if (error) { toast(`Could not update property: ${error.message}`, 'error'); return; }
    setProperties((current) => current.map((p) => p.id === id ? { ...p, status: nextStatus } : p));
    toast(`Property ${titleCase(nextStatus)}`, 'success');
  };

  const pending = properties.filter((p) => p.status === 'pending_verification').length;
  const verified = properties.filter((p) => p.status === 'verified').length;
  const suspended = properties.filter((p) => p.status === 'suspended').length;

  return (
    <DashboardLayout navItems={adminNav} title="Properties">
      <AdminPageHeader eyebrow="Portfolio management" title="Property registry" description="Search, filter and sort the property registry directly in the database. Large portfolios load page-by-page without downloading the entire dataset." action={<button onClick={() => void load()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>} />
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Records found" value={totalProperties} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Verified · page" value={verified} icon={<CheckCircle className="h-5 w-5" />} accent="blue" />
        <StatCard label="Awaiting review · page" value={pending} icon={<ShieldCheck className="h-5 w-5" />} accent="accent" />
        <StatCard label="Suspended · page" value={suspended} icon={<XCircle className="h-5 w-5" />} accent="red" />
      </div>
      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 lg:flex-row lg:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" placeholder="Search property, owner, town or county…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
        <div className="flex flex-col gap-3 sm:flex-row"><select className="input min-w-48" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="pending_verification">Pending verification</option><option value="verified">Verified</option><option value="rejected">Rejected</option><option value="suspended">Suspended</option></select><select className="input min-w-40" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></div>
      </div>
      {loading ? <LoadingPage /> : properties.length === 0 ? <EmptyState icon={<Building2 className="h-8 w-8" />} title="No matching properties" description="Try a different search, status or sort option." /> : (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 bg-gradient-to-r from-white to-brand-50/30 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-ink-900">Property registry</h3><p className="text-xs text-ink-500">Server-side results · {totalProperties} matching record{totalProperties === 1 ? '' : 's'}</p></div><span className="badge bg-brand-50 text-brand-700">Live registry</span></div></div>
          <div className="overflow-x-auto"><table className="premium-table w-full min-w-[980px] text-sm"><thead><tr><th>Property</th><th>Owner</th><th>Location</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {properties.map((p) => <tr key={p.id} className={selectedProperty === p.id ? 'bg-brand-50/70' : ''}>
              <td><button type="button" className="text-left" onClick={() => navigate(`/property/${p.id}`)}><p className="font-semibold text-ink-900 hover:text-brand-700">{p.name}</p><p className="mt-0.5 text-xs text-ink-400">{p.number_of_units || 0} listed units · {p.number_of_floors || 0} floors</p></button></td>
              <td><div className="flex items-center gap-2"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">{(p.profiles?.full_name || 'U').slice(0,1).toUpperCase()}</span><span>{p.profiles?.full_name || 'Unassigned'}</span></div></td>
              <td><p>{p.town}, {p.county}</p><p className="text-xs text-ink-400">{p.estate || p.address || 'Address not supplied'}</p></td>
              <td>{p.property_type}</td><td><Badge status={p.status} /></td>
              <td><div className="flex items-center gap-1.5">
                <button type="button" onClick={() => navigate(`/property/${p.id}`)} className="icon-action" title="View property"><Eye className="h-4 w-4" /></button>
                {p.status === 'pending_verification' && <><button type="button" onClick={() => void updateStatus(p.id, 'verified')} className="icon-action text-brand-700" title="Verify property"><CheckCircle className="h-4 w-4" /></button><button type="button" onClick={() => void updateStatus(p.id, 'rejected')} className="icon-action text-red-600" title="Reject property"><XCircle className="h-4 w-4" /></button></>}
                {p.status === 'verified' && <button type="button" onClick={() => void updateStatus(p.id, 'suspended')} className="icon-action text-accent-700" title="Suspend property"><ShieldCheck className="h-4 w-4" /></button>}
                {p.status === 'suspended' && <button type="button" onClick={() => void updateStatus(p.id, 'verified')} className="icon-action text-brand-700" title="Reactivate property"><CheckCircle className="h-4 w-4" /></button>}
              </div></td>
            </tr>)}
          </tbody></table></div>
        </Card>
      )}
      <Pagination page={page} totalPages={totalPages} totalItems={totalProperties} pageSize={20} onPageChange={setPage} />
    </DashboardLayout>
  );
}

export function AdminUsers() {
  const { path } = useRouter();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [query, setQuery] = useState('');
  const [role, setRole] = useState(params.get('role') || 'all');
  const [sort, setSort] = useState('newest');

  const load = async () => {
    setLoading(true);
    const from = (page - 1) * 20;
    const to = from + 19;
    let dbQuery = supabase.from('profiles').select('*', { count: 'exact' });
    if (role !== 'all') dbQuery = dbQuery.eq('role', role);
    if (query.trim()) {
      const q = query.trim();
      dbQuery = dbQuery.or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,kra_pin.ilike.%${q}%`);
    }
    dbQuery = sort === 'oldest'
      ? dbQuery.order('created_at', { ascending: true }).order('id', { ascending: true })
      : sort === 'name'
        ? dbQuery.order('full_name', { ascending: true, nullsFirst: false }).order('id', { ascending: true })
        : dbQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
    const { data, count } = await dbQuery.range(from, to);
    setUsers((data as Profile[]) || []);
    setTotalUsers(count || 0);
    setTotalPages(Math.max(1, Math.ceil((count || 0) / 20)));
    setLoading(false);
  };
  useEffect(() => { setPage(1); }, [query, role, sort]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [role, page, query, sort]);
  const count = (r: string) => users.filter((u) => u.role === r).length;
  return <DashboardLayout navItems={adminNav} title="Users">
    <AdminPageHeader eyebrow="Account management" title="Users & access" description="Search and filter customer, owner and administrator accounts directly on the server, with stable pagination for large user bases." action={<button onClick={() => void load()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>} />
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label="Matching accounts" value={totalUsers} icon={<Users className="h-5 w-5" />} /><StatCard label="Customers · page" value={count('customer')} icon={<Users className="h-5 w-5" />} accent="blue" /><StatCard label="Owners · page" value={count('owner')} icon={<Building2 className="h-5 w-5" />} accent="accent" /><StatCard label="Admins · page" value={count('admin')} icon={<ShieldCheck className="h-5 w-5" />} accent="red" /></div>
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 lg:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" placeholder="Search name, phone or KRA PIN…" value={query} onChange={(e) => setQuery(e.target.value)} /></div><div className="flex flex-col gap-3 sm:flex-row"><select className="input sm:w-52" value={role} onChange={(e) => setRole(e.target.value)}><option value="all">All roles</option><option value="customer">Customer</option><option value="owner">Owner</option><option value="admin">Admin</option><option value="agent">Agent</option></select><select className="input sm:w-40" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></div></div>
    {loading ? <LoadingPage /> : users.length === 0 ? <EmptyState icon={<Users className="h-8 w-8" />} title="No matching users" description="Try another search or role." /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="premium-table w-full min-w-[820px] text-sm"><thead><tr><th>User</th><th>Role</th><th>Phone</th><th>KRA PIN</th><th>Joined</th></tr></thead><tbody>{users.map((u) => <tr key={u.id}><td><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700">{(u.full_name || 'U').slice(0,1).toUpperCase()}</span><div><p className="font-semibold text-ink-900">{u.full_name || 'Unnamed user'}</p><p className="text-xs text-ink-400">Account ID · {u.id.slice(0, 8)}…</p></div></div></td><td><Badge>{titleCase(u.role)}</Badge></td><td>{u.phone || '—'}</td><td>{u.kra_pin || '—'}</td><td className="text-ink-500">{formatDate(u.created_at)}</td></tr>)}</tbody></table></div></Card>}
    <Pagination page={page} totalPages={totalPages} totalItems={totalUsers} pageSize={20} onPageChange={setPage} />
  </DashboardLayout>;
}

export function AdminReservations() {
  const { toast } = useToast();
  const [reservations, setReservations] = useState<(Reservation & { property_units: { unit_number: string }; properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReservations, setTotalReservations] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const load = async () => {
    setLoading(true);
    let propertyIds: string[] = [];
    let unitIds: string[] = [];
    if (query.trim()) {
      const q = query.trim();
      const [{ data: properties }, { data: units }] = await Promise.all([
        supabase.from('properties').select('id').ilike('name', `%${q}%`).limit(100),
        supabase.from('property_units').select('id').ilike('unit_number', `%${q}%`).limit(100),
      ]);
      propertyIds = (properties || []).map((row) => row.id);
      unitIds = (units || []).map((row) => row.id);
    }
    const from = (page - 1) * 20; const to = from + 19;
    let dbQuery = supabase.from('reservations').select('*, property_units(unit_number), properties(name)', { count: 'exact' });
    if (filter !== 'all') dbQuery = dbQuery.eq('status', filter);
    if (query.trim()) {
      const q = query.trim();
      const clauses = [`id.ilike.%${q}%`, `notes.ilike.%${q}%`];
      if (propertyIds.length) clauses.push(`property_id.in.(${propertyIds.join(',')})`);
      if (unitIds.length) clauses.push(`unit_id.in.(${unitIds.join(',')})`);
      dbQuery = dbQuery.or(clauses.join(','));
    }
    dbQuery = sort === 'oldest'
      ? dbQuery.order('created_at', { ascending: true }).order('id', { ascending: true })
      : dbQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
    const { data, count, error } = await dbQuery.range(from, to);
    if (error) toast(`Could not load reservations: ${error.message}`, 'error');
    setReservations((data as typeof reservations) || []); setTotalReservations(count || 0); setTotalPages(Math.max(1, Math.ceil((count || 0) / 20))); setLoading(false);
  };
  useEffect(() => { setPage(1); }, [query, filter, sort]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [page, query, filter, sort]);
  const update = async (id: string, status: 'confirmed' | 'cancelled') => { const { error } = await supabase.rpc('update_reservation_status_by_manager', { p_reservation_id: id, p_status: status }); if (error) { toast(`Could not update reservation: ${error.message}`, 'error'); return; } toast(`Reservation ${titleCase(status)}`, 'success'); await load(); };
  const pending = reservations.filter((r) => r.status === 'pending').length;
  const confirmed = reservations.filter((r) => r.status === 'confirmed').length;
  return <DashboardLayout navItems={adminNav} title="Reservations">
    <AdminPageHeader eyebrow="Booking control" title="Reservations" description="Search, filter and sort reservations on the server while keeping unit status synchronized during approval." action={<button onClick={() => void load()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>} />
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label="Matching reservations" value={totalReservations} icon={<Calendar className="h-5 w-5" />} /><StatCard label="Pending · page" value={pending} icon={<Calendar className="h-5 w-5" />} accent="accent" /><StatCard label="Confirmed · page" value={confirmed} icon={<CheckCircle className="h-5 w-5" />} accent="blue" /><StatCard label="Converted · page" value={reservations.filter(r => r.status === 'converted').length} icon={<ShieldCheck className="h-5 w-5" />} /></div>
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 sm:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" placeholder="Search property, unit, reservation ID or notes…" value={query} onChange={(e)=>setQuery(e.target.value)} /></div><div className="flex gap-3"><select className="input sm:w-48" value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="all">All statuses</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="converted">Converted</option></select><select className="input sm:w-40" value={sort} onChange={(e)=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div></div>
    {loading ? <LoadingPage /> : reservations.length === 0 ? <EmptyState icon={<Calendar className="h-8 w-8" />} title="No matching reservations" description="Try another search or status." /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="premium-table w-full min-w-[900px] text-sm"><thead><tr><th>Property</th><th>Unit</th><th>Fee</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{reservations.map((r) => <tr key={r.id}><td><p className="font-semibold text-ink-900">{r.properties?.name || '—'}</p><p className="text-xs text-ink-400">Reservation · {r.id.slice(0,8)}…</p></td><td className="font-medium">{r.property_units?.unit_number || '—'}</td><td className="font-semibold">{formatKES(r.reservation_fee)}</td><td><Badge status={r.status} /></td><td className="text-ink-500">{formatDate(r.created_at)}</td><td>{r.status === 'pending' ? <div className="flex gap-2"><button type="button" onClick={() => void update(r.id, 'confirmed')} className="btn-primary px-3 py-2 text-xs"><CheckCircle className="h-3.5 w-3.5" /> Confirm</button><button type="button" onClick={() => void update(r.id, 'cancelled')} className="btn-secondary px-3 py-2 text-xs text-red-600"><XCircle className="h-3.5 w-3.5" /> Cancel</button></div> : <span className="text-xs text-ink-400">No action</span>}</td></tr>)}</tbody></table></div></Card>}
    <Pagination page={page} totalPages={totalPages} totalItems={totalReservations} pageSize={20} onPageChange={setPage} />
  </DashboardLayout>;
}

export function AdminPayments() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<(Payment & { properties: { name: string } | null; profiles: { full_name: string | null; phone: string | null } | null; property_units: { unit_number: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = async () => {
    setLoading(true);
    let userIds: string[] = [];
    let propertyIds: string[] = [];
    let unitIds: string[] = [];
    if (query.trim()) {
      const q = query.trim();
      const [{ data: profiles }, { data: properties }, { data: units }] = await Promise.all([
        supabase.from('profiles').select('id').or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`).limit(100),
        supabase.from('properties').select('id').ilike('name', `%${q}%`).limit(100),
        supabase.from('property_units').select('id').ilike('unit_number', `%${q}%`).limit(100),
      ]);
      userIds = (profiles || []).map((row) => row.id); propertyIds = (properties || []).map((row) => row.id); unitIds = (units || []).map((row) => row.id);
    }
    const from = (page - 1) * 20; const to = from + 19;
    let dbQuery = supabase.from('payments').select('*, properties(name), profiles:user_id(full_name,phone), property_units(unit_number)', { count: 'exact' });
    if (filter === 'pending') dbQuery = dbQuery.eq('status', 'pending').eq('verified', false);
    else if (filter === 'verified') dbQuery = dbQuery.eq('verified', true);
    else if (filter !== 'all') dbQuery = dbQuery.eq('status', filter);
    if (query.trim()) {
      const q = query.trim();
      const clauses = [`transaction_ref.ilike.%${q}%`, `provider_reference.ilike.%${q}%`];
      if (userIds.length) clauses.push(`user_id.in.(${userIds.join(',')})`);
      if (propertyIds.length) clauses.push(`property_id.in.(${propertyIds.join(',')})`);
      if (unitIds.length) clauses.push(`unit_id.in.(${unitIds.join(',')})`);
      dbQuery = dbQuery.or(clauses.join(','));
    }
    dbQuery = sort === 'oldest'
      ? dbQuery.order('created_at', { ascending: true }).order('id', { ascending: true })
      : dbQuery.order('created_at', { ascending: false }).order('id', { ascending: false });
    const { data, count, error } = await dbQuery.range(from, to);
    if (error) toast(`Could not load payments: ${error.message}`, 'error');
    setPayments((data as typeof payments) || []); setTotalPayments(count || 0); setTotalPages(Math.max(1, Math.ceil((count || 0) / 20))); setLoading(false);
  };
  useEffect(() => { setPage(1); }, [query, filter, sort]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [page, query, filter, sort]);
  const review = async (id: string, action: 'verify' | 'reject') => { setBusyId(id); const { error } = await supabase.rpc('review_payment_by_admin', { p_payment_id: id, p_action: action }); setBusyId(null); if (error) { toast(`Could not ${action} payment: ${error.message}`, 'error'); return; } toast(action === 'verify' ? 'Payment verified and receipt issued.' : 'Payment rejected.', action === 'verify' ? 'success' : 'info'); await load(); };
  const verifiedTotal = payments.filter(p => p.verified && p.status === 'successful').reduce((s,p)=>s+Number(p.amount||0),0);
  return <DashboardLayout navItems={adminNav} title="Payments">
    <AdminPageHeader eyebrow="Finance control" title="Payments & verification" description="Search payment records on the server by tenant, property, unit or reference, then review transactions without loading the full ledger." action={<button onClick={() => void load()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>} />
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4"><StatCard label="Matching payments" value={totalPayments} icon={<Receipt className="h-5 w-5" />} /><StatCard label="Verified revenue · page" value={formatKES(verifiedTotal)} icon={<Wallet className="h-5 w-5" />} accent="blue" /><StatCard label="Awaiting verification · page" value={payments.filter(p => !p.verified && p.status === 'pending').length} icon={<ShieldCheck className="h-5 w-5" />} accent="accent" /><StatCard label="Verified · page" value={payments.filter(p => p.verified).length} icon={<CheckCircle className="h-5 w-5" />} accent="brand" /></div>
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 lg:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" placeholder="Search tenant, property, unit or transaction reference…" value={query} onChange={(e)=>setQuery(e.target.value)} /></div><div className="flex gap-3"><select className="input sm:w-56" value={filter} onChange={(e)=>setFilter(e.target.value)}><option value="all">All payments</option><option value="pending">Awaiting verification</option><option value="verified">Verified</option><option value="successful">Successful</option><option value="failed">Failed</option><option value="cancelled">Cancelled</option><option value="refunded">Refunded</option></select><select className="input sm:w-40" value={sort} onChange={(e)=>setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div></div>
    {loading ? <LoadingPage /> : payments.length === 0 ? <EmptyState icon={<Wallet className="h-8 w-8" />} title="No matching payments" description="Try another search or payment status." /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="premium-table w-full min-w-[1180px] text-sm"><thead><tr><th>Tenant</th><th>Property / Unit</th><th>Type</th><th>Amount</th><th>Method</th><th>Status</th><th>Reference</th><th>Date</th><th>Action</th></tr></thead><tbody>{payments.map((p) => <tr key={p.id}><td><p className="font-semibold text-ink-900">{p.profiles?.full_name || 'Unnamed tenant'}</p><p className="text-xs text-ink-400">{p.profiles?.phone || 'No phone'}</p></td><td><p className="font-medium text-ink-900">{p.properties?.name || '—'}</p><p className="text-xs text-ink-400">Unit {p.property_units?.unit_number || '—'}</p></td><td className="capitalize">{p.payment_type}</td><td className="font-bold">{formatKES(p.amount)}</td><td className="capitalize">{String(p.payment_method).replace('_',' ')}</td><td><Badge status={p.status} />{p.verified && <span className="ml-2 badge bg-brand-50 text-brand-700">Verified</span>}</td><td className="max-w-40 truncate font-mono text-xs text-ink-500" title={p.transaction_ref || p.provider_reference || ''}>{p.transaction_ref || p.provider_reference || 'Pending ref'}</td><td className="text-ink-500">{formatDate(p.created_at)}</td><td>{!p.verified && p.status === 'pending' ? <div className="flex gap-2"><button type="button" disabled={busyId === p.id} onClick={()=>void review(p.id,'verify')} className="btn-primary px-3 py-2 text-xs">{busyId===p.id ? 'Working…' : <><CheckCircle className="h-3.5 w-3.5" /> Verify & issue receipt</>}</button><button type="button" disabled={busyId===p.id} onClick={()=>void review(p.id,'reject')} className="icon-action text-red-600" title="Reject payment"><XCircle className="h-4 w-4" /></button></div> : p.verified ? <button type="button" onClick={()=>downloadPaymentReceiptPdf({ payment:p, propertyName:p.properties?.name || 'Property', unitNumber:p.property_units?.unit_number || null, tenantName:p.profiles?.full_name || 'Tenant' })} className="btn-secondary px-3 py-2 text-xs"><Download className="h-3.5 w-3.5" /> Receipt</button> : <span className="text-xs text-ink-400">No action</span>}</td></tr>)}</tbody></table></div></Card>}
    <Pagination page={page} totalPages={totalPages} totalItems={totalPayments} pageSize={20} onPageChange={setPage} />
  </DashboardLayout>;
}

function AdminPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col gap-4 rounded-3xl brand-gradient p-6 text-white shadow-soft-lg sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-white/65">{eyebrow}</p><h2 className="mt-1 text-2xl font-bold text-white">{title}</h2><p className="mt-2 max-w-3xl text-sm text-white/80">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}

export function AdminUnits() {
  const { path, navigate } = useRouter();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const status = params.get('status') || 'all';
  const [units, setUnits] = useState<Array<{
    id: string; property_id: string; unit_number: string; floor: number | null; house_type: string | null;
    bedrooms: number; monthly_rent: number; status: string; created_at: string; properties: { name: string; property_type: string } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUnits, setTotalUnits] = useState(0);

  useEffect(() => {
    (async () => {
      let query = supabase.from('property_units').select('id,property_id,unit_number,floor,house_type,bedrooms,monthly_rent,status,created_at,properties(name,property_type)', { count: 'exact' }).order('created_at', { ascending: false }).order('id', { ascending: false });
      if (status !== 'all') query = query.eq('status', status);
      const from = (page - 1) * 20; const to = from + 19;
      const { data, count, error } = await query.range(from, to);
      if (error) {
        console.error('Admin units load failed:', error);
        setUnits([]);
        setTotalPages(1);
        setTotalUnits(0);
        setLoading(false);
        return;
      }
      const normalized = (data || []).map((row) => ({
        ...row,
        properties: Array.isArray(row.properties) ? (row.properties[0] ?? null) : (row.properties ?? null),
      }));
      setUnits(normalized as unknown as typeof units); setTotalUnits(count || 0); setTotalPages(Math.max(1, Math.ceil((count || 0) / 20)));
      setLoading(false);
    })();
  }, [status, page]);

  const title = status === 'all' ? 'All Units' : `${titleCase(status)} Units`;
  return (
    <DashboardLayout navItems={adminNav} title="Units">
      <AdminPageHeader eyebrow="Portfolio inventory" title={title} description="Inspect the live unit inventory across the portfolio. Newly added units appear first, and large inventories are loaded page-by-page from the database." />
      <div className="mb-6 flex flex-wrap gap-2">
        {['all','available','occupied','reserved','maintenance'].map((value) => <button key={value} type="button" onClick={() => { setPage(1); navigate(value === 'all' ? '/admin/units' : `/admin/units?status=${value}`); }} className={`rounded-full border px-4 py-2 text-xs font-semibold transition-all ${status === value ? 'border-brand-700 bg-brand-700 text-white shadow-sm' : 'border-ink-200 bg-white text-ink-600 hover:border-brand-200 hover:bg-brand-50'}`}>{titleCase(value)}</button>)}
      </div>
      {loading ? <LoadingPage /> : units.length === 0 ? <EmptyState icon={<Home className="w-8 h-8" />} title="No matching units" description="Units will appear here as properties are configured." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto"><table className="premium-table w-full min-w-[900px] text-sm"><thead><tr><th>Property</th><th>Type</th><th>Unit</th><th>Floor</th><th>Bedrooms</th><th>Rent</th><th>Status</th></tr></thead><tbody>{units.map((u) => <tr key={u.id} className="cursor-pointer hover:bg-brand-50/60" onClick={() => navigate(`/property/${u.property_id}`)}><td className="px-4 py-4 font-semibold text-ink-900">{u.properties?.name || '—'}</td><td className="px-4 py-4">{u.properties?.property_type || '—'}</td><td className="px-4 py-4 font-medium">{u.unit_number}</td><td className="px-4 py-4">{u.floor ? `Floor ${u.floor}` : '—'}</td><td className="px-4 py-4">{u.bedrooms || 'Studio'}</td><td className="px-4 py-4 font-semibold">{formatKES(u.monthly_rent)}</td><td className="px-4 py-4"><Badge status={u.status} /></td></tr>)}</tbody></table></div>
          <div className="border-t border-ink-100 bg-ink-50/30 px-4 py-3 text-xs text-ink-500">Showing the newest units first. Page {page} of {totalPages}.</div>
        </Card>
      )}
      <Pagination page={page} totalPages={totalPages} totalItems={totalUnits} pageSize={20} onPageChange={setPage} />
</DashboardLayout>
  );
}

export function AdminTax() {
  const { path } = useRouter();
  const period = new URLSearchParams(path.split('?')[1] || '').get('period') || new Date().toISOString().slice(0, 7);
  const [records, setRecords] = useState<Array<TaxRecord & { properties: { name: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  useEffect(() => { (async () => { const from = (page - 1) * 20; const to = from + 19; const { data, count } = await supabase.from('tax_records').select('*, properties(name)', { count: 'exact' }).eq('period', period).order('created_at', { ascending: false }).range(from, to); setRecords((data as typeof records) || []); setTotalPages(Math.max(1, Math.ceil((count || 0) / 20))); setLoading(false); })(); }, [period, page]);
  const total = records.reduce((sum, r) => sum + Number(r.estimated_tax || 0), 0);
  return (
    <DashboardLayout navItems={adminNav} title="Tax">
      <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Compliance overview</p><h2 className="mt-1 text-2xl font-bold text-ink-900">Tax records · {period}</h2><p className="mt-1 text-sm text-ink-500">Estimated tax by property for the selected reporting period.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"><StatCard label="Tax Records" value={records.length} icon={<Receipt className="w-5 h-5" />} /><StatCard label="Estimated Tax" value={formatKES(total)} icon={<Receipt className="w-5 h-5" />} accent="red" /><StatCard label="Prepared / Filed" value={records.filter(r => ['prepared','filed','paid'].includes(r.status)).length} icon={<CheckCircle className="w-5 h-5" />} accent="blue" /></div>
      {loading ? <LoadingPage /> : records.length === 0 ? <EmptyState icon={<Receipt className="w-8 h-8" />} title="No tax records for this period" description="Calculate tax from the owner tax workspace to create a record." /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-ink-50 text-left text-ink-500"><tr><th className="px-4 py-3">Property</th><th className="px-4 py-3">Gross income</th><th className="px-4 py-3">Expenses</th><th className="px-4 py-3">Taxable</th><th className="px-4 py-3">Tax</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-ink-100">{records.map(r => <tr key={r.id} className="hover:bg-ink-50"><td className="px-4 py-4 font-semibold text-ink-900">{r.properties?.name || 'Portfolio'}</td><td className="px-4 py-4">{formatKES(r.gross_income)}</td><td className="px-4 py-4">{formatKES(r.allowable_expenses)}</td><td className="px-4 py-4">{formatKES(r.taxable_income)}</td><td className="px-4 py-4 font-bold text-brand-700">{formatKES(r.estimated_tax)}</td><td className="px-4 py-4"><Badge status={r.status} /></td></tr>)}</tbody></table></div></Card>}
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
</DashboardLayout>
  );
}


type AdminFinancialMonthly = { period: string; expected: number; collected: number; expenses: number; payouts: number };
type AdminFinancialProperty = { id: string; name: string; expected: number; collected: number; expenses: number; units: number; occupied: number; net: number };
type AdminFinancialData = { period: string; expected_rent: number; collected_rent: number; collection_rate: number; arrears: number; expenses: number; net_operating_income: number; owner_payouts: number; monthly: AdminFinancialMonthly[]; properties: AdminFinancialProperty[] };

function AdminFinancialCommandCenter({ data }: { data: AdminFinancialData }) {
  const maxMonthly = Math.max(1, ...data.monthly.flatMap((m) => [m.expected, m.collected, m.expenses]));
  const topProperties = [...data.properties].sort((a,b) => b.net-a.net).slice(0,6);
  const occupied = data.properties.reduce((n,p) => n+p.occupied,0); const units = data.properties.reduce((n,p) => n+p.units,0); const occupancyRate = units ? Math.round(occupied/units*100) : 0;
  const metric = (label:string,value:string,note:string,positive=true) => <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{label}</p>{positive ? <ArrowUpRight className="h-4 w-4 text-brand-600"/> : <ArrowDownRight className="h-4 w-4 text-accent-600"/>}</div><p className="mt-2 text-xl font-bold text-ink-900">{value}</p><p className="mt-1 text-xs text-ink-500">{note}</p></div>;
  const maxNet=Math.max(1,...topProperties.map(p=>Math.max(0,p.net)));
  return <Card className="mb-7 overflow-hidden"><div className="border-b border-ink-100 bg-gradient-to-r from-white to-brand-50/40 px-5 py-4"><div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-brand-700"/><h3 className="font-semibold text-ink-900">Financial command centre</h3></div><p className="mt-1 text-xs text-ink-500">Portfolio cash performance, arrears and operating profitability for {data.period}, with a six-month trend.</p></div><span className="badge bg-brand-50 text-brand-700">Management finance</span></div></div><div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-3 lg:grid-cols-6">{metric('Expected rent',formatKES(data.expected_rent),'Invoice value')}{metric('Collected',formatKES(data.collected_rent),`${data.collection_rate}% collection rate`)}{metric('Arrears',formatKES(data.arrears),'Past-due invoice balance',false)}{metric('Expenses',formatKES(data.expenses),'Recorded operating costs',false)}{metric('Net operating',formatKES(data.net_operating_income),'Collected less expenses',data.net_operating_income>=0)}{metric('Owner payouts',formatKES(data.owner_payouts),`${occupancyRate}% portfolio occupancy`)}</div><div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-[1.45fr_1fr]"><div className="rounded-2xl border border-ink-100 p-4"><div className="mb-4"><h4 className="font-semibold text-ink-900">Six-month cash trend</h4><p className="text-xs text-ink-500">Expected rent, verified collections and expenses.</p></div><div className="space-y-3">{data.monthly.map(m=><div key={m.period}><div className="mb-1 flex items-center justify-between text-[11px] font-medium text-ink-500"><span>{m.period}</span><span>{formatKES(m.collected)} collected</span></div><div className="h-2.5 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-600" style={{width:`${Math.max(2,Math.round(m.collected/maxMonthly*100))}%`}}/></div><div className="mt-1 flex gap-3 text-[10px] text-ink-400"><span>Expected {formatKES(m.expected)}</span><span>Expenses {formatKES(m.expenses)}</span></div></div>)}</div></div><div className="rounded-2xl border border-ink-100 p-4"><div className="mb-4"><h4 className="font-semibold text-ink-900">Property profitability</h4><p className="text-xs text-ink-500">Net cash contribution after recorded expenses.</p></div><div className="space-y-3">{topProperties.map(p=><div key={p.id}><div className="flex items-center justify-between gap-3"><p className="truncate text-sm font-semibold text-ink-800">{p.name}</p><p className={`text-sm font-bold ${p.net>=0?'text-brand-700':'text-red-600'}`}>{formatKES(p.net)}</p></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-100"><div className="h-full rounded-full bg-brand-500" style={{width:`${Math.min(100,Math.max(3,Math.round(Math.max(0,p.net)/maxNet*100)))}%`}}/></div><p className="mt-1 text-[10px] text-ink-400">{p.occupied}/{p.units} occupied · {formatKES(p.expenses)} expenses</p></div>)}{topProperties.length===0&&<p className="text-sm text-ink-500">No property financial records for this period.</p>}</div></div></div></Card>;
}

function OperationalPreview({ title, description, href, icon }: { title: string; description: string; href: string; icon: ReactNode }) {
  const { navigate } = useRouter();
  const [count, setCount] = useState(0);
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    (async () => {
      if (href.endsWith('/expenses')) {
        const result = await loadManagedExpenses('__admin__', 'admin');
        setCount(result.data.length);
        setAmount(result.data.reduce((sum, row) => sum + Number(row.amount || 0), 0));
      } else {
        const result = await loadManagedMaintenance('__admin__', 'admin');
        setCount(result.data.filter((row) => !['completed', 'closed'].includes(String(row.status))).length);
      }
    })();
  }, [href]);
  return <button type="button" onClick={() => navigate(href)} className="group rounded-2xl border border-ink-100 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft-lg">
    <div className="flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">{icon}</div><span className="text-xs font-semibold text-brand-700">Open →</span></div>
    <h3 className="mt-4 font-semibold text-ink-900">{title}</h3><p className="mt-1 text-sm text-ink-500">{description}</p>
    <div className="mt-4 flex items-end justify-between border-t border-ink-100 pt-4"><div><p className="text-2xl font-bold text-ink-900">{count}</p><p className="text-xs text-ink-400">{href.endsWith('/expenses') ? 'recorded expenses' : 'open requests'}</p></div>{href.endsWith('/expenses') && <div className="text-right"><p className="text-lg font-bold text-brand-700">{formatKES(amount)}</p><p className="text-xs text-ink-400">total recorded</p></div>}</div>
  </button>;
}

export function AdminExpenses() {
  const [rows, setRows] = useState<import('@/lib/operationalData').ManagedExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();
  const load = async () => {
    setLoading(true);
    const rpc = await supabase.rpc('get_managed_expenses_page', { p_page: page, p_page_size: 20 });
    const payload = (rpc.data || {}) as { rows?: Record<string, unknown>[]; total_count?: number };
    const rows: ManagedExpenseRow[] = Array.isArray(payload.rows) ? payload.rows.map((row) => ({
      id: String(row.id), property_id: String(row.property_id), owner_id: String(row.owner_id), category: String(row.category || ''),
      amount: Number(row.amount || 0), expense_date: String(row.expense_date || ''), vendor: row.vendor == null ? null : String(row.vendor),
      description: row.description == null ? null : String(row.description), payment_method: String(row.payment_method || 'cash'),
      created_at: String(row.created_at || ''), properties: row.property_name ? { name: String(row.property_name) } : null,
    })) : [];
    const result = { data: rows, error: rpc.error };
    setRows(result.data); setTotalPages(Math.max(1, Math.ceil(Number(payload.total_count || 0) / 20)));
    if (result.error) {
      const message = result.error instanceof Error
        ? result.error.message
        : (typeof result.error === 'object' && result.error !== null && 'message' in result.error
          ? String((result.error as { message?: unknown }).message || 'Database request failed.')
          : 'Database request failed.');
      toast(`Could not load expenses: ${message}`, 'error');
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, [page]);
  return <DashboardLayout navItems={adminNav} title="Expenses">
    <AdminPageHeader eyebrow="Portfolio finance" title="Expense ledger" description="A live ledger of operating costs recorded against every property. Owner-submitted expenses are retained against the correct property owner." action={<button onClick={() => void load()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>} />
    {loading ? <LoadingPage /> : rows.length === 0 ? <EmptyState icon={<Receipt className="h-8 w-8" />} title="No expenses recorded" description="Expenses recorded by owners or administrators will appear here." /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="premium-table w-full min-w-[900px] text-sm"><thead><tr><th>Property</th><th>Category</th><th>Amount</th><th>Date</th><th>Vendor</th><th>Method</th></tr></thead><tbody>{rows.map((e) => <tr key={String(e.id)} className="hover:bg-ink-50"><td className="px-4 py-4 font-semibold text-ink-900">{e.properties?.name || '—'}</td><td className="px-4 py-4">{e.category}</td><td className="px-4 py-4 font-bold">{formatKES(Number(e.amount || 0))}</td><td className="px-4 py-4 text-ink-500">{formatDate(String(e.expense_date))}</td><td className="px-4 py-4">{e.vendor || '—'}</td><td className="px-4 py-4 capitalize">{e.payment_method || 'cash'}</td></tr>)}</tbody></table></div></Card>}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
</DashboardLayout>;
}

export function AdminMaintenance() {
  const [rows, setRows] = useState<import('@/lib/operationalData').ManagedMaintenanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const { toast } = useToast();
  const load = async () => { setLoading(true); const rpc = await supabase.rpc('get_managed_maintenance_page', { p_page: page, p_page_size: 20 }); const payload = (rpc.data || {}) as { rows?: Record<string, unknown>[]; total_count?: number }; const data = Array.isArray(payload.rows) ? payload.rows.map((row) => ({ ...row, properties: row.property_name ? { name: String(row.property_name) } : null, property_units: row.unit_number ? { unit_number: String(row.unit_number) } : null, profiles: { full_name: row.tenant_name == null ? null : String(row.tenant_name), phone: row.tenant_phone == null ? null : String(row.tenant_phone) } })) : []; setRows(data as import('@/lib/operationalData').ManagedMaintenanceRow[]); setTotalPages(Math.max(1, Math.ceil(Number(payload.total_count || 0) / 20))); setLoading(false); };
  useEffect(() => { load(); }, [page]);
  const update = async (id: string, status: string) => { const { error } = await supabase.rpc('update_maintenance_status_by_manager', { p_request_id: id, p_status: status }); if (error) { toast(error.message, 'error'); return; } toast(`Request ${titleCase(status)}`, 'success'); await load(); };
  return <DashboardLayout navItems={adminNav} title="Maintenance">
    <div className="mb-6 rounded-2xl brand-gradient p-6 text-white shadow-soft-lg"><p className="text-sm font-semibold text-white/80">Service desk</p><h2 className="mt-1 text-2xl font-bold">Maintenance & service requests</h2><p className="mt-1 text-sm text-white/80">Review tenant-reported issues, assign work and track completion across the portfolio.</p></div>
    {loading ? <LoadingPage /> : rows.length === 0 ? <EmptyState icon={<Wrench className="h-8 w-8" />} title="No service requests" description="Tenant maintenance requests will appear here as soon as they are submitted." /> : <div className="space-y-3">{rows.map((r) => <Card key={String(r.id)} className="p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-ink-900">{titleCase(String(r.category || 'other'))}</h3><Badge status={String(r.status)} /><Badge>{String(r.priority || 'medium')}</Badge></div><p className="mt-2 text-sm text-ink-600">{String(r.description || '')}</p><p className="mt-2 text-xs text-ink-400">{r.properties?.name || '—'} · Unit {r.property_units?.unit_number || '—'} · {r.profiles?.full_name || 'Tenant'} · {formatDate(String(r.created_at))}</p></div><select className="input w-full lg:w-48" value={String(r.status)} onChange={(e) => update(String(r.id), e.target.value)}><option value="submitted">Submitted</option><option value="assigned">Assigned</option><option value="in_progress">In Progress</option><option value="awaiting_parts">Awaiting Parts</option><option value="completed">Completed</option><option value="closed">Closed</option></select></div></Card>)}</div>}
        <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
  </DashboardLayout>;
}

export function AdminLeases() {
  const { toast } = useToast();
  const [leases, setLeases] = useState<Array<{
    id: string; tenant_id: string; property_id: string; unit_id: string; lease_start: string; lease_end: string;
    monthly_rent: number; deposit: number; service_charge: number; status: string; signed_by_tenant: boolean; signed_by_owner: boolean;
    tenant_name: string | null; tenant_phone: string | null; property_name: string | null; unit_number: string | null;
    outstanding_balance: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selected, setSelected] = useState<typeof leases[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const pageSize = 20;

  const load = async () => {
    setLoading(true);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let q = supabase.from('leases').select('id,tenant_id,property_id,unit_id,lease_start,lease_end,monthly_rent,deposit,service_charge,status,signed_by_tenant,signed_by_owner,created_at,profiles:tenant_id(full_name,phone),properties(name),property_units(unit_number)', { count: 'exact' });
    if (status !== 'all') q = q.eq('status', status);
    if (query.trim()) {
      const safe = query.trim().replace(/[%_]/g, '');
      const [{ data: people }, { data: properties }, { data: units }] = await Promise.all([
        supabase.from('profiles').select('id').or(`full_name.ilike.%${safe}%,phone.ilike.%${safe}%`).limit(100),
        supabase.from('properties').select('id').or(`name.ilike.%${safe}%,town.ilike.%${safe}%,county.ilike.%${safe}%`).limit(100),
        supabase.from('property_units').select('id').ilike('unit_number', `%${safe}%`).limit(100),
      ]);
      const clauses = [`id.eq.${safe}`];
      if ((people || []).length) clauses.push(`tenant_id.in.(${(people || []).map(x => x.id).join(',')})`);
      if ((properties || []).length) clauses.push(`property_id.in.(${(properties || []).map(x => x.id).join(',')})`);
      if ((units || []).length) clauses.push(`unit_id.in.(${(units || []).map(x => x.id).join(',')})`);
      q = q.or(clauses.join(','));
    }
    q = sort === 'expiry'
      ? q.order('lease_end', { ascending: true }).order('id', { ascending: true })
      : sort === 'oldest'
        ? q.order('created_at', { ascending: true }).order('id', { ascending: true })
        : q.order('created_at', { ascending: false }).order('id', { ascending: false });
    const { data, count, error } = await q.range(from, to);
    if (error) {
      toast(`Could not load leases: ${error.message}`, 'error');
      setLeases([]); setTotal(0); setLoading(false); return;
    }
    const raw = (data || []) as unknown as Array<Record<string, unknown>>;
    const leaseIds = raw.map(r => String(r.id));
    let balances = new Map<string, number>();
    if (leaseIds.length) {
      const { data: invoices } = await supabase.from('rent_invoices').select('lease_id,balance,status').in('lease_id', leaseIds);
      balances = new Map<string, number>();
      (invoices || []).forEach((inv) => balances.set(String(inv.lease_id), (balances.get(String(inv.lease_id)) || 0) + Math.max(0, Number(inv.balance || 0))));
    }
    setLeases(raw.map((r) => {
      const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles as Record<string, unknown> | null;
      const property = Array.isArray(r.properties) ? r.properties[0] : r.properties as Record<string, unknown> | null;
      const unit = Array.isArray(r.property_units) ? r.property_units[0] : r.property_units as Record<string, unknown> | null;
      return {
        id: String(r.id), tenant_id: String(r.tenant_id), property_id: String(r.property_id), unit_id: String(r.unit_id),
        lease_start: String(r.lease_start), lease_end: String(r.lease_end), monthly_rent: Number(r.monthly_rent || 0),
        deposit: Number(r.deposit || 0), service_charge: Number(r.service_charge || 0), status: String(r.status),
        signed_by_tenant: Boolean(r.signed_by_tenant), signed_by_owner: Boolean(r.signed_by_owner),
        tenant_name: profile?.full_name == null ? null : String(profile.full_name), tenant_phone: profile?.phone == null ? null : String(profile.phone),
        property_name: property?.name == null ? null : String(property.name), unit_number: unit?.unit_number == null ? null : String(unit.unit_number),
        outstanding_balance: balances.get(String(r.id)) || 0,
      };
    }));
    setTotal(count || 0); setLoading(false);
  };

  useEffect(() => { setPage(1); }, [query, status, sort]);
  useEffect(() => { void load(); }, [page, query, status, sort]);

  const runAction = async (action: 'renew' | 'moveout' | 'expire') => {
    if (!selected && action !== 'expire') return;
    setBusy(true);
    if (action === 'renew' && selected) {
      const { error } = await supabase.rpc('renew_lease', { p_lease_id: selected.id, p_lease_months: 12 });
      if (error) toast(`Could not renew lease: ${error.message}`, 'error'); else { toast('Lease renewed for 12 months.', 'success'); setSelected(null); await load(); }
    }
    if (action === 'moveout' && selected) {
      const { error } = await supabase.rpc('move_out_lease', { p_lease_id: selected.id, p_reason: 'Move-out recorded by administrator' });
      if (error) toast(`Could not close tenancy: ${error.message}`, 'error'); else { toast('Move-out recorded and unit released.', 'success'); setSelected(null); await load(); }
    }
    if (action === 'expire') {
      const { data, error } = await supabase.rpc('expire_due_leases');
      if (error) toast(`Could not process expiries: ${error.message}`, 'error'); else { toast(`${Number(data || 0)} expired lease(s) processed.`, 'success'); await load(); }
    }
    setBusy(false);
  };

  const today = new Date();
  const daysTo = (date: string) => Math.ceil((new Date(date).getTime() - today.getTime()) / 86400000);
  const active = leases.filter(l => l.status === 'active').length;
  const expiring = leases.filter(l => l.status === 'active' && daysTo(l.lease_end) >= 0 && daysTo(l.lease_end) <= 45).length;
  const overdue = leases.filter(l => l.outstanding_balance > 0).length;
  const pendingSign = leases.filter(l => !l.signed_by_tenant && ['active','pending_signature'].includes(l.status)).length;

  return <DashboardLayout navItems={adminNav} title="Leases & Tenants">
    <AdminPageHeader eyebrow="Tenant lifecycle" title="Leases & Tenants" description="Control the full tenancy lifecycle: active leases, expiry risk, outstanding balances, renewals and move-outs." action={<button type="button" onClick={() => void runAction('expire')} disabled={busy} className="btn-secondary"><CalendarClock className="h-4 w-4" /> Process expired leases</button>} />
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Active leases · page" value={active} icon={<Home className="h-5 w-5" />} />
      <StatCard label="Expiring ≤ 45 days" value={expiring} icon={<CalendarClock className="h-5 w-5" />} accent="accent" />
      <StatCard label="With outstanding balance" value={overdue} icon={<Wallet className="h-5 w-5" />} accent="red" />
      <StatCard label="Awaiting tenant signature" value={pendingSign} icon={<UserRound className="h-5 w-5" />} accent="blue" />
    </div>
    <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 lg:flex-row">
      <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" placeholder="Search tenant, property, unit or lease ID…" value={query} onChange={e => setQuery(e.target.value)} /></div>
      <select className="input lg:w-52" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All lease statuses</option><option value="active">Active</option><option value="pending_signature">Pending signature</option><option value="expired">Expired</option><option value="renewed">Renewed</option><option value="terminated">Terminated</option><option value="draft">Draft</option></select>
      <select className="input lg:w-44" value={sort} onChange={e => setSort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="expiry">Nearest expiry</option></select>
      <button type="button" onClick={() => void load()} className="btn-secondary"><RefreshCw className="h-4 w-4" /> Refresh</button>
    </div>
    {loading ? <LoadingPage /> : leases.length === 0 ? <EmptyState icon={<Users className="h-8 w-8" />} title="No matching leases" description="Try another search or status filter." /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="premium-table w-full min-w-[1120px] text-sm"><thead><tr><th>Tenant</th><th>Property / Unit</th><th>Lease term</th><th>Rent</th><th>Balance</th><th>Status</th><th>Expiry</th><th>Action</th></tr></thead><tbody>{leases.map(l => { const remaining = daysTo(l.lease_end); return <tr key={l.id}><td><p className="font-semibold text-ink-900">{l.tenant_name || 'Unnamed tenant'}</p><p className="text-xs text-ink-400">{l.tenant_phone || 'No phone'}</p></td><td><p className="font-medium">{l.property_name || '—'}</p><p className="text-xs text-ink-400">Unit {l.unit_number || '—'}</p></td><td><p>{formatDate(l.lease_start)} → {formatDate(l.lease_end)}</p><p className="text-xs text-ink-400">{l.signed_by_tenant ? 'Tenant signed' : 'Tenant signature pending'}</p></td><td className="font-bold">{formatKES(l.monthly_rent + l.service_charge)}</td><td className={l.outstanding_balance > 0 ? 'font-bold text-red-600' : 'font-semibold text-brand-700'}>{formatKES(l.outstanding_balance)}</td><td><Badge status={l.status} /></td><td>{l.status === 'active' && remaining >= 0 ? <span className={remaining <= 45 ? 'badge bg-accent-50 text-accent-700' : 'text-ink-500'}>{remaining} days</span> : <span className="text-xs text-ink-400">{remaining < 0 ? `${Math.abs(remaining)} days ago` : '—'}</span>}</td><td><button type="button" onClick={() => setSelected(l)} className="btn-secondary px-3 py-2 text-xs"><Eye className="h-3.5 w-3.5" /> Manage</button></td></tr>})}</tbody></table></div></Card>}
    <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} totalItems={total} pageSize={pageSize} onPageChange={setPage} />
    {selected && <Modal open onClose={() => setSelected(null)} title="Lease lifecycle" size="md"><div className="space-y-5"><div className="rounded-2xl bg-brand-50 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Tenant</p><h3 className="mt-1 text-lg font-bold text-brand-950">{selected.tenant_name || 'Unnamed tenant'}</h3><p className="text-sm text-brand-800">{selected.tenant_phone || 'No phone'} · {selected.property_name || 'Property'} · Unit {selected.unit_number || '—'}</p></div><div className="grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-400">Lease status</p><p className="mt-1 font-semibold"><Badge status={selected.status} /></p></div><div className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-400">Outstanding</p><p className="mt-1 font-semibold">{formatKES(selected.outstanding_balance)}</p></div><div className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-400">Lease period</p><p className="mt-1 font-semibold">{formatDate(selected.lease_start)} → {formatDate(selected.lease_end)}</p></div><div className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-400">Monthly obligation</p><p className="mt-1 font-semibold">{formatKES(selected.monthly_rent + selected.service_charge)}</p></div></div>{selected.status === 'active' && daysTo(selected.lease_end) <= 45 && <div className="flex gap-3 rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800"><AlertTriangle className="h-5 w-5 shrink-0" /><span>This lease is due to expire in {Math.max(0, daysTo(selected.lease_end))} days. Renewal can create a new active term while preserving the old lease record.</span></div>}<div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><button type="button" disabled={busy || !['active','expired'].includes(selected.status)} onClick={() => void runAction('renew')} className="btn-primary"><CalendarClock className="h-4 w-4" /> Renew 12 months</button><button type="button" disabled={busy || !['active','expired'].includes(selected.status)} onClick={() => void runAction('moveout')} className="btn-secondary text-red-600"><LogOut className="h-4 w-4" /> Record move-out</button></div><p className="text-[11px] text-ink-400">Renewal creates a new active lease and first-period invoice, then marks the previous lease as renewed. Move-out terminates the lease and releases the unit.</p></div></Modal>}
  </DashboardLayout>;
}

export function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const fallback: SystemSettings = { id: 1, reservation_fee: 2000, reservation_duration_hours: 48, reservation_fee_policy: 'non_refundable', currency: 'KES', platform_commission_pct: 5, default_tax_rate_pct: 7.5, mpesa_enabled: false, card_enabled: true, bank_transfer_enabled: true, require_property_verification: true, updated_at: new Date().toISOString() };
      const timeout = new Promise<{ data: null; error: { message: string } }>((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'Settings request timed out. Safe defaults are being shown.' } }), 8000));
      const result = await Promise.race([supabase.from('system_settings').select('*').eq('id', 1).maybeSingle(), timeout]);
      if (result.error) setLoadError(result.error.message);
      setSettings((result.data as SystemSettings | null) ?? fallback);
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    const { error } = await supabase.from('system_settings').upsert({ id: 1,
      reservation_fee: settings.reservation_fee,
      reservation_duration_hours: settings.reservation_duration_hours,
      reservation_fee_policy: settings.reservation_fee_policy,
      platform_commission_pct: settings.platform_commission_pct,
      default_tax_rate_pct: settings.default_tax_rate_pct,
      mpesa_enabled: settings.mpesa_enabled,
      card_enabled: settings.card_enabled,
      bank_transfer_enabled: settings.bank_transfer_enabled,
      require_property_verification: settings.require_property_verification,
    }, { onConflict: 'id' });
    setSaving(false);
    if (error) { toast(`Could not save settings: ${error.message}`, 'error'); return; }
    toast('Settings saved successfully', 'success');
  };

  if (loading || !settings) return <DashboardLayout navItems={adminNav} title="Settings"><LoadingPage /></DashboardLayout>;

  return (
    <DashboardLayout navItems={adminNav} title="Settings">
      <h2 className="text-xl font-bold text-ink-900 mb-2">System Settings</h2>
      {loadError && <div className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">Settings loaded with defaults because the database returned an error: {loadError}</div>}
      <Card className="p-6 max-w-3xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div>
            <h3 className="font-semibold text-ink-900 mb-4">Reservation Settings</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div><label className="label">Reservation Fee (KSh)</label><input type="number" className="input" value={settings.reservation_fee} onChange={(e) => setSettings({ ...settings, reservation_fee: parseFloat(e.target.value) })} /></div>
              <div><label className="label">Duration (hours)</label><input type="number" className="input" value={settings.reservation_duration_hours} onChange={(e) => setSettings({ ...settings, reservation_duration_hours: parseInt(e.target.value) })} /></div>
              <div><label className="label">Fee Policy</label><select className="input" value={settings.reservation_fee_policy} onChange={(e) => setSettings({ ...settings, reservation_fee_policy: e.target.value })}><option value="non_refundable">Non-refundable</option><option value="refundable">Refundable</option><option value="deductible_deposit">Deductible from deposit</option><option value="deductible_rent">Deductible from first rent</option></select></div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-ink-900 mb-4">Platform & Tax</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="label">Platform Commission (%)</label><input type="number" step="0.1" className="input" value={settings.platform_commission_pct} onChange={(e) => setSettings({ ...settings, platform_commission_pct: parseFloat(e.target.value) })} /></div>
              <div><label className="label">Default Tax Rate (%)</label><input type="number" step="0.1" className="input" value={settings.default_tax_rate_pct} onChange={(e) => setSettings({ ...settings, default_tax_rate_pct: parseFloat(e.target.value) })} /></div>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-ink-900 mb-4">Payment Methods</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[{ k: 'mpesa_enabled', l: 'M-Pesa' }, { k: 'card_enabled', l: 'Card' }, { k: 'bank_transfer_enabled', l: 'Bank Transfer' }, { k: 'require_property_verification', l: 'Require Verification' }].map((f) => (
                <label key={f.k} className="flex items-center gap-2 text-sm text-ink-700">
                  <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={(settings as unknown as Record<string, unknown>)[f.k] as boolean} onChange={(e) => setSettings({ ...settings, [f.k]: e.target.checked })} />
                  {f.l}
                </label>
              ))}
            </div>
          </div>

          <div className="card p-4 bg-yellow-50 border-yellow-200">
            <p className="text-sm text-yellow-700">
              <strong>KRA Integration:</strong> KRA credentials and API configuration must be stored as secure environment variables and never exposed in frontend code. Integration is modular and can be enabled once official KRA-approved APIs are available.
            </p>
          </div>

          <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</button>
        </form>
      </Card>
    </DashboardLayout>
  );
}
