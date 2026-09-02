import { useState, useEffect } from 'react';
import { Building2, Users, Calendar, Wallet, Home, CheckCircle, XCircle, ShieldCheck, Receipt, UserCheck } from 'lucide-react';
import { DashboardLayout, adminNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from '@/context/RouterContext';
import { formatKES, formatDate, titleCase, normalizeUnitType } from '@/lib/constants';
import type { Property, Profile, Reservation, Payment, SystemSettings, TaxRecord } from '@/lib/supabase';

export function AdminDashboard() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Array<{ id: string; name: string; type: string; units: number; occupied: number; available: number; reserved: number; tenants: number; rent: number; tax: number }>>([]);
  const [customerCount, setCustomerCount] = useState(0);
  const [unitMix, setUnitMix] = useState<Record<string, { total: number; occupied: number; available: number }>>({});

  useEffect(() => {
    (async () => {
      const start = `${period}-01`;
      const next = new Date(`${period}-01T00:00:00`); next.setMonth(next.getMonth() + 1);
      const end = next.toISOString().slice(0, 10);
      const [{ data: props }, { data: units }, { data: leases }, { data: payments }, { data: taxes }, { count: customers }] = await Promise.all([
        supabase.from('properties').select('id,name,property_type').order('created_at', { ascending: false }),
        supabase.from('property_units').select('property_id,status,house_type,bedrooms'),
        supabase.from('leases').select('property_id,status').eq('status', 'active'),
        supabase.from('payments').select('property_id,amount,payment_type,status,verified').eq('status', 'successful').eq('verified', true).gte('created_at', start).lt('created_at', end),
        supabase.from('tax_records').select('property_id,estimated_tax').eq('period', period),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer'),
      ]);
      setCustomerCount(customers || 0);
      const properties = (props || []) as { id: string; name: string; property_type: string }[];
      const unitList = (units || []) as { property_id: string; status: string; house_type: string | null; bedrooms: number }[];
      setUnitMix(unitList.reduce<Record<string, { total: number; occupied: number; available: number }>>((acc, u) => { const key = normalizeUnitType(u.house_type, u.bedrooms); acc[key] ||= { total: 0, occupied: 0, available: 0 }; acc[key].total++; if (u.status === 'occupied') acc[key].occupied++; if (u.status === 'available') acc[key].available++; return acc; }, {}));
      const leaseList = (leases || []) as { property_id: string; status: string }[];
      const paymentList = (payments || []) as { property_id: string | null; amount: number; payment_type: string; status: string; verified: boolean }[];
      const taxList = (taxes || []) as { property_id: string | null; estimated_tax: number }[];
      setSummary(properties.map((p) => ({
        id: p.id, name: p.name, type: p.property_type,
        units: unitList.filter((u) => u.property_id === p.id).length,
        occupied: unitList.filter((u) => u.property_id === p.id && u.status === 'occupied').length,
        available: unitList.filter((u) => u.property_id === p.id && u.status === 'available').length,
        reserved: unitList.filter((u) => u.property_id === p.id && u.status === 'reserved').length,
        tenants: leaseList.filter((l) => l.property_id === p.id).length,
        rent: paymentList.filter((x) => x.property_id === p.id && x.payment_type === 'rent').reduce((a, x) => a + Number(x.amount || 0), 0),
        tax: taxList.filter((x) => x.property_id === p.id).reduce((a, x) => a + Number(x.estimated_tax || 0), 0),
      })));
      setLoading(false);
    })();
  }, [profile, period]);

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
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-ink-900">Property performance</h3><p className="text-sm text-ink-500">Inspect each property independently and drill into its exact portfolio records.</p></div><span className="badge bg-brand-50 text-brand-700">Admin live view</span></div>
        <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">{summary.map(r=>{const occupancy=r.units?Math.round(r.occupied/r.units*100):0;return <button key={r.id} type="button" onClick={()=>navigate(`/admin/properties?property=${r.id}`)} className="group rounded-2xl border border-ink-100 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20"><div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-ink-900 group-hover:text-brand-700">{r.name}</h4><span className="mt-1 inline-flex badge bg-ink-100 text-ink-600">{r.type}</span></div><span className="text-xs font-semibold text-brand-700">Inspect →</span></div><div className="mt-4"><div className="mb-1 flex justify-between text-[11px] text-ink-500"><span>Occupancy</span><span className="font-semibold text-ink-700">{occupancy}%</span></div><div className="h-1.5 rounded-full bg-ink-100"><div className="h-1.5 rounded-full bg-brand-500" style={{width:`${occupancy}%`}}/></div></div><div className="mt-4 grid grid-cols-3 gap-2"><div className="rounded-xl bg-ink-50 p-3"><p className="text-xl font-bold text-ink-900">{r.units}</p><p className="text-[10px] uppercase text-ink-400">Units</p></div><div className="rounded-xl bg-brand-50 p-3"><p className="text-xl font-bold text-brand-700">{r.available}</p><p className="text-[10px] uppercase text-brand-600">Available</p></div><div className="rounded-xl bg-accent-50 p-3"><p className="text-xl font-bold text-accent-700">{r.reserved}</p><p className="text-[10px] uppercase text-accent-600">Reserved</p></div></div><div className="mt-3 grid grid-cols-3 gap-3 border-t border-ink-100 pt-3 text-xs"><div><p className="text-ink-400">Tenants</p><p className="font-semibold">{r.tenants}</p></div><div><p className="text-ink-400">Verified rent</p><p className="font-semibold">{formatKES(r.rent)}</p></div><div><p className="text-ink-400">Est. tax</p><p className="font-semibold text-brand-700">{formatKES(r.tax)}</p></div></div></button>})}</div>
      </Card>
      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6"><div className="mb-4"><h3 className="font-semibold text-ink-900">Actual unit-type mix</h3><p className="text-xs text-ink-500">Bedsitters, 1-bedroom, 2-bedroom and other rentable unit types.</p></div><div className="grid grid-cols-2 gap-3">{Object.entries(unitMix).sort((a,b) => b[1].total-a[1].total).map(([type, x]) => <div key={type} className="rounded-xl border border-ink-100 bg-ink-50 p-3"><p className="text-sm font-semibold text-ink-800">{type}</p><p className="mt-1 text-2xl font-bold text-brand-700">{x.total}</p><p className="text-[11px] text-ink-500">{x.occupied} occupied · {x.available} available</p></div>)}{!Object.keys(unitMix).length && <p className="text-sm text-ink-500">No units yet.</p>}</div></Card>
        <Card className="p-6"><h3 className="font-semibold text-ink-900 mb-4">Customer base</h3><p className="text-3xl font-bold text-brand-700">{customerCount}</p><p className="mt-1 text-sm text-ink-500">Registered customer/tenant accounts</p><div className="mt-5 grid grid-cols-2 gap-3"><div className="rounded-xl bg-brand-50 p-4"><p className="text-xs text-brand-700">Verified properties</p><p className="mt-1 text-lg font-bold text-brand-900">{summary.length}</p></div><div className="rounded-xl bg-ink-50 p-4"><p className="text-xs text-ink-500">Reserved units</p><p className="mt-1 text-lg font-bold text-ink-900">{totals.reserved}</p></div></div></Card>
      </div>
    </DashboardLayout>
  );
}

export function AdminProperties() {
  const { path } = useRouter();
  const selectedProperty = new URLSearchParams(path.split('?')[1] || '').get('property');
  const { toast } = useToast();
  const [properties, setProperties] = useState<(Property & { profiles: { full_name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('properties').select('*, profiles!properties_owner_id_fkey(full_name)').order('created_at', { ascending: false });
      setProperties((data as typeof properties) || []);
      setLoading(false);
    })();
  }, []);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('properties').update({ status }).eq('id', id);
    toast(`Property ${titleCase(status)}`, 'success');
    setProperties(properties.map((p) => p.id === id ? { ...p, status: status as Property['status'] } : p));
  };

  return (
    <DashboardLayout navItems={adminNav} title="Properties">
      <h2 className="text-xl font-bold text-ink-900 mb-6">All Properties</h2>
      {loading ? <LoadingPage /> : properties.length === 0 ? (
        <EmptyState icon={<Building2 className="w-8 h-8" />} title="No properties yet" description="Properties submitted by owners will appear here for verification." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Owner</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Actions</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {properties.map((p) => (
                  <tr key={p.id} className={`${selectedProperty === p.id ? 'bg-brand-50 ring-1 ring-inset ring-brand-200' : 'hover:bg-ink-50'}`}>
                    <td className="px-4 py-3 font-medium text-ink-900">{p.name}</td>
                    <td className="px-4 py-3">{p.profiles?.full_name || '—'}</td>
                    <td className="px-4 py-3">{p.town}, {p.county}</td>
                    <td className="px-4 py-3">{p.property_type}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {p.status === 'pending_verification' && (
                          <>
                            <button onClick={() => updateStatus(p.id, 'verified')} className="text-brand-600 hover:bg-brand-50 p-1.5 rounded-lg" title="Verify"><CheckCircle className="w-4 h-4" /></button>
                            <button onClick={() => updateStatus(p.id, 'rejected')} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg" title="Reject"><XCircle className="w-4 h-4" /></button>
                          </>
                        )}
                        {p.status === 'verified' && <button onClick={() => updateStatus(p.id, 'suspended')} className="text-yellow-600 hover:bg-yellow-50 p-1.5 rounded-lg" title="Suspend"><ShieldCheck className="w-4 h-4" /></button>}
                        {p.status === 'suspended' && <button onClick={() => updateStatus(p.id, 'verified')} className="text-brand-600 hover:bg-brand-50 p-1.5 rounded-lg" title="Reactivate"><CheckCircle className="w-4 h-4" /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}

export function AdminUsers() {
  const { path } = useRouter();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const roleFilter = params.get('role');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (roleFilter) query = query.eq('role', roleFilter);
      const { data } = await query;
      setUsers((data as Profile[]) || []);
      setLoading(false);
    })();
  }, [roleFilter]);

  return (
    <DashboardLayout navItems={adminNav} title="Users">
      <h2 className="text-xl font-bold text-ink-900 mb-6">All Users</h2>
      {loading ? <LoadingPage /> : users.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="No users yet" description="Registered users will appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Name</th><th className="px-4 py-3 font-medium">Role</th><th className="px-4 py-3 font-medium">Phone</th><th className="px-4 py-3 font-medium">KRA PIN</th><th className="px-4 py-3 font-medium">Joined</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{u.full_name || 'Unnamed'}</td>
                    <td className="px-4 py-3"><span className="badge bg-brand-50 text-brand-700 capitalize">{u.role}</span></td>
                    <td className="px-4 py-3">{u.phone || '—'}</td>
                    <td className="px-4 py-3">{u.kra_pin || '—'}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}

export function AdminReservations() {
  const { navigate } = useRouter();
  const [reservations, setReservations] = useState<(Reservation & { property_units: { unit_number: string }; properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('reservations').select('*, property_units(unit_number), properties(name)').order('created_at', { ascending: false });
      setReservations((data as typeof reservations) || []);
      setLoading(false);
    })();
  }, []);

  return (
    <DashboardLayout navItems={adminNav} title="Reservations">
      <h2 className="text-xl font-bold text-ink-900 mb-6">All Reservations</h2>
      {loading ? <LoadingPage /> : reservations.length === 0 ? (
        <EmptyState icon={<Calendar className="w-8 h-8" />} title="No reservations yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Unit</th><th className="px-4 py-3 font-medium">Fee</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {reservations.map((r) => (
                  <tr key={r.id} className="cursor-pointer hover:bg-brand-50/50" onClick={() => navigate(`/admin/properties`)}>
                    <td className="px-4 py-3 font-medium text-ink-900">{r.properties?.name}</td>
                    <td className="px-4 py-3">{r.property_units?.unit_number}</td>
                    <td className="px-4 py-3">{formatKES(r.reservation_fee)}</td>
                    <td className="px-4 py-3"><Badge status={r.status} /></td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}

export function AdminPayments() {
  const [payments, setPayments] = useState<(Payment & { properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('payments').select('*, properties(name)').order('created_at', { ascending: false });
      setPayments((data as typeof payments) || []);
      setLoading(false);
    })();
  }, []);

  const total = payments.filter((p) => p.verified && p.status === 'successful').reduce((s, p) => s + p.amount, 0);

  return (
    <DashboardLayout navItems={adminNav} title="Payments">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Revenue" value={formatKES(total)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Transactions" value={payments.length} icon={<Receipt className="w-5 h-5" />} accent="blue" />
        <StatCard label="Verified" value={payments.filter((p) => p.verified).length} icon={<CheckCircle className="w-5 h-5" />} accent="brand" />
      </div>
      {loading ? <LoadingPage /> : payments.length === 0 ? (
        <EmptyState icon={<Wallet className="w-8 h-8" />} title="No payments yet" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Verified</th><th className="px-4 py-3 font-medium">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{p.properties?.name || '—'}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_type}</td>
                    <td className="px-4 py-3 font-semibold">{formatKES(p.amount)}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
                    <td className="px-4 py-3">{p.verified ? <CheckCircle className="w-4 h-4 text-brand-500" /> : <XCircle className="w-4 h-4 text-ink-300" />}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}


export function AdminUnits() {
  const { path, navigate } = useRouter();
  const params = new URLSearchParams(path.split('?')[1] || '');
  const status = params.get('status') || 'all';
  const [units, setUnits] = useState<Array<{
    id: string; property_id: string; unit_number: string; floor: number | null; house_type: string | null;
    bedrooms: number; monthly_rent: number; status: string; properties: { name: string; property_type: string } | null;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let query = supabase.from('property_units').select('id,property_id,unit_number,floor,house_type,bedrooms,monthly_rent,status,properties(name,property_type)').order('property_id').order('floor', { ascending: true });
      if (status !== 'all') query = query.eq('status', status);
      const { data } = await query;
      const normalized = (data || []).map((row) => ({
        ...row,
        properties: Array.isArray(row.properties) ? (row.properties[0] ?? null) : (row.properties ?? null),
      }));
      setUnits(normalized as unknown as typeof units);
      setLoading(false);
    })();
  }, [status]);

  const title = status === 'all' ? 'All Units' : `${titleCase(status)} Units`;
  return (
    <DashboardLayout navItems={adminNav} title="Units">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Portfolio inventory</p><h2 className="mt-1 text-2xl font-bold text-ink-900">{title}</h2><p className="mt-1 text-sm text-ink-500">Click any unit to inspect its property and floor placement.</p></div>
        <div className="flex gap-2 flex-wrap">
          {['all','available','occupied','reserved','maintenance'].map((value) => <button key={value} type="button" onClick={() => navigate(value === 'all' ? '/admin/units' : `/admin/units?status=${value}`)} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${status === value ? 'bg-brand-700 text-white' : 'bg-white border border-ink-200 text-ink-600'}`}>{titleCase(value)}</button>)}
        </div>
      </div>
      {loading ? <LoadingPage /> : units.length === 0 ? <EmptyState icon={<Home className="w-8 h-8" />} title="No matching units" description="Units will appear here as properties are configured." /> : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-ink-50 text-left text-ink-500"><tr><th className="px-4 py-3">Property</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3">Floor</th><th className="px-4 py-3">Bedrooms</th><th className="px-4 py-3">Rent</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-ink-100">{units.map((u) => <tr key={u.id} className="cursor-pointer hover:bg-brand-50/60" onClick={() => navigate(`/property/${u.property_id}`)}><td className="px-4 py-4 font-semibold text-ink-900">{u.properties?.name || '—'}</td><td className="px-4 py-4">{u.properties?.property_type || '—'}</td><td className="px-4 py-4 font-medium">{u.unit_number}</td><td className="px-4 py-4">{u.floor ? `Floor ${u.floor}` : '—'}</td><td className="px-4 py-4">{u.bedrooms || 'Studio'}</td><td className="px-4 py-4 font-semibold">{formatKES(u.monthly_rent)}</td><td className="px-4 py-4"><Badge status={u.status} /></td></tr>)}</tbody></table></div>
        </Card>
      )}
    </DashboardLayout>
  );
}

export function AdminTax() {
  const { path } = useRouter();
  const period = new URLSearchParams(path.split('?')[1] || '').get('period') || new Date().toISOString().slice(0, 7);
  const [records, setRecords] = useState<Array<TaxRecord & { properties: { name: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { (async () => { const { data } = await supabase.from('tax_records').select('*, properties(name)').eq('period', period).order('created_at', { ascending: false }); setRecords((data as typeof records) || []); setLoading(false); })(); }, [period]);
  const total = records.reduce((sum, r) => sum + Number(r.estimated_tax || 0), 0);
  return (
    <DashboardLayout navItems={adminNav} title="Tax">
      <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Compliance overview</p><h2 className="mt-1 text-2xl font-bold text-ink-900">Tax records · {period}</h2><p className="mt-1 text-sm text-ink-500">Estimated tax by property for the selected reporting period.</p></div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6"><StatCard label="Tax Records" value={records.length} icon={<Receipt className="w-5 h-5" />} /><StatCard label="Estimated Tax" value={formatKES(total)} icon={<Receipt className="w-5 h-5" />} accent="red" /><StatCard label="Prepared / Filed" value={records.filter(r => ['prepared','filed','paid'].includes(r.status)).length} icon={<CheckCircle className="w-5 h-5" />} accent="blue" /></div>
      {loading ? <LoadingPage /> : records.length === 0 ? <EmptyState icon={<Receipt className="w-8 h-8" />} title="No tax records for this period" description="Calculate tax from the owner tax workspace to create a record." /> : <Card className="overflow-hidden"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-ink-50 text-left text-ink-500"><tr><th className="px-4 py-3">Property</th><th className="px-4 py-3">Gross income</th><th className="px-4 py-3">Expenses</th><th className="px-4 py-3">Taxable</th><th className="px-4 py-3">Tax</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-ink-100">{records.map(r => <tr key={r.id} className="hover:bg-ink-50"><td className="px-4 py-4 font-semibold text-ink-900">{r.properties?.name || 'Portfolio'}</td><td className="px-4 py-4">{formatKES(r.gross_income)}</td><td className="px-4 py-4">{formatKES(r.allowable_expenses)}</td><td className="px-4 py-4">{formatKES(r.taxable_income)}</td><td className="px-4 py-4 font-bold text-brand-700">{formatKES(r.estimated_tax)}</td><td className="px-4 py-4"><Badge status={r.status} /></td></tr>)}</tbody></table></div></Card>}
    </DashboardLayout>
  );
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
