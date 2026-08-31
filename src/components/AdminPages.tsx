import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import type { Reservation, Payment, Viewing, Profile, Property, SystemSettings, TaxTransaction, AuditLog, MaintenanceRequest, Lease } from '@/lib/types';
import { Card, Button, Badge, LoadingScreen, EmptyState, Modal, Input, Select, Textarea } from '@/components/ui';
import { formatKES, formatDate, formatDateTime, reservationStatusColor, reservationStatusLabel, paymentStatusColor, paymentStatusLabel, propertyTypeLabel, availabilityColor, availabilityLabel } from '@/lib/utils';
import { Search, Calendar, CreditCard, Eye, Users, Bell, Landmark, Shield, Settings, Wrench, KeyRound, FileText, Download, CheckCircle2, XCircle, AlertCircle, Upload } from 'lucide-react';

// ============ RESERVATIONS ============
export function AdminReservations() {
  const [reservations, setReservations] = useState<(Reservation & { property?: Property })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('reservations').select('*, property:properties(*)').order('created_at', { ascending: false });
    setReservations((data ?? []) as any[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  const filtered = reservations.filter((r) => {
    if (filter && r.status !== filter) return false;
    if (search && !r.customer_name.toLowerCase().includes(search.toLowerCase()) && !(r.reference ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('reservations').update({ status }).eq('id', id);
    setReservations(reservations.map((r) => r.id === id ? { ...r, status: status as any } : r));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reservations..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="pending_payment">Pending Payment</option>
          <option value="confirmed">Confirmed</option>
          <option value="reserved">Reserved</option>
          <option value="cancelled">Cancelled</option>
          <option value="expired">Expired</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Calendar className="h-12 w-12" />} title="No reservations found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Reference</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="hidden px-4 py-3 font-semibold md:table-cell">Property</th>
                  <th className="px-4 py-3 font-semibold">Fee</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Date</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{r.reference ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{r.customer_name}</p>
                      <p className="text-xs text-slate-500">{r.customer_phone}</p>
                    </td>
                    <td className="hidden px-4 py-3 text-slate-600 md:table-cell">{r.property?.title ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatKES(r.reservation_fee)}</td>
                    <td className="px-4 py-3"><Badge className={reservationStatusColor(r.status)}>{reservationStatusLabel(r.status)}</Badge></td>
                    <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={r.status}
                        onChange={(e) => updateStatus(r.id, e.target.value)}
                        className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs"
                      >
                        <option value="pending_payment">Pending Payment</option>
                        <option value="confirmed">Confirmed</option>
                        <option value="reserved">Reserved</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="expired">Expired</option>
                        <option value="refunded">Refunded</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ PAYMENTS ============
export function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('payments').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setPayments((data ?? []) as Payment[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  const filtered = payments.filter((p) => {
    if (filter && p.status !== filter) return false;
    if (search && !(p.transaction_id ?? '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalRevenue = payments.filter((p) => p.status === 'successful').reduce((s, p) => s + p.amount, 0);
  const pendingAmount = payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Total Revenue</p><p className="mt-1 text-xl font-bold text-green-700">{formatKES(totalRevenue)}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Pending</p><p className="mt-1 text-xl font-bold text-amber-700">{formatKES(pendingAmount)}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Total Transactions</p><p className="mt-1 text-xl font-bold text-slate-900">{payments.length}</p></Card>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search transactions..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="successful">Successful</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-12 w-12" />} title="No payments found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Transaction ID</th>
                  <th className="px-4 py-3 font-semibold">Amount</th>
                  <th className="px-4 py-3 font-semibold">Method</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Phone</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Date</th>
                  <th className="px-4 py-3 font-semibold">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{p.transaction_id ?? '—'}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{formatKES(p.amount)}</td>
                    <td className="px-4 py-3 capitalize text-slate-600">{p.payment_method}</td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{p.phone ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className={paymentStatusColor(p.status)}>{paymentStatusLabel(p.status)}</Badge></td>
                    <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{formatDateTime(p.created_at)}</td>
                    <td className="px-4 py-3">
                      {p.status === 'successful' && (
                        <button onClick={() => window.print()} className="text-teal-700 hover:text-teal-800"><Download className="h-4 w-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ VIEWINGS ============
export function AdminViewings() {
  const [viewings, setViewings] = useState<(Viewing & { property?: Property })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.from('viewings').select('*, property:properties(*)').order('created_at', { ascending: false });
    setViewings((data ?? []) as any[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <LoadingScreen />;

  const filtered = viewings.filter((v) => !filter || v.status === filter);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('viewings').update({ status }).eq('id', id);
    setViewings(viewings.map((v) => v.id === id ? { ...v, status: status as any } : v));
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="requested">Requested</option>
          <option value="confirmed">Confirmed</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
          <option value="no_show">No Show</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Eye className="h-12 w-12" />} title="No viewings found" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filtered.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{v.property?.title ?? 'Property'}</h3>
                  <p className="text-sm text-slate-500">{v.customer_name} · {v.customer_phone}</p>
                </div>
                <Badge className={v.status === 'confirmed' ? 'bg-green-100 text-green-800 border-green-200' : v.status === 'cancelled' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>
                  {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                </Badge>
              </div>
              <div className="mt-3 flex items-center gap-4 text-sm text-slate-600">
                <span>Date: {formatDate(v.preferred_date)}</span>
                <span>Time: {v.preferred_time}</span>
              </div>
              <div className="mt-3">
                <select value={v.status} onChange={(e) => updateStatus(v.id, e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                  <option value="requested">Requested</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="rescheduled">Rescheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ CUSTOMERS ============
export function AdminCustomers() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setProfiles((data ?? []) as Profile[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  const filtered = profiles.filter((p) => !search || p.email.toLowerCase().includes(search.toLowerCase()) || (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search users..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-12 w-12" />} title="No users found" />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Name</th>
                  <th className="px-4 py-3 font-semibold">Email</th>
                  <th className="hidden px-4 py-3 font-semibold sm:table-cell">Phone</th>
                  <th className="px-4 py-3 font-semibold">Role</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Status</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-900">{p.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{p.email}</td>
                    <td className="hidden px-4 py-3 text-slate-600 sm:table-cell">{p.phone ?? '—'}</td>
                    <td className="px-4 py-3"><Badge className="bg-slate-100 text-slate-700 border-slate-200 capitalize">{p.role.replace('_', ' ')}</Badge></td>
                    <td className="hidden px-4 py-3 lg:table-cell"><Badge className={p.account_status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}>{p.account_status}</Badge></td>
                    <td className="hidden px-4 py-3 text-slate-500 lg:table-cell">{formatDate(p.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ TAX / KRA ============
export function AdminTax() {
  const [taxes, setTaxes] = useState<TaxTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('tax_transactions').select('*').order('created_at', { ascending: false }),
      supabase.from('system_settings').select('*').eq('id', 1).maybeSingle(),
    ]).then(([taxRes, setRes]) => {
      setTaxes((taxRes.data ?? []) as TaxTransaction[]);
      setSettings(setRes.data as SystemSettings);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  const totalTax = taxes.reduce((s, t) => s + t.tax_amount, 0);
  const submitted = taxes.filter((t) => t.submission_status === 'submitted' || t.submission_status === 'accepted').length;
  const failed = taxes.filter((t) => t.submission_status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-slate-500">Total Tax Collected</p><p className="mt-1 text-xl font-bold text-purple-700">{formatKES(totalTax)}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Submitted</p><p className="mt-1 text-xl font-bold text-green-700">{submitted}</p></Card>
        <Card className="p-4"><p className="text-xs text-slate-500">Failed</p><p className="mt-1 text-xl font-bold text-red-700">{failed}</p></Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Landmark className="h-5 w-5 text-slate-700" />
          <h3 className="font-semibold text-slate-900">KRA Integration</h3>
        </div>
        <p className="mt-2 text-sm text-slate-500">KRA eTIMS integration credentials are stored securely in server-side environment variables and are never exposed in client-side code.</p>
        <div className="mt-3 flex items-center gap-2">
          <Badge className="bg-slate-100 text-slate-600 border-slate-200">Tax Rate: {settings?.tax_rate ?? 0}%</Badge>
          <Badge className={settings?.tax_enabled ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-500 border-slate-200'}>{settings?.tax_enabled ? 'Tax Enabled' : 'Tax Disabled'}</Badge>
        </div>
      </Card>

      {taxes.length === 0 ? (
        <EmptyState icon={<Landmark className="h-12 w-12" />} title="No tax transactions" message="Tax records will appear here when payments are processed." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">Invoice #</th>
                  <th className="px-4 py-3 font-semibold">Customer</th>
                  <th className="px-4 py-3 font-semibold">Taxable Amount</th>
                  <th className="px-4 py-3 font-semibold">Tax Amount</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="hidden px-4 py-3 font-semibold lg:table-cell">KRA Ref</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {taxes.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{t.invoice_number ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{t.customer_name ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-900">{formatKES(t.taxable_amount)}</td>
                    <td className="px-4 py-3 font-semibold text-purple-700">{formatKES(t.tax_amount)}</td>
                    <td className="px-4 py-3"><Badge className={t.submission_status === 'accepted' ? 'bg-green-100 text-green-800 border-green-200' : t.submission_status === 'failed' ? 'bg-red-100 text-red-800 border-red-200' : 'bg-amber-100 text-amber-800 border-amber-200'}>{t.submission_status.replace('_', ' ')}</Badge></td>
                    <td className="hidden px-4 py-3 font-mono text-xs text-slate-600 lg:table-cell">{t.kra_reference ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============ MAINTENANCE ============
export function AdminMaintenance() {
  const [requests, setRequests] = useState<(MaintenanceRequest & { property?: Property })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('maintenance_requests').select('*, property:properties(*)').order('created_at', { ascending: false }).then(({ data }) => {
      setRequests((data ?? []) as any[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  const updateStatus = async (id: string, status: string, assignedTo?: string) => {
    const updates: any = { status };
    if (assignedTo !== undefined) updates.assigned_to = assignedTo;
    await supabase.from('maintenance_requests').update(updates).eq('id', id);
    setRequests(requests.map((r) => r.id === id ? { ...r, ...updates } : r));
  };

  return (
    <div className="space-y-4">
      {requests.length === 0 ? (
        <EmptyState icon={<Wrench className="h-12 w-12" />} title="No maintenance requests" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {requests.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900">{r.property?.title ?? 'Property'}</h3>
                  <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                </div>
                <Badge className={r.priority === 'high' ? 'bg-red-100 text-red-800 border-red-200' : r.priority === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>{r.priority}</Badge>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <select value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs">
                  <option value="submitted">Submitted</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
                <input value={r.assigned_to ?? ''} onChange={(e) => updateStatus(r.id, r.status, e.target.value)} placeholder="Assign to..." className="flex-1 rounded-lg border border-slate-300 px-2 py-1 text-xs" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============ TENANCY ============
export function AdminTenancy() {
  const [leases, setLeases] = useState<(Lease & { property?: Property })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('leases').select('*, property:properties(*)').order('created_at', { ascending: false }).then(({ data }) => {
      setLeases((data ?? []) as any[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div className="space-y-4">
      {leases.length === 0 ? (
        <EmptyState icon={<KeyRound className="h-12 w-12" />} title="No leases" message="Lease agreements will appear here once tenants are assigned to properties." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Property</th>
                <th className="px-4 py-3 font-semibold">Tenant</th>
                <th className="px-4 py-3 font-semibold">Rent</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Start</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">End</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leases.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{l.property?.title ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{l.tenant_name ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{l.rent_amount ? formatKES(l.rent_amount) : '—'}</td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{formatDate(l.start_date)}</td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{formatDate(l.end_date)}</td>
                  <td className="px-4 py-3"><Badge className={l.status === 'active' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-slate-100 text-slate-600 border-slate-200'}>{l.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ============ AUDIT LOGS ============
export function AdminAudit() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setLogs((data ?? []) as AuditLog[]);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div>
      {logs.length === 0 ? (
        <EmptyState icon={<FileText className="h-12 w-12" />} title="No audit logs" message="System actions will be recorded here." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Action</th>
                <th className="hidden px-4 py-3 font-semibold sm:table-cell">Record</th>
                <th className="px-4 py-3 font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{l.user_name ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{l.action}</td>
                  <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">{l.record_type ?? '—'} {l.record_id ? `(${l.record_id.slice(0, 8)})` : ''}</td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(l.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

// ============ REPORTS ============
export function AdminReports() {
  const [stats, setStats] = useState({ totalProperties: 0, available: 0, reserved: 0, occupied: 0, totalRevenue: 0, totalReservations: 0, totalCustomers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('properties').select('*'),
      supabase.from('payments').select('*'),
      supabase.from('reservations').select('*'),
      supabase.from('profiles').select('*'),
    ]).then(([p, pay, r, u]) => {
      const props = (p.data ?? []) as any[];
      const payments = (pay.data ?? []) as any[];
      const reservations = (r.data ?? []) as any[];
      const users = (u.data ?? []) as any[];
      setStats({
        totalProperties: props.length,
        available: props.filter((x) => x.availability_status === 'available').length,
        reserved: props.filter((x) => x.availability_status === 'reserved').length,
        occupied: props.filter((x) => x.availability_status === 'occupied').length,
        totalRevenue: payments.filter((x) => x.status === 'successful').reduce((s, x) => s + x.amount, 0),
        totalReservations: reservations.length,
        totalCustomers: users.filter((x) => x.role === 'customer').length,
      });
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  const reports = [
    { title: 'Property Report', desc: 'Available, reserved, and occupied properties', icon: 'building', data: `${stats.totalProperties} total · ${stats.available} available · ${stats.reserved} reserved · ${stats.occupied} occupied` },
    { title: 'Financial Report', desc: 'Revenue, reservation fees, and outstanding balances', icon: 'dollar', data: `Total Revenue: ${formatKES(stats.totalRevenue)}` },
    { title: 'Tax Report', desc: 'Taxable transactions and KRA submissions', icon: 'landmark', data: 'View tax transactions and submission status' },
    { title: 'Customer Report', desc: 'New and active customers, conversion rates', icon: 'users', data: `${stats.totalCustomers} customers · ${stats.totalReservations} reservations` },
    { title: 'Agent Report', desc: 'Agent performance, reservations, and commission', icon: 'agent', data: 'Agent performance metrics' },
    { title: 'Reservation Report', desc: 'All reservations by status and date', icon: 'calendar', data: `${stats.totalReservations} total reservations` },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {reports.map((r) => (
        <Card key={r.title} className="p-6">
          <h3 className="font-semibold text-slate-900">{r.title}</h3>
          <p className="mt-1 text-sm text-slate-500">{r.desc}</p>
          <p className="mt-3 text-sm font-medium text-slate-700">{r.data}</p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}><Download className="h-3.5 w-3.5" /> PDF</Button>
            <Button size="sm" variant="outline" onClick={() => {
              const csv = `${r.title}\n${r.data}\n`;
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = `${r.title.replace(/\s/g, '_')}.csv`; a.click();
            }}>CSV</Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============ SETTINGS ============
export function AdminSettings() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    supabase.from('system_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => {
      setSettings(data as SystemSettings);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    await supabase.from('system_settings').update({
      company_name: settings.company_name,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      website: settings.website,
      currency: settings.currency,
      reservation_fee: settings.reservation_fee,
      reservation_expiration_minutes: settings.reservation_expiration_minutes,
      cancellation_policy: settings.cancellation_policy,
      refund_policy: settings.refund_policy,
      mpesa_enabled: settings.mpesa_enabled,
      card_enabled: settings.card_enabled,
      bank_transfer_enabled: settings.bank_transfer_enabled,
      tax_rate: settings.tax_rate,
      tax_enabled: settings.tax_enabled,
      updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading || !settings) return <LoadingScreen />;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* General */}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Settings className="h-5 w-5" /> General Settings</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Company Name" value={settings.company_name} onChange={(e) => setSettings({ ...settings, company_name: e.target.value })} />
          <Input label="Phone" value={settings.phone} onChange={(e) => setSettings({ ...settings, phone: e.target.value })} />
          <Input label="Email" value={settings.email} onChange={(e) => setSettings({ ...settings, email: e.target.value })} />
          <Input label="Website" value={settings.website} onChange={(e) => setSettings({ ...settings, website: e.target.value })} />
          <Input label="Address" value={settings.address} onChange={(e) => setSettings({ ...settings, address: e.target.value })} />
          <Select label="Currency" value={settings.currency} onChange={(e) => setSettings({ ...settings, currency: e.target.value })}>
            <option value="KES">KES (KSh)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </Select>
        </div>
      </Card>

      {/* Reservation */}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Calendar className="h-5 w-5" /> Reservation Settings</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Reservation Fee (KSh)" type="number" value={String(settings.reservation_fee)} onChange={(e) => setSettings({ ...settings, reservation_fee: parseFloat(e.target.value) || 0 })} />
          <Input label="Expiration (minutes)" type="number" value={String(settings.reservation_expiration_minutes)} onChange={(e) => setSettings({ ...settings, reservation_expiration_minutes: parseInt(e.target.value) || 15 })} />
          <Textarea label="Cancellation Policy" value={settings.cancellation_policy} onChange={(e) => setSettings({ ...settings, cancellation_policy: e.target.value })} rows={2} />
          <Textarea label="Refund Policy" value={settings.refund_policy} onChange={(e) => setSettings({ ...settings, refund_policy: e.target.value })} rows={2} />
        </div>
      </Card>

      {/* Payments */}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><CreditCard className="h-5 w-5" /> Payment Methods</h3>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.mpesa_enabled} onChange={(e) => setSettings({ ...settings, mpesa_enabled: e.target.checked })} className="rounded border-slate-300" /> M-Pesa</label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.card_enabled} onChange={(e) => setSettings({ ...settings, card_enabled: e.target.checked })} className="rounded border-slate-300" /> Card Payments</label>
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.bank_transfer_enabled} onChange={(e) => setSettings({ ...settings, bank_transfer_enabled: e.target.checked })} className="rounded border-slate-300" /> Bank Transfer</label>
          <p className="text-xs text-slate-400">Payment gateway credentials (M-Pesa API keys, card processor keys) are stored securely in server-side environment variables.</p>
        </div>
      </Card>

      {/* Tax */}
      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Landmark className="h-5 w-5" /> Tax / KRA Settings</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input type="checkbox" checked={settings.tax_enabled} onChange={(e) => setSettings({ ...settings, tax_enabled: e.target.checked })} className="rounded border-slate-300" /> Enable Tax Calculation</label>
          <Input label="Tax Rate (%)" type="number" value={String(settings.tax_rate)} onChange={(e) => setSettings({ ...settings, tax_rate: parseFloat(e.target.value) || 0 })} />
        </div>
        <p className="mt-3 text-xs text-slate-400">KRA eTIMS integration credentials are stored securely in server-side environment variables and never exposed in frontend code.</p>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button>
        {saved && <span className="text-sm text-green-600">Settings saved successfully!</span>}
      </div>
    </div>
  );
}

// ============ BULK IMPORT ============
export function AdminBulkImport({ onDone }: { onDone: () => void }) {
  const [csvText, setCsvText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ success: number; failed: number } | null>(null);

  const template = `title,property_type,county,town,estate,bedrooms,bathrooms,parking_spaces,floor_size,furnished,monthly_rent,selling_price,security_deposit,availability_status
Modern Apartment,apartment,Nairobi,Kilimani,Kilimani,2,2,1,1100,true,85000,,170000,available
Family House,bungalow,Nairobi,Karen,Karen,4,3,2,2800,false,,180000,360000,available`;

  const handleImport = async () => {
    setImporting(true);
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map((h) => h.trim());
    let success = 0, failed = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, j) => { row[h] = values[j] ?? ''; });

      try {
        const { error } = await supabase.from('properties').insert({
          title: row.title,
          property_type: row.property_type || 'apartment',
          county: row.county || null,
          town: row.town || null,
          estate: row.estate || null,
          bedrooms: parseInt(row.bedrooms) || 0,
          bathrooms: parseInt(row.bathrooms) || 0,
          parking_spaces: parseInt(row.parking_spaces) || 0,
          floor_size: row.floor_size ? parseFloat(row.floor_size) : null,
          furnished: row.furnished === 'true',
          monthly_rent: row.monthly_rent ? parseFloat(row.monthly_rent) : null,
          selling_price: row.selling_price ? parseFloat(row.selling_price) : null,
          security_deposit: row.security_deposit ? parseFloat(row.security_deposit) : null,
          availability_status: row.availability_status || 'available',
          is_published: true,
        });
        if (error) failed++; else success++;
      } catch { failed++; }
    }

    setResult({ success, failed });
    setImporting(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Card className="p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900"><Upload className="h-5 w-5" /> Bulk Property Import</h3>
        <p className="mt-1 text-sm text-slate-500">Upload multiple properties at once using CSV format.</p>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-slate-700">CSV Template</label>
            <Button size="sm" variant="outline" onClick={() => {
              const blob = new Blob([template], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a'); a.href = url; a.download = 'property_template.csv'; a.click();
            }}><Download className="h-3.5 w-3.5" /> Download Template</Button>
          </div>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 p-3 text-xs text-slate-300">{template}</pre>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-slate-700">Paste CSV Data</label>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={8} placeholder="Paste your CSV data here..." className="mt-1 w-full rounded-lg border border-slate-300 p-3 font-mono text-xs focus:border-teal-500 focus:outline-none" />
        </div>

        <div className="mt-4">
          <Button onClick={handleImport} disabled={importing || !csvText.trim()}>{importing ? 'Importing...' : 'Import Properties'}</Button>
        </div>

        {result && (
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <h4 className="font-semibold text-slate-900">Import Summary</h4>
            <div className="mt-2 flex gap-6 text-sm">
              <span className="text-green-700">Successfully imported: {result.success}</span>
              <span className="text-red-700">Failed: {result.failed}</span>
            </div>
            <Button size="sm" variant="outline" className="mt-3" onClick={onDone}>View Properties</Button>
          </div>
        )}
      </Card>
    </div>
  );
}

// ============ NOTIFICATIONS (Admin) ============
export function AdminNotifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Admin sees recent reservations and payments as notifications
    Promise.all([
      supabase.from('reservations').select('*').order('created_at', { ascending: false }).limit(20),
      supabase.from('payments').select('*').order('created_at', { ascending: false }).limit(20),
    ]).then(([resRes, payRes]) => {
      const items = [
        ...(resRes.data ?? []).map((r: any) => ({ id: r.id, title: 'New Reservation', message: `${r.customer_name} reserved a property. Ref: ${r.reference}`, date: r.created_at, type: 'reservation' })),
        ...(payRes.data ?? []).map((p: any) => ({ id: p.id, title: `Payment ${p.status}`, message: `${p.payment_method} payment of KSh ${p.amount}`, date: p.created_at, type: 'payment' })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setNotifications(items);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingScreen />;

  return (
    <div>
      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-12 w-12" />} title="No notifications" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={`${n.type}-${n.id}`} className="flex items-start gap-3 p-4">
              <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${n.type === 'reservation' ? 'bg-teal-50 text-teal-700' : n.type === 'payment' ? 'bg-green-50 text-green-700' : 'bg-slate-50 text-slate-600'}`}>
                {n.type === 'reservation' ? <Calendar className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                <p className="text-sm text-slate-500">{n.message}</p>
                <p className="mt-1 text-xs text-slate-400">{formatDateTime(n.date)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
