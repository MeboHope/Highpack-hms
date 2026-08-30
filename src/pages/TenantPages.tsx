import { useState, useEffect } from 'react';
import { Home, Wallet, FileText, Wrench, Bell, Settings, Calendar, CheckCircle, Plus, MapPin, BedDouble, Bath, ShieldCheck } from 'lucide-react';
import { DashboardLayout, tenantNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatKES, formatDate, titleCase, MAINTENANCE_CATEGORIES } from '@/lib/constants';
import { getPropertyImages } from '@/lib/images';
import type { Lease, RentInvoice, MaintenanceRequest, Payment, Reservation, Property, PropertyUnit } from '@/lib/supabase';

export function TenantDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [lease, setLease] = useState<(Lease & { properties: Property; property_units: PropertyUnit }) | null>(null);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [reservations, setReservations] = useState<(Reservation & { property_units: { unit_number: string }; properties: { name: string; town: string; county: string } })[]>([]);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: leaseData } = await supabase.from('leases').select('*, properties(*), property_units(*)').eq('tenant_id', profile.id).eq('status', 'active').maybeSingle();
      setLease(leaseData as typeof lease | null);

      if (leaseData) {
        const { data: invData } = await supabase.from('rent_invoices').select('*').eq('lease_id', leaseData.id).order('due_date', { ascending: false }).limit(5);
        setInvoices((invData as RentInvoice[]) || []);
      }

      const { data: resData } = await supabase.from('reservations').select('*, property_units(unit_number), properties(name, town, county)').eq('customer_id', profile.id).order('created_at', { ascending: false });
      setReservations((resData as typeof reservations) || []);

      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <DashboardLayout navItems={tenantNav} title="Dashboard"><LoadingPage /></DashboardLayout>;

  const outstandingBalance = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.balance, 0);

  return (
    <DashboardLayout navItems={tenantNav} title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Monthly Rent" value={lease ? formatKES(lease.monthly_rent) : '—'} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Outstanding" value={formatKES(outstandingBalance)} icon={<FileText className="w-5 h-5" />} accent="red" />
        <StatCard label="Reservations" value={reservations.length} icon={<Calendar className="w-5 h-5" />} accent="accent" />
        <StatCard label="Lease Status" value={lease ? titleCase(lease.status) : 'No lease'} icon={<FileText className="w-5 h-5" />} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-ink-900 mb-4">Current Residence</h3>
          {lease ? (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-ink-100">
                  <img src={lease.properties?.photos?.[0] || getPropertyImages(lease.properties?.property_type || 'Apartment')[0]} alt="" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="font-semibold text-ink-900">{lease.properties?.name}</p>
                  <p className="text-sm text-ink-500 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {lease.properties?.town}, {lease.properties?.county}</p>
                  <p className="text-sm text-ink-500">Unit {lease.property_units?.unit_number}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-ink-400">Lease Start</p><p className="font-medium">{formatDate(lease.lease_start)}</p></div>
                <div><p className="text-ink-400">Lease End</p><p className="font-medium">{formatDate(lease.lease_end)}</p></div>
                <div><p className="text-ink-400">Monthly Rent</p><p className="font-medium">{formatKES(lease.monthly_rent)}</p></div>
                <div><p className="text-ink-400">Deposit</p><p className="font-medium">{formatKES(lease.deposit)}</p></div>
              </div>
            </div>
          ) : (
            <EmptyState icon={<Home className="w-8 h-8" />} title="No active lease" description="Reserve a property to start your tenancy." />
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold text-ink-900 mb-4">Recent Invoices</h3>
          {invoices.length === 0 ? (
            <EmptyState icon={<FileText className="w-8 h-8" />} title="No invoices" description="Your rent invoices will appear here." />
          ) : (
            <div className="space-y-2">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between p-3 rounded-xl bg-ink-50">
                  <div>
                    <p className="font-medium text-ink-900 text-sm">{inv.period}</p>
                    <p className="text-xs text-ink-400">Due: {formatDate(inv.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-ink-900">{formatKES(inv.amount)}</p>
                    <Badge status={inv.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {reservations.length > 0 && (
        <Card className="p-6 mt-6">
          <h3 className="font-semibold text-ink-900 mb-4">My Reservations</h3>
          <div className="space-y-3">
            {reservations.map((r) => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-xl bg-ink-50">
                <div>
                  <p className="font-medium text-ink-900">{r.properties?.name}</p>
                  <p className="text-sm text-ink-500">Unit {r.property_units?.unit_number} · {r.properties?.town}, {r.properties?.county}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{formatKES(r.reservation_fee)}</p>
                  <Badge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </DashboardLayout>
  );
}

export function TenantRent() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<(RentInvoice & { properties: { name: string }; property_units: { unit_number: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [payInvoice, setPayInvoice] = useState<RentInvoice | null>(null);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('rent_invoices').select('*, properties(name), property_units(unit_number)').eq('tenant_id', profile.id).order('due_date', { ascending: false });
    setInvoices((data as typeof invoices) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const totalOutstanding = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.balance, 0);

  return (
    <DashboardLayout navItems={tenantNav} title="Rent & Invoices">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Outstanding" value={formatKES(totalOutstanding)} icon={<Wallet className="w-5 h-5" />} accent="red" />
        <StatCard label="Total Invoices" value={invoices.length} icon={<FileText className="w-5 h-5" />} />
        <StatCard label="Paid" value={invoices.filter((i) => i.status === 'paid').length} icon={<CheckCircle className="w-5 h-5" />} accent="brand" />
      </div>

      {loading ? <LoadingPage /> : invoices.length === 0 ? (
        <EmptyState icon={<Wallet className="w-8 h-8" />} title="No invoices yet" description="Your monthly rent invoices will appear here once your tenancy begins." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Unit</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Balance</th><th className="px-4 py-3 font-medium">Due Date</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{inv.period}</td>
                    <td className="px-4 py-3">{inv.properties?.name}</td>
                    <td className="px-4 py-3">{inv.property_units?.unit_number}</td>
                    <td className="px-4 py-3">{formatKES(inv.amount)}</td>
                    <td className="px-4 py-3 font-semibold">{formatKES(inv.balance)}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(inv.due_date)}</td>
                    <td className="px-4 py-3"><Badge status={inv.status} /></td>
                    <td className="px-4 py-3">
                      {inv.status !== 'paid' && (
                        <button onClick={() => setPayInvoice(inv)} className="btn-primary text-xs">Pay Rent</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {payInvoice && <PayRentModal invoice={payInvoice} onClose={() => { setPayInvoice(null); load(); }} />}
    </DashboardLayout>
  );
}

function PayRentModal({ invoice, onClose }: { invoice: RentInvoice; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState<'mpesa' | 'card' | 'bank_transfer'>('mpesa');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'pay' | 'processing' | 'success'>('pay');

  const handlePay = async () => {
    if (!profile) return;
    setStep('processing');
    setTimeout(async () => {
      await supabase.from('payments').insert({
        user_id: profile.id, lease_id: invoice.lease_id, property_id: invoice.property_id, unit_id: invoice.unit_id,
        amount: invoice.balance, payment_type: 'rent', payment_method: method, status: 'successful', verified: true,
        transaction_ref: `TXN${Date.now()}`,
      });
      await supabase.from('rent_invoices').update({ balance: 0, status: 'paid' }).eq('id', invoice.id);
      await supabase.from('notifications').insert({
        user_id: profile.id, title: 'Rent Payment Received', message: `Your rent payment of ${formatKES(invoice.balance)} for ${invoice.period} has been received.`, type: 'payment',
      });
      setStep('success');
    }, 2000);
  };

  return (
    <Modal open onClose={onClose} title="Pay Rent" size="md">
      {step === 'pay' && (
        <div className="space-y-4">
          <div className="bg-brand-50 rounded-xl p-4">
            <div className="flex justify-between mb-2"><span className="text-ink-500">Period</span><span className="font-semibold">{invoice.period}</span></div>
            <div className="flex justify-between mb-2"><span className="text-ink-500">Amount Due</span><span className="font-bold text-lg">{formatKES(invoice.balance)}</span></div>
          </div>
          <div>
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[{ v: 'mpesa', l: 'M-Pesa' }, { v: 'card', l: 'Card' }, { v: 'bank_transfer', l: 'Bank' }].map((m) => (
                <button key={m.v} onClick={() => setMethod(m.v as typeof method)} className={`p-3 rounded-xl border text-sm font-medium ${method === m.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}>{m.l}</button>
              ))}
            </div>
          </div>
          {method === 'mpesa' && <div><label className="label">M-Pesa Phone</label><input className="input" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>}
          <button onClick={handlePay} className="btn-primary w-full">Pay {formatKES(invoice.balance)}</button>
        </div>
      )}
      {step === 'processing' && (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full border-2 border-ink-200 border-t-brand-500 w-12 h-12 mb-4" />
          <p className="text-ink-500">Processing payment...</p>
        </div>
      )}
      {step === 'success' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8" /></div>
          <h4 className="font-bold text-ink-900 text-lg mb-1">Payment Successful!</h4>
          <p className="text-sm text-ink-500 mb-6">Your rent payment of {formatKES(invoice.balance)} has been received. A receipt has been generated.</p>
          <button onClick={onClose} className="btn-primary">Done</button>
        </div>
      )}
    </Modal>
  );
}

export function TenantMaintenance() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<(MaintenanceRequest & { property_units: { unit_number: string }; properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('maintenance_requests').select('*, property_units(unit_number), properties(name)').eq('tenant_id', profile.id).order('created_at', { ascending: false });
    setRequests((data as typeof requests) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  return (
    <DashboardLayout navItems={tenantNav} title="Maintenance">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-ink-900">Maintenance Requests</h2>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Request</button>
      </div>
      {loading ? <LoadingPage /> : requests.length === 0 ? (
        <EmptyState icon={<Wrench className="w-8 h-8" />} title="No maintenance requests" description="Submit a maintenance request if something needs fixing in your unit." action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> New Request</button>} />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold text-ink-900">{r.category}</h3>
                <Badge status={r.status} />
                <Badge>{r.priority}</Badge>
              </div>
              <p className="text-sm text-ink-600 mb-2">{r.description}</p>
              <p className="text-xs text-ink-400">{r.properties?.name} — Unit {r.property_units?.unit_number} · {formatDate(r.created_at)}</p>
            </Card>
          ))}
        </div>
      )}
      {showAdd && <AddMaintenanceModal tenantId={profile?.id || ''} onClose={() => { setShowAdd(false); load(); }} />}
    </DashboardLayout>
  );
}

function AddMaintenanceModal({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ category: 'Plumbing', priority: 'medium', description: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: lease } = await supabase.from('leases').select('property_id, unit_id').eq('tenant_id', tenantId).eq('status', 'active').maybeSingle();
      if (lease) { setForm((f) => ({ ...f, ...({ property_id: lease.property_id, unit_id: lease.unit_id } as Record<string, unknown>) as typeof f })) }
    })();
  }, [tenantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: lease } = await supabase.from('leases').select('property_id, unit_id').eq('tenant_id', tenantId).eq('status', 'active').maybeSingle();
    if (!lease) { toast('You need an active lease to submit maintenance requests.', 'error'); setLoading(false); return; }
    const { error } = await supabase.from('maintenance_requests').insert({
      tenant_id: tenantId, property_id: lease.property_id, unit_id: lease.unit_id,
      category: form.category.toLowerCase(), priority: form.priority, description: form.description, status: 'submitted',
    });
    setLoading(false);
    if (error) { toast('Could not submit request.', 'error'); return; }
    toast('Maintenance request submitted!', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="New Maintenance Request" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{MAINTENANCE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label">Priority</label><select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option></select></div>
        </div>
        <div><label className="label">Description</label><textarea className="input" rows={4} required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the issue in detail..." /></div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Submitting...' : 'Submit Request'}</button>
      </form>
    </Modal>
  );
}

export function TenantLease() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [lease, setLease] = useState<(Lease & { properties: Property; property_units: PropertyUnit }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('leases').select('*, properties(*), property_units(*)').eq('tenant_id', profile.id).order('created_at', { ascending: false }).maybeSingle();
      setLease(data as typeof lease | null);
      setLoading(false);
    })();
  }, [profile]);

  const handleSign = async () => {
    if (!lease || !profile) return;
    await supabase.from('leases').update({ signed_by_tenant: true, status: 'active' }).eq('id', lease.id);
    toast('Lease signed successfully!', 'success');
    setLease({ ...lease, signed_by_tenant: true, status: 'active' });
  };

  if (loading) return <DashboardLayout navItems={tenantNav} title="Lease"><LoadingPage /></DashboardLayout>;

  return (
    <DashboardLayout navItems={tenantNav} title="Lease">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Tenancy Agreement</h2>
      {lease ? (
        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-ink-900">Lease Details</h3>
              <Badge status={lease.status} />
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><p className="text-ink-400">Property</p><p className="font-medium">{lease.properties?.name}</p></div>
              <div><p className="text-ink-400">Unit</p><p className="font-medium">{lease.property_units?.unit_number}</p></div>
              <div><p className="text-ink-400">Lease Start</p><p className="font-medium">{formatDate(lease.lease_start)}</p></div>
              <div><p className="text-ink-400">Lease End</p><p className="font-medium">{formatDate(lease.lease_end)}</p></div>
              <div><p className="text-ink-400">Monthly Rent</p><p className="font-medium">{formatKES(lease.monthly_rent)}</p></div>
              <div><p className="text-ink-400">Security Deposit</p><p className="font-medium">{formatKES(lease.deposit)}</p></div>
              <div><p className="text-ink-400">Payment Due Day</p><p className="font-medium">{lease.payment_due_day}th of each month</p></div>
              <div><p className="text-ink-400">Grace Period</p><p className="font-medium">{lease.grace_period_days} days</p></div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold text-ink-900 mb-4">Tenancy Agreement</h3>
            <div className="prose prose-sm max-w-none text-ink-600 bg-ink-50 rounded-xl p-4 max-h-96 overflow-y-auto">
              <p className="mb-3"><strong>THIS TENANCY AGREEMENT</strong> is made on {formatDate(lease.lease_start)} between the Landlord (Property Owner) and the Tenant.</p>
              <p className="mb-3"><strong>1. PROPERTY:</strong> The Landlord agrees to let, and the Tenant agrees to rent, the property located at {lease.properties?.name}, Unit {lease.property_units?.unit_number}, {lease.properties?.town}, {lease.properties?.county}.</p>
              <p className="mb-3"><strong>2. RENT:</strong> The Tenant shall pay a monthly rent of {formatKES(lease.monthly_rent)} on or before the {lease.payment_due_day}th day of each calendar month.</p>
              <p className="mb-3"><strong>3. DEPOSIT:</strong> The Tenant has paid a security deposit of {formatKES(lease.deposit)}, refundable at the end of the tenancy subject to deductions for damages.</p>
              <p className="mb-3"><strong>4. TERM:</strong> This tenancy shall commence on {formatDate(lease.lease_start)} and terminate on {formatDate(lease.lease_end)}.</p>
              <p className="mb-3"><strong>5. GRACE PERIOD:</strong> A grace period of {lease.grace_period_days} days is allowed for rent payment before late penalties apply.</p>
              <p className="mb-3"><strong>6. MAINTENANCE:</strong> The Landlord is responsible for structural repairs. The Tenant is responsible for day-to-day maintenance.</p>
              <p><strong>7. TERMINATION:</strong> Either party may terminate this agreement with 30 days written notice.</p>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${lease.signed_by_tenant ? 'bg-brand-500 text-white' : 'bg-ink-200'}`}>
                {lease.signed_by_tenant && <CheckCircle className="w-3 h-3" />}
              </div>
              <span className="text-sm text-ink-600">{lease.signed_by_tenant ? 'Signed by you' : 'Not yet signed'}</span>
            </div>
            {!lease.signed_by_tenant && (
              <button onClick={handleSign} className="btn-primary mt-4 w-full">Sign Tenancy Agreement</button>
            )}
          </Card>
        </div>
      ) : (
        <EmptyState icon={<FileText className="w-8 h-8" />} title="No active lease" description="Your tenancy agreement will appear here once your reservation is converted to a lease." />
      )}
    </DashboardLayout>
  );
}

export function TenantHouse() {
  const { profile } = useAuth();
  const [lease, setLease] = useState<(Lease & { properties: Property; property_units: PropertyUnit }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('leases').select('*, properties(*), property_units(*)').eq('tenant_id', profile.id).eq('status', 'active').maybeSingle();
      setLease(data as typeof lease | null);
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <DashboardLayout navItems={tenantNav} title="My House"><LoadingPage /></DashboardLayout>;

  return (
    <DashboardLayout navItems={tenantNav} title="My House">
      {lease ? (
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="h-64 bg-ink-100 overflow-hidden">
              <img src={lease.properties?.photos?.[0] || getPropertyImages(lease.properties?.property_type || 'Apartment')[0]} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="p-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="badge bg-brand-100 text-brand-700"><ShieldCheck className="w-3 h-3" /> Verified</span>
                <Badge status={lease.properties?.status} />
              </div>
              <h2 className="text-2xl font-bold text-ink-900 mb-1">{lease.properties?.name}</h2>
              <p className="text-ink-500 flex items-center gap-1 mb-4"><MapPin className="w-4 h-4" /> {lease.properties?.town}, {lease.properties?.county}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><p className="text-ink-400">Unit</p><p className="font-semibold">{lease.property_units?.unit_number}</p></div>
                <div><p className="text-ink-400">Bedrooms</p><p className="font-semibold flex items-center gap-1"><BedDouble className="w-4 h-4" /> {lease.property_units?.bedrooms || 'Studio'}</p></div>
                <div><p className="text-ink-400">Bathrooms</p><p className="font-semibold flex items-center gap-1"><Bath className="w-4 h-4" /> {lease.property_units?.bathrooms}</p></div>
                <div><p className="text-ink-400">Furnishing</p><p className="font-semibold">{titleCase(lease.property_units?.furnishing || 'unfurnished')}</p></div>
              </div>
              <div className="mt-4 pt-4 border-t border-ink-100">
                <p className="text-2xl font-bold text-brand-700">{formatKES(lease.monthly_rent)}<span className="text-sm font-normal text-ink-400">/month</span></p>
              </div>
            </div>
          </Card>
          {lease.properties?.amenities && lease.properties.amenities.length > 0 && (
            <Card className="p-6">
              <h3 className="font-semibold text-ink-900 mb-3">Amenities</h3>
              <div className="flex flex-wrap gap-2">
                {lease.properties.amenities.map((a) => <span key={a} className="badge bg-ink-100 text-ink-600">{a}</span>)}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <EmptyState icon={<Home className="w-8 h-8" />} title="No active tenancy" description="Reserve a property and complete your tenancy to see your home details here." />
      )}
    </DashboardLayout>
  );
}

export function TenantMessages() {
  return (
    <DashboardLayout navItems={tenantNav} title="Messages">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Messages</h2>
      <EmptyState icon={<Bell className="w-8 h-8" />} title="No messages yet" description="Your conversations with property owners and managers will appear here." />
    </DashboardLayout>
  );
}

export function TenantSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', phone: '', national_id: '', bio: '' });

  useEffect(() => {
    if (profile) setForm({ full_name: profile.full_name || '', phone: profile.phone || '', national_id: profile.national_id || '', bio: profile.bio || '' });
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('profiles').update(form).eq('id', profile?.id);
    toast('Profile updated successfully', 'success');
  };

  return (
    <DashboardLayout navItems={tenantNav} title="Settings">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Account Settings</h2>
      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">National ID</label><input className="input" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>
          </div>
          <div><label className="label">Bio</label><textarea className="input" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      </Card>
    </DashboardLayout>
  );
}
