import { useState, useEffect } from 'react';
import { Home, Wallet, FileText, Wrench, Bell, Calendar, CheckCircle, Plus, MapPin, BedDouble, Bath, ShieldCheck, Search, ArrowRight, Clock, Eye, Receipt, CreditCard, Download } from 'lucide-react';
import { DashboardLayout, tenantNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from '@/context/RouterContext';
import { formatKES, formatDate, titleCase, MAINTENANCE_CATEGORIES } from '@/lib/constants';
import { getPropertyImages } from '@/lib/images';
import type { Lease, RentInvoice, MaintenanceRequest, Reservation, Property, PropertyUnit, Payment } from '@/lib/supabase';
import { downloadInvoicePdf, downloadPaymentReceiptPdf, getInvoiceNumber, getReceiptNumber } from '@/lib/documents';

export function TenantDashboard() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [lease, setLease] = useState<(Lease & { properties: Property; property_units: PropertyUnit }) | null>(null);
  const [invoices, setInvoices] = useState<RentInvoice[]>([]);
  const [reservations, setReservations] = useState<(Reservation & { property_units: { unit_number: string }; properties: { name: string; town: string; county: string } })[]>([]);
  const [payments, setPayments] = useState<(Payment & { properties: { name: string } | null; property_units: { unit_number: string } | null })[]>([]);
  const [reservationPolicy, setReservationPolicy] = useState('non_refundable');

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: leaseData }, { data: resData }, { data: paymentData }, { data: settings }] = await Promise.all([
        supabase.from('leases').select('*, properties(*), property_units(*)').eq('tenant_id', profile.id).eq('status', 'active').order('created_at', { ascending: false }).maybeSingle(),
        supabase.from('reservations').select('*, property_units(unit_number), properties(name, town, county)').eq('customer_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('payments').select('*, properties(name), property_units(unit_number)').eq('user_id', profile.id).order('created_at', { ascending: false }),
        supabase.from('system_settings').select('reservation_fee_policy').eq('id', 1).maybeSingle(),
      ]);
      setLease(leaseData as typeof lease | null);
      setReservations((resData as typeof reservations) || []);
      setPayments((paymentData as typeof payments) || []);
      setReservationPolicy(String(settings?.reservation_fee_policy || 'non_refundable'));

      if (leaseData) {
        const { data: invData } = await supabase.from('rent_invoices').select('*').eq('lease_id', leaseData.id).order('due_date', { ascending: false }).limit(5);
        setInvoices((invData as RentInvoice[]) || []);
      } else {
        setInvoices([]);
      }
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <DashboardLayout navItems={tenantNav} title="Dashboard"><LoadingPage /></DashboardLayout>;

  const outstandingBalance = invoices.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + Number(i.balance || 0), 0);
  const verifiedDepositPaid = payments.filter((p) => p.payment_type === 'deposit' && p.status === 'successful' && p.verified && p.lease_id === lease?.id).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const reservationCredit = reservationPolicy === 'deductible_deposit' || reservationPolicy === 'deductible_rent'
    ? payments.filter((p) => p.payment_type === 'reservation' && p.status === 'successful' && p.verified && p.reservation_id === lease?.reservation_id).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    : 0;
  const depositBalance = lease ? Math.max(0, Number(lease.deposit || 0) - verifiedDepositPaid - (reservationPolicy === 'deductible_deposit' ? reservationCredit : 0)) : 0;
  const moveInTotal = lease ? Math.max(0, Number(lease.monthly_rent || 0) + Number(lease.service_charge || 0) + depositBalance) : 0;
  const leaseTermMonths = lease ? Math.max(1, Math.round((new Date(lease.lease_end).getTime() - new Date(lease.lease_start).getTime()) / (1000 * 60 * 60 * 24 * 30.4375))) : 0;
  const leaseValue = lease ? Number(lease.monthly_rent || 0) * leaseTermMonths + Number(lease.service_charge || 0) * leaseTermMonths + Number(lease.deposit || 0) : 0;

  return (
    <DashboardLayout navItems={tenantNav} title="Dashboard">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 mb-6">
        <StatCard label="Monthly Rent" value={lease ? formatKES(lease.monthly_rent) : '—'} icon={<Wallet className="w-5 h-5" />} onClick={() => navigate(lease ? '/tenant/rent' : '/properties')} />
        <StatCard label="Move-in Amount" value={lease ? formatKES(moveInTotal) : '—'} icon={<CreditCard className="w-5 h-5" />} accent="accent" onClick={() => navigate('/tenant/rent')} />
        <StatCard label="Outstanding" value={formatKES(outstandingBalance + depositBalance)} icon={<FileText className="w-5 h-5" />} accent="red" onClick={() => navigate('/tenant/rent')} />
        <StatCard label="Reservations" value={reservations.length} icon={<Calendar className="w-5 h-5" />} accent="accent" onClick={() => navigate('/tenant/reservations')} />
        <StatCard label="Verified Paid" value={formatKES(payments.filter((p) => p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0))} icon={<CheckCircle className="w-5 h-5" />} accent="blue" onClick={() => navigate('/tenant/rent')} />
        <StatCard label="Lease Status" value={lease ? titleCase(lease.status) : 'No lease'} icon={<FileText className="w-5 h-5" />} accent="blue" onClick={() => navigate(lease ? '/tenant/lease' : '/properties')} />
      </div>

      {lease && <Card className="mb-6 overflow-hidden border-brand-100">
        <div className="brand-gradient p-5 text-white"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">Payment centre</p><h3 className="mt-1 text-xl font-bold">Your current tenancy balance</h3><p className="mt-1 text-sm text-white/75">Your first rent/service invoice and security-deposit balance are shown from the live lease and payment records.</p></div><button onClick={() => navigate('/tenant/rent')} className="btn-accent shrink-0"><Wallet className="h-4 w-4" /> Open payments</button></div></div>
        <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
          <div className="bg-white p-4"><p className="text-xs text-ink-400">Move-in amount</p><p className="mt-1 text-lg font-bold text-ink-900">{formatKES(moveInTotal)}</p></div>
          <div className="bg-white p-4"><p className="text-xs text-ink-400">Rent + service due</p><p className="mt-1 text-lg font-bold text-ink-900">{formatKES(outstandingBalance)}</p></div>
          <div className="bg-white p-4"><p className="text-xs text-ink-400">Deposit balance</p><p className="mt-1 text-lg font-bold text-ink-900">{formatKES(depositBalance)}</p></div>
          <div className="bg-white p-4"><p className="text-xs text-ink-400">12-month lease value*</p><p className="mt-1 text-lg font-bold text-brand-700">{formatKES(leaseValue)}</p></div>
        </div>
        <p className="px-4 py-3 text-[11px] text-ink-400">*Calculated from the signed lease term, monthly rent, service charge and security deposit; it is a contract value, not an amount already paid.</p>
      </Card>}

      <Card className="mb-6 overflow-hidden border-brand-100">
        <div className="brand-gradient p-6 text-white">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><p className="text-sm font-medium text-white/70">Your home journey</p><h2 className="mt-1 text-2xl font-bold">Find, reserve and manage your home in one place.</h2><p className="mt-2 max-w-2xl text-sm text-white/75">Browse verified properties, compare exact units, request a viewing, reserve a house and then manage rent, lease and maintenance here.</p></div>
            <button onClick={() => navigate('/properties')} className="btn-accent shrink-0"><Search className="h-4 w-4" /> Find a Home <ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-ink-100 sm:grid-cols-4">
          {[
            { label: 'Browse homes', text: 'Photos, videos & units', to: '/properties', icon: Search },
            { label: 'Reservations', text: 'Track applications', to: '/tenant/reservations', icon: Calendar },
            { label: 'Viewings', text: 'Manage appointments', to: '/tenant/viewings', icon: Eye },
            { label: 'Pay rent', text: 'Invoices & balances', to: '/tenant/rent', icon: Wallet },
          ].map((a) => { const Icon = a.icon; return <button key={a.to} onClick={() => navigate(a.to)} className="bg-white p-4 text-left transition hover:bg-brand-50"><Icon className="h-5 w-5 text-brand-600" /><p className="mt-2 text-sm font-semibold text-ink-900">{a.label}</p><p className="text-xs text-ink-500">{a.text}</p></button>; })}
        </div>
      </Card>

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

export function TenantReservations() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [reservations, setReservations] = useState<(Reservation & { property_units: { unit_number: string; monthly_rent: number }; properties: { name: string; town: string; county: string; photos: string[] } })[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!profile) return; (async () => { const { data } = await supabase.from('reservations').select('*, property_units(unit_number,monthly_rent), properties(name,town,county,photos)').eq('customer_id', profile.id).order('created_at', { ascending: false }); setReservations((data as typeof reservations) || []); setLoading(false); })(); }, [profile]);
  return <DashboardLayout navItems={tenantNav} title="Reservations">
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold text-ink-900">My Reservations</h2><p className="mt-1 text-sm text-ink-500">Track every house you have reserved and its current status.</p></div><button onClick={() => navigate('/properties')} className="btn-primary"><Search className="h-4 w-4" /> Find another home</button></div>
    {loading ? <LoadingPage /> : reservations.length === 0 ? <EmptyState icon={<Calendar className="w-8 h-8" />} title="No reservations yet" description="Choose an available unit from the property marketplace and reserve it here." action={<button onClick={() => navigate('/properties')} className="btn-primary">Browse available homes</button>} /> : <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{reservations.map(r => <Card key={r.id} className="overflow-hidden"><div className="flex gap-4 p-5"><img src={r.properties?.photos?.[0] || getPropertyImages('Apartment')[0]} alt="" className="h-24 w-28 rounded-xl object-cover" /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h3 className="font-semibold text-ink-900">{r.properties?.name}</h3><p className="text-sm text-ink-500">Unit {r.property_units?.unit_number} · {r.properties?.town}, {r.properties?.county}</p></div><Badge status={r.status} /></div><div className="mt-3 flex flex-wrap gap-4 text-sm"><span><span className="text-ink-400">Monthly rent</span> <strong>{formatKES(r.property_units?.monthly_rent || 0)}</strong></span><span><span className="text-ink-400">Fee</span> <strong>{formatKES(r.reservation_fee)}</strong></span></div><div className="mt-4 flex gap-2"><button onClick={() => navigate(`/property/${r.property_id}`)} className="btn-secondary text-xs"><Eye className="h-4 w-4" /> View property</button></div></div></div></Card>)}</div>}
  </DashboardLayout>;
}

export function TenantViewings() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [viewings, setViewings] = useState<Array<{ id: string; property_id: string; unit_id: string | null; appointment_date: string; appointment_time: string; status: string; notes: string | null; properties: { name: string; town: string; county: string } | null }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { if (!profile) return; (async () => { const { data } = await supabase.from('viewing_appointments').select('*, properties(name,town,county)').eq('customer_id', profile.id).order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true }); setViewings((data as typeof viewings) || []); setLoading(false); })(); }, [profile]);
  return <DashboardLayout navItems={tenantNav} title="Viewings">
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-xl font-bold text-ink-900">Property Viewings</h2><p className="mt-1 text-sm text-ink-500">Keep your scheduled inspections and appointments organized.</p></div><button onClick={() => navigate('/properties')} className="btn-primary"><Search className="h-4 w-4" /> Find a property</button></div>
    {loading ? <LoadingPage /> : viewings.length === 0 ? <EmptyState icon={<Clock className="w-8 h-8" />} title="No viewings scheduled" description="Open a property and choose Schedule Viewing to request an appointment." action={<button onClick={() => navigate('/properties')} className="btn-primary">Browse properties</button>} /> : <div className="space-y-3">{viewings.map(v => <Card key={v.id} className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><h3 className="font-semibold text-ink-900">{v.properties?.name}</h3><Badge status={v.status} /></div><p className="mt-1 text-sm text-ink-500">{v.properties?.town}, {v.properties?.county}</p><p className="mt-2 text-sm font-medium text-ink-700">{formatDate(v.appointment_date)} · {v.appointment_time}</p>{v.notes && <p className="mt-1 text-xs text-ink-500">{v.notes}</p>}</div><button onClick={() => navigate(`/property/${v.property_id}`)} className="btn-secondary text-sm">View property</button></div></Card>)}</div>}
  </DashboardLayout>;
}

export function TenantRent() {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<(RentInvoice & { properties: { name: string } | null; property_units: { unit_number: string } | null })[]>([]);
  const [lease, setLease] = useState<Lease | null>(null);
  const [payments, setPayments] = useState<(Payment & { properties: { name: string } | null; property_units: { unit_number: string } | null })[]>([]);
  const [reservationPolicy, setReservationPolicy] = useState('non_refundable');
  const [loading, setLoading] = useState(true);
  const [payInvoice, setPayInvoice] = useState<RentInvoice | null>(null);
  const [payDeposit, setPayDeposit] = useState(false);

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: leaseData }, { data: invoiceData }, { data: paymentData }, { data: settings }] = await Promise.all([
      supabase.from('leases').select('*').eq('tenant_id', profile.id).eq('status', 'active').order('created_at', { ascending: false }).maybeSingle(),
      supabase.from('rent_invoices').select('*, properties(name), property_units(unit_number)').eq('tenant_id', profile.id).order('due_date', { ascending: false }),
      supabase.from('payments').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('system_settings').select('reservation_fee_policy').eq('id', 1).maybeSingle(),
    ]);
    setLease((leaseData as Lease | null));
    setInvoices((invoiceData as typeof invoices) || []);
    setPayments((paymentData as typeof payments) || []);
    setReservationPolicy(String(settings?.reservation_fee_policy || 'non_refundable'));
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profile]);

  const outstandingRent = invoices.filter((i) => i.status !== 'paid').reduce((sum, i) => sum + Number(i.balance || 0), 0);
  const verifiedDepositPaid = payments.filter((p) => p.lease_id === lease?.id && p.payment_type === 'deposit' && p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const reservationCredit = (reservationPolicy === 'deductible_deposit' || reservationPolicy === 'deductible_rent')
    ? payments.filter((p) => p.reservation_id === lease?.reservation_id && p.payment_type === 'reservation' && p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    : 0;
  const depositBalance = lease ? Math.max(0, Number(lease.deposit || 0) - verifiedDepositPaid - (reservationPolicy === 'deductible_deposit' ? reservationCredit : 0)) : 0;
  const moveInTotal = lease ? Math.max(0, Number(lease.monthly_rent || 0) + Number(lease.service_charge || 0) + depositBalance) : 0;
  const verifiedTotal = payments.filter((p) => p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <DashboardLayout navItems={tenantNav} title="Rent & Payments">
      <div className="mb-6 rounded-2xl brand-gold-gradient p-6 text-white shadow-soft-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-sm font-semibold text-white/75">Tenant payment centre</p><h2 className="mt-1 text-2xl font-bold">Know exactly what is due</h2><p className="mt-1 max-w-2xl text-sm text-white/80">Your lease, invoices, security deposit and verified payments are calculated from the live account records.</p></div>
          {lease && <div className="rounded-xl bg-white/10 px-5 py-3 text-right backdrop-blur"><p className="text-xs text-white/70">Move-in amount</p><p className="text-2xl font-bold">{formatKES(moveInTotal)}</p></div>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-6">
        <StatCard label="Move-in Amount" value={lease ? formatKES(moveInTotal) : '—'} icon={<CreditCard className="w-5 h-5" />} accent="accent" />
        <StatCard label="Rent / Service Due" value={formatKES(outstandingRent)} icon={<Wallet className="w-5 h-5" />} accent="red" />
        <StatCard label="Deposit Balance" value={formatKES(depositBalance)} icon={<Receipt className="w-5 h-5" />} />
        <StatCard label="Verified Paid" value={formatKES(verifiedTotal)} icon={<CheckCircle className="w-5 h-5" />} accent="blue" />
      </div>

      {loading ? <LoadingPage /> : (
        <>
          {lease && <Card className="mb-6 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-ink-900">Current lease balance</h3><p className="mt-1 text-sm text-ink-500">Monthly rent {formatKES(lease.monthly_rent)} · Service charge {formatKES(lease.service_charge || 0)} · Security deposit {formatKES(lease.deposit)}</p></div><div className="flex gap-2">{outstandingRent > 0 && <button onClick={() => setPayInvoice(invoices.find((i) => i.status !== 'paid') || null)} className="btn-primary"><Wallet className="h-4 w-4" /> Pay rent</button>}{depositBalance > 0 && <button onClick={() => setPayDeposit(true)} className="btn-secondary"><Receipt className="h-4 w-4" /> Pay deposit</button>}</div></div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-sm"><div className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-400">Rent/service outstanding</p><p className="mt-1 font-bold text-ink-900">{formatKES(outstandingRent)}</p></div><div className="rounded-xl bg-ink-50 p-3"><p className="text-xs text-ink-400">Deposit outstanding</p><p className="mt-1 font-bold text-ink-900">{formatKES(depositBalance)}</p></div><div className="rounded-xl bg-brand-50 p-3"><p className="text-xs text-brand-600">Total current balance</p><p className="mt-1 font-bold text-brand-900">{formatKES(outstandingRent + depositBalance)}</p></div></div>
          </Card>}

          {invoices.length === 0 ? (
            <EmptyState icon={<Wallet className="w-8 h-8" />} title={lease ? 'No rent invoice yet' : 'No invoices yet'} description={lease ? 'Your lease is active; the first invoice will be prepared from the signed lease terms.' : 'Your monthly rent invoices will appear here once your tenancy begins.'} />
          ) : (
            <Card className="overflow-hidden">
              <div className="border-b border-ink-100 p-5"><h3 className="font-semibold text-ink-900">Rent & service invoices</h3><p className="mt-1 text-sm text-ink-500">Each invoice is tied to your lease and can only be marked paid after verified payment.</p></div>
              <div className="overflow-x-auto"><table className="premium-table w-full min-w-[980px] text-sm"><thead><tr><th>Invoice</th><th>Period</th><th>Property / Unit</th><th>Amount</th><th>Balance</th><th>Due Date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{invoices.map((inv) => <tr key={inv.id}><td><p className="font-mono text-xs font-semibold text-brand-700">{getInvoiceNumber(inv)}</p></td><td className="font-medium text-ink-900">{inv.period}</td><td><p className="font-medium text-ink-900">{inv.properties?.name || '—'}</p><p className="text-xs text-ink-400">Unit {inv.property_units?.unit_number || '—'}</p></td><td>{formatKES(inv.amount)}</td><td className="font-semibold">{formatKES(inv.balance)}</td><td className="text-ink-500">{formatDate(inv.due_date)}</td><td><Badge status={inv.status} /></td><td><div className="flex gap-2"><button type="button" onClick={() => downloadInvoicePdf({ invoice: inv, propertyName: inv.properties?.name || 'Property', unitNumber: inv.property_units?.unit_number || null, tenantName: profile?.full_name || 'Tenant' })} className="btn-secondary px-3 py-2 text-xs"><Download className="h-3.5 w-3.5" /> Invoice</button>{inv.status !== 'paid' && <button type="button" onClick={() => setPayInvoice(inv)} className="btn-primary px-3 py-2 text-xs">Pay</button>}</div></td></tr>)}</tbody></table></div>
            </Card>
          )}

          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-ink-100 bg-gradient-to-r from-white to-brand-50/30 p-5"><h3 className="font-semibold text-ink-900">Payment receipts</h3><p className="mt-1 text-sm text-ink-500">Verified payments are official receipts. Pending transactions remain clearly marked until reviewed.</p></div>
            {payments.length === 0 ? <div className="p-5 text-sm text-ink-500">No payment transactions yet.</div> : <div className="overflow-x-auto"><table className="premium-table w-full min-w-[900px] text-sm"><thead><tr><th>Receipt</th><th>Type</th><th>Property / Unit</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><p className="font-mono text-xs font-semibold text-brand-700">{payment.verified ? getReceiptNumber(payment) : 'Pending verification'}</p></td><td className="capitalize">{payment.payment_type.replace('_', ' ')}</td><td><p className="font-medium text-ink-900">{payment.properties?.name || '—'}</p><p className="text-xs text-ink-400">Unit {payment.property_units?.unit_number || '—'}</p></td><td className="font-bold">{formatKES(payment.amount)}</td><td className="capitalize">{payment.payment_method.replace('_', ' ')}</td><td><Badge status={payment.status} />{payment.verified && <span className="ml-2 badge bg-brand-50 text-brand-700">Verified</span>}</td><td className="text-ink-500">{formatDate(payment.created_at)}</td><td>{payment.verified ? <button type="button" onClick={() => downloadPaymentReceiptPdf({ payment, propertyName: payment.properties?.name || 'Property', unitNumber: payment.property_units?.unit_number || null, tenantName: profile?.full_name || 'Tenant' })} className="btn-secondary px-3 py-2 text-xs"><Download className="h-3.5 w-3.5" /> Receipt</button> : <span className="text-xs text-ink-400">Awaiting verification</span>}</td></tr>)}</tbody></table></div>}
          </Card>
        </>
      )}

      {payInvoice && <PayRentModal invoice={payInvoice} onClose={() => { setPayInvoice(null); void load(); }} />}
      {payDeposit && lease && <PayDepositModal lease={lease} amount={depositBalance} onClose={() => { setPayDeposit(false); void load(); }} />}
    </DashboardLayout>
  );
}

function PayRentModal({ invoice, onClose }: { invoice: RentInvoice; onClose: () => void }) {
  const { profile } = useAuth();
  const [method, setMethod] = useState<'mpesa' | 'card' | 'bank_transfer'>('mpesa');
  const [phone, setPhone] = useState('');
  const [step, setStep] = useState<'pay' | 'processing' | 'success'>('pay');

  const handlePay = async () => {
    if (!profile) return;
    setStep('processing');
    const { error } = await supabase.rpc('create_rent_payment', {
      p_invoice_id: invoice.id,
      p_payment_method: method,
    });
    if (error) {
      setStep('pay');
      return;
    }
    setStep('success');
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
          <h4 className="font-bold text-ink-900 text-lg mb-1">Payment Initiated</h4>
          <p className="text-sm text-ink-500 mb-6">Your rent payment request for {formatKES(invoice.balance)} has been recorded as pending. Your invoice will update only after the payment provider or administrator verifies the transaction.</p>
          <button onClick={onClose} className="btn-primary">Done</button>
        </div>
      )}
    </Modal>
  );
}

function PayDepositModal({ lease, amount, onClose }: { lease: Lease; amount: number; onClose: () => void }) {
  const { toast } = useToast();
  const [method, setMethod] = useState<'mpesa' | 'card' | 'bank_transfer'>('mpesa');
  const [loading, setLoading] = useState(false);
  const handlePay = async () => {
    setLoading(true);
    const { error } = await supabase.rpc('create_deposit_payment', { p_lease_id: lease.id, p_payment_method: method });
    setLoading(false);
    if (error) { toast(error.message || 'Could not initiate deposit payment.', 'error'); return; }
    toast('Security deposit payment request recorded as pending.', 'success');
    onClose();
  };
  return <Modal open onClose={onClose} title="Pay Security Deposit" size="md"><div className="space-y-4"><div className="rounded-xl bg-brand-50 p-4"><p className="text-sm text-ink-500">The system calculates the outstanding deposit server-side.</p><p className="mt-1 text-xl font-bold text-brand-900">{formatKES(amount)}</p></div><div><label className="label">Payment Method</label><div className="grid grid-cols-3 gap-2">{[{ v: 'mpesa', l: 'M-Pesa' }, { v: 'card', l: 'Card' }, { v: 'bank_transfer', l: 'Bank' }].map((m) => <button key={m.v} type="button" onClick={() => setMethod(m.v as typeof method)} className={`rounded-xl border p-3 text-sm font-medium ${method === m.v ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}>{m.l}</button>)}</div></div><button onClick={handlePay} className="btn-primary w-full" disabled={loading}>{loading ? 'Processing…' : 'Create Deposit Payment'}</button></div></Modal>;
}

export function TenantMaintenance() {
  const { profile } = useAuth();
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
        <div><h2 className="text-xl font-bold text-ink-900">Maintenance & Service Requests</h2><p className="mt-1 text-sm text-ink-500">Active tenants can report issues. Customers with a current reservation can also submit pre-move-in concerns.</p></div>
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
      {showAdd && <AddMaintenanceModal onClose={() => { setShowAdd(false); load(); }} />}
    </DashboardLayout>
  );
}

function AddMaintenanceModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ category: 'Plumbing', priority: 'medium', description: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.rpc('create_tenant_maintenance_request', {
      p_category: form.category.toLowerCase(),
      p_priority: form.priority,
      p_description: form.description,
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
    const { data, error } = await supabase.rpc('sign_lease_and_prepare_payment', { p_lease_id: lease.id });
    if (error) { toast(error.message || 'Could not sign the lease.', 'error'); return; }
    toast('Lease signed successfully. Your payment balance is now ready.', 'success');
    setLease((data as typeof lease) || { ...lease, signed_by_tenant: true, status: 'active' });
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
