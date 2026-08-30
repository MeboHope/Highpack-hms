import { useState, useEffect } from 'react';
import { Building2, Users, Calendar, Wallet, Settings, Home, CheckCircle, XCircle, ShieldCheck, TrendingUp, Receipt, Download } from 'lucide-react';
import { DashboardLayout, adminNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { ConfirmDialog } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatKES, formatDate, titleCase } from '@/lib/constants';
import type { Property, Profile, Reservation, Payment, SystemSettings } from '@/lib/supabase';

export function AdminDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ properties: 0, units: 0, available: 0, reserved: 0, occupied: 0, customers: 0, tenants: 0, reservationsToday: 0, monthlyRevenue: 0, outstanding: 0, expenses: 0, taxTracked: 0 });

  useEffect(() => {
    (async () => {
      const { count: properties } = await supabase.from('properties').select('*', { count: 'exact', head: true });
      const { count: units } = await supabase.from('property_units').select('*', { count: 'exact', head: true });
      const { count: available } = await supabase.from('property_units').select('*', { count: 'exact', head: true }).eq('status', 'available');
      const { count: reserved } = await supabase.from('property_units').select('*', { count: 'exact', head: true }).eq('status', 'reserved');
      const { count: occupied } = await supabase.from('property_units').select('*', { count: 'exact', head: true }).eq('status', 'occupied');
      const { count: customers } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'customer');
      const { count: tenants } = await supabase.from('leases').select('*', { count: 'exact', head: true }).eq('status', 'active');
      const { data: payments } = await supabase.from('payments').select('amount, verified').eq('status', 'successful');
      const revenue = ((payments as Payment[]) || []).filter((p) => p.verified).reduce((s, p) => s + p.amount, 0);

      setStats({
        properties: properties || 0, units: units || 0, available: available || 0, reserved: reserved || 0,
        occupied: occupied || 0, customers: customers || 0, tenants: tenants || 0, reservationsToday: 0,
        monthlyRevenue: revenue, outstanding: 0, expenses: 0, taxTracked: 0,
      });
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <DashboardLayout navItems={adminNav} title="Dashboard"><LoadingPage /></DashboardLayout>;

  return (
    <DashboardLayout navItems={adminNav} title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Properties" value={stats.properties} icon={<Building2 className="w-5 h-5" />} />
        <StatCard label="Total Units" value={stats.units} icon={<Home className="w-5 h-5" />} accent="accent" />
        <StatCard label="Available" value={stats.available} icon={<Home className="w-5 h-5" />} accent="ink" />
        <StatCard label="Reserved" value={stats.reserved} icon={<Calendar className="w-5 h-5" />} accent="accent" />
        <StatCard label="Occupied" value={stats.occupied} icon={<Users className="w-5 h-5" />} accent="blue" />
        <StatCard label="Customers" value={stats.customers} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Active Tenants" value={stats.tenants} icon={<Users className="w-5 h-5" />} accent="brand" />
        <StatCard label="Monthly Revenue" value={formatKES(stats.monthlyRevenue)} icon={<Wallet className="w-5 h-5" />} accent="blue" />
        <StatCard label="Outstanding Rent" value={formatKES(stats.outstanding)} icon={<Receipt className="w-5 h-5" />} accent="red" />
        <StatCard label="Expenses" value={formatKES(stats.expenses)} icon={<Receipt className="w-5 h-5" />} accent="ink" />
        <StatCard label="Tax Tracked" value={formatKES(stats.taxTracked)} icon={<TrendingUp className="w-5 h-5" />} accent="accent" />
        <StatCard label="Reservations Today" value={stats.reservationsToday} icon={<Calendar className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-ink-900 mb-4">Platform Overview</h3>
          <div className="space-y-3">
            {[
              { label: 'Property Occupancy', value: stats.units > 0 ? Math.round((stats.occupied / stats.units) * 100) : 0, color: 'bg-brand-500' },
              { label: 'Reservation Rate', value: stats.units > 0 ? Math.round((stats.reserved / stats.units) * 100) : 0, color: 'bg-accent-500' },
              { label: 'Vacancy Rate', value: stats.units > 0 ? Math.round((stats.available / stats.units) * 100) : 0, color: 'bg-ink-400' },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex justify-between text-sm mb-1"><span className="text-ink-600">{item.label}</span><span className="font-semibold">{item.value}%</span></div>
                <div className="w-full bg-ink-100 rounded-full h-2"><div className={`${item.color} h-2 rounded-full`} style={{ width: `${item.value}%` }} /></div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold text-ink-900 mb-4">Revenue Trend</h3>
          <div className="flex items-end gap-2 h-48">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((m, i) => {
              const h = 20 + ((i * 23) % 70);
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-brand-200 rounded-t-lg" style={{ height: `${h}%` }}>
                    <div className="w-full bg-brand-500 rounded-t-lg" style={{ height: `${h * 0.8}%` }} />
                  </div>
                  <span className="text-xs text-ink-400">{m}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function AdminProperties() {
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
                  <tr key={p.id} className="hover:bg-ink-50">
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
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
      setUsers((data as Profile[]) || []);
      setLoading(false);
    })();
  }, []);

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
                  <tr key={r.id} className="hover:bg-ink-50">
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

export function AdminSettings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('system_settings').select('*').eq('id', 1).maybeSingle();
      setSettings(data as SystemSettings | null);
      setLoading(false);
    })();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    await supabase.from('system_settings').update({
      reservation_fee: settings.reservation_fee,
      reservation_duration_hours: settings.reservation_duration_hours,
      reservation_fee_policy: settings.reservation_fee_policy,
      platform_commission_pct: settings.platform_commission_pct,
      default_tax_rate_pct: settings.default_tax_rate_pct,
      mpesa_enabled: settings.mpesa_enabled,
      card_enabled: settings.card_enabled,
      bank_transfer_enabled: settings.bank_transfer_enabled,
      require_property_verification: settings.require_property_verification,
    }).eq('id', 1);
    setSaving(false);
    toast('Settings saved successfully', 'success');
  };

  if (loading || !settings) return <DashboardLayout navItems={adminNav} title="Settings"><LoadingPage /></DashboardLayout>;

  return (
    <DashboardLayout navItems={adminNav} title="Settings">
      <h2 className="text-xl font-bold text-ink-900 mb-6">System Settings</h2>
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
