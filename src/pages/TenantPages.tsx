import { useState, useEffect } from 'react';
import { Home, Wallet, FileText, Wrench, Bell, Calendar, CheckCircle, Plus, MapPin, BedDouble, Bath, ShieldCheck, Search, ArrowRight, Clock, Eye, Receipt, CreditCard, Download, X, Copy, Upload, Building2 } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { tenantNav } from '@/components/dashboardNav';
import { StatCard, Card, Badge, EmptyState, LoadingPage, Pagination } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/hooks';
import { useToast } from '@/context/hooks';
import { useRouter } from '@/context/hooks';
import { formatKES, formatDate, titleCase, MAINTENANCE_CATEGORIES } from '@/lib/constants';
import { getPropertyImages } from '@/lib/images';
import type { Lease, RentInvoice, MaintenanceRequest, Reservation, Property, PropertyUnit, Payment } from '@/lib/supabase';
import { downloadInvoicePdf, downloadPaymentReceiptPdf, getInvoiceNumber, getReceiptNumber } from '@/lib/documents';
import { TrendChart, DonutChart } from '@/components/AnalyticsCharts';

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
  const paymentTrend = Array.from(new Map(payments.filter((p) => p.status === 'successful' && p.verified).map((p) => { const d = new Date(p.created_at); return [d.toLocaleDateString(undefined, { month: 'short' }), Number(p.amount || 0)] as const; })).entries()).slice(-6).map(([label, value]) => ({ label: String(label), value: Number(value) }));
  const paidAmount = payments.filter((p) => p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0);

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

      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <TrendChart points={paymentTrend} valueLabel="Your verified payments" prefix="KES " />
        <DonutChart segments={[{ label: 'Outstanding rent', value: Math.round(outstandingBalance) }, { label: 'Deposit balance', value: Math.round(depositBalance) }, { label: 'Paid', value: Math.round(paidAmount) }]} centerLabel="KES" centerValue={Math.round(outstandingBalance + depositBalance).toLocaleString()} />
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
  const [invoicePage, setInvoicePage] = useState(1);
  const [paymentPage, setPaymentPage] = useState(1);
  const [invoiceTotal, setInvoiceTotal] = useState(0);
  const [paymentTotal, setPaymentTotal] = useState(0);
  const [invoiceSummary, setInvoiceSummary] = useState<Array<{ balance: number | null; status: string }>>([]);
  const [paymentSummary, setPaymentSummary] = useState<Array<{ amount: number | null; status: string; verified: boolean | null; payment_type: string; lease_id: string | null; reservation_id: string | null }>>([]);
  const pageSize = 20;

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    const [{ data: leaseData }, { data: invoiceData, count: invCount }, { data: paymentData, count: payCount }, { data: settings }, { data: invoiceSummaryData }, { data: paymentSummaryData }] = await Promise.all([
      supabase.from('leases').select('*').eq('tenant_id', profile.id).eq('status', 'active').order('created_at', { ascending: false }).maybeSingle(),
      supabase.from('rent_invoices').select('*, properties(name), property_units(unit_number)', { count: 'exact' }).eq('tenant_id', profile.id).order('due_date', { ascending: false }).range((invoicePage - 1) * pageSize, invoicePage * pageSize - 1),
      supabase.from('payments').select('*, properties(name), property_units(unit_number)', { count: 'exact' }).eq('user_id', profile.id).order('created_at', { ascending: false }).range((paymentPage - 1) * pageSize, paymentPage * pageSize - 1),
      supabase.from('system_settings').select('reservation_fee_policy').eq('id', 1).maybeSingle(),
      supabase.from('rent_invoices').select('balance,status').eq('tenant_id', profile.id),
      supabase.from('payments').select('amount,status,verified,payment_type,lease_id,reservation_id').eq('user_id', profile.id),
    ]);
    setLease((leaseData as Lease | null));
    setInvoices((invoiceData as typeof invoices) || []);
    setPayments((paymentData as typeof payments) || []);
    setInvoiceTotal(invCount || 0);
    setPaymentTotal(payCount || 0);
    setReservationPolicy(String(settings?.reservation_fee_policy || 'non_refundable'));
    setInvoiceSummary((invoiceSummaryData as Array<{ balance: number | null; status: string }>) || []);
    setPaymentSummary((paymentSummaryData as Array<{ amount: number | null; status: string; verified: boolean | null; payment_type: string; lease_id: string | null; reservation_id: string | null }>) || []);
    setLoading(false);
  };

  useEffect(() => { void load(); }, [profile, invoicePage, paymentPage]);

  const outstandingRent = (invoiceSummary || []).filter((i) => i.status !== 'paid').reduce((sum, i) => sum + Number(i.balance || 0), 0);
  const verifiedDepositPaid = (paymentSummary || []).filter((p) => p.lease_id === lease?.id && p.payment_type === 'deposit' && p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const reservationCredit = (reservationPolicy === 'deductible_deposit' || reservationPolicy === 'deductible_rent')
    ? (paymentSummary || []).filter((p) => p.reservation_id === lease?.reservation_id && p.payment_type === 'reservation' && p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0)
    : 0;
  const depositBalance = lease ? Math.max(0, Number(lease.deposit || 0) - verifiedDepositPaid - (reservationPolicy === 'deductible_deposit' ? reservationCredit : 0)) : 0;
  const moveInTotal = lease ? Math.max(0, Number(lease.monthly_rent || 0) + Number(lease.service_charge || 0) + depositBalance) : 0;
  const verifiedTotal = (paymentSummary || []).filter((p) => p.status === 'successful' && p.verified).reduce((sum, p) => sum + Number(p.amount || 0), 0);

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
              <Pagination page={invoicePage} totalPages={Math.max(1, Math.ceil(invoiceTotal / pageSize))} totalItems={invoiceTotal} pageSize={pageSize} onPageChange={setInvoicePage} />
            </Card>
          )}

          <Card className="mt-6 overflow-hidden">
            <div className="border-b border-ink-100 bg-gradient-to-r from-white to-brand-50/30 p-5"><h3 className="font-semibold text-ink-900">Payment receipts</h3><p className="mt-1 text-sm text-ink-500">Verified payments are official receipts. Pending transactions remain clearly marked until reviewed.</p></div>
            {payments.length === 0 ? <div className="p-5 text-sm text-ink-500">No payment transactions yet.</div> : <div className="overflow-x-auto"><table className="premium-table w-full min-w-[900px] text-sm"><thead><tr><th>Receipt</th><th>Type</th><th>Property / Unit</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>{payments.map((payment) => <tr key={payment.id}><td><p className="font-mono text-xs font-semibold text-brand-700">{payment.verified ? getReceiptNumber(payment) : 'Pending verification'}</p></td><td className="capitalize">{payment.payment_type.replace('_', ' ')}</td><td><p className="font-medium text-ink-900">{payment.properties?.name || '—'}</p><p className="text-xs text-ink-400">Unit {payment.property_units?.unit_number || '—'}</p></td><td className="font-bold">{formatKES(payment.amount)}</td><td className="capitalize">{payment.payment_method.replace('_', ' ')}</td><td><Badge status={payment.status} />{payment.verified && <span className="ml-2 badge bg-brand-50 text-brand-700">Verified</span>}</td><td className="text-ink-500">{formatDate(payment.created_at)}</td><td>{payment.verified ? <button type="button" onClick={() => downloadPaymentReceiptPdf({ payment, propertyName: payment.properties?.name || 'Property', unitNumber: payment.property_units?.unit_number || null, tenantName: profile?.full_name || 'Tenant' })} className="btn-secondary px-3 py-2 text-xs"><Download className="h-3.5 w-3.5" /> Receipt</button> : <span className="text-xs text-ink-400">Awaiting verification</span>}</td></tr>)}</tbody></table></div>}
            {payments.length > 0 && <Pagination page={paymentPage} totalPages={Math.max(1, Math.ceil(paymentTotal / pageSize))} totalItems={paymentTotal} pageSize={pageSize} onPageChange={setPaymentPage} />}
          </Card>
        </>
      )}

      {payInvoice && <PayRentModal invoice={payInvoice} onClose={() => { setPayInvoice(null); void load(); }} />}
      {payDeposit && lease && <PayDepositModal lease={lease} amount={depositBalance} onClose={() => { setPayDeposit(false); void load(); }} />}
    </DashboardLayout>
  );
}

function BankTransferForm({
  payment,
  onSubmitted,
  onCancel,
}: {
  payment: Payment;
  onSubmitted: () => void;
  onCancel: () => void;
}) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [reference, setReference] = useState(payment.transaction_ref || '');
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [channel] = useState<'bank_transfer'>('bank_transfer');
  const [proof, setProof] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bankDetails, setBankDetails] = useState({ bank: 'Equity Bank', accountName: 'HIGHPARK CONSULT LIMITED', accountNumber: '0470281425369' });

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from('system_settings').select('equity_bank_name,equity_account_name,equity_account_number').eq('id', 1).maybeSingle();
      if (data) setBankDetails({ bank: data.equity_bank_name || 'Equity Bank', accountName: data.equity_account_name || 'HIGHPARK CONSULT LIMITED', accountNumber: data.equity_account_number || '0470281425369' });
    })();
  }, []);

  const copyValue = async (value: string, label: string) => {
    try { await navigator.clipboard.writeText(value); toast(`${label} copied.`, 'success'); }
    catch { toast(`Could not copy the ${label.toLowerCase()}.`, 'error'); }
  };

  const submit = async () => {
    if (!profile) return;
    if (!reference.trim()) { toast('Enter the bank transaction or transfer reference.', 'error'); return; }
    if (!transferDate) { toast('Select the transfer date.', 'error'); return; }
    if (transferDate > new Date().toISOString().slice(0, 10)) { toast('Transfer date cannot be in the future.', 'error'); return; }
    if (proof && proof.size > 10 * 1024 * 1024) { toast('Payment proof must be 10 MB or smaller.', 'error'); return; }
    setSubmitting(true);

    let documentId: string | null = null;
    if (proof) {
      const safeName = proof.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${profile.id}/payment-proofs/${payment.id}-${Date.now()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('pms-documents').upload(path, proof, { contentType: proof.type, upsert: false });
      if (uploadError) { setSubmitting(false); toast(`Could not upload proof: ${uploadError.message}`, 'error'); return; }

      const { data: doc, error: docError } = await supabase.from('documents').insert({
        title: `Payment proof — ${reference.trim()}`,
        category: 'financial',
        status: 'pending_review',
        file_name: proof.name,
        mime_type: proof.type,
        file_size: proof.size,
        storage_path: path,
        property_id: payment.property_id,
        lease_id: payment.lease_id,
        tenant_id: profile.id,
        uploaded_by: profile.id,
      }).select('id').single();
      if (docError || !doc) {
        await supabase.storage.from('pms-documents').remove([path]);
        setSubmitting(false);
        toast(`Could not register payment proof: ${docError?.message || 'Unknown error'}`, 'error');
        return;
      }
      documentId = doc.id;
    }

    const { error } = await supabase.rpc('submit_bank_transfer_payment', {
      p_payment_id: payment.id,
      p_transaction_ref: reference.trim(),
      p_transfer_date: transferDate,
      p_channel: channel,
      p_proof_document_id: documentId,
    });
    if (error) {
      if (documentId) {
        const { data: doc } = await supabase.from('documents').select('storage_path').eq('id', documentId).maybeSingle();
        if (doc?.storage_path) await supabase.storage.from('pms-documents').remove([doc.storage_path]);
        await supabase.from('documents').delete().eq('id', documentId);
      }
      setSubmitting(false);
      toast(`Could not submit the bank transfer: ${error.message}`, 'error');
      return;
    }
    setSubmitting(false);
    toast('Bank transfer submitted for verification.', 'success');
    onSubmitted();
  };

  return <div className="space-y-5">
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-wider text-brand-700">Payment amount</p><p className="mt-1 text-2xl font-bold text-brand-900">{formatKES(payment.amount)}</p></div>
        <Building2 className="h-7 w-7 text-brand-600" />
      </div>
    </div>
    <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between"><div><p className="font-bold text-ink-900">{bankDetails.bank}</p><p className="text-xs text-ink-500">{bankDetails.accountName}</p></div><span className="badge bg-brand-50 text-brand-700">Official account</span></div>
      <div className="space-y-2 text-sm">
        {[['Account number', bankDetails.accountNumber]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 rounded-xl bg-ink-50 px-3 py-2"><div><p className="text-xs text-ink-400">{label}</p><p className="font-mono font-semibold text-ink-900">{value}</p></div><button type="button" onClick={() => void copyValue(value, label)} className="icon-action" title={`Copy ${label}`}><Copy className="h-4 w-4" /></button></div>)}
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-500">For a direct bank transfer, send the payment to the official account above, then submit the bank transaction reference below for verification.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div><label className="label">Payment channel</label><select className="input" value={channel} disabled><option value="bank_transfer">Equity bank transfer</option></select></div>
      <div><label className="label">Transfer date</label><input className="input" type="date" max={new Date().toISOString().slice(0, 10)} value={transferDate} onChange={(e) => setTransferDate(e.target.value)} /></div>
    </div>
    <div><label className="label">Transaction / transfer reference</label><input className="input" placeholder="e.g. bank transaction reference" value={reference} onChange={(e) => setReference(e.target.value)} /><p className="mt-1 text-xs text-ink-400">Use the exact reference shown by Equity Bank or the PayBill confirmation.</p></div>
    <div><label className="label">Proof of payment <span className="font-normal text-ink-400">(optional but recommended)</span></label><label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-ink-200 bg-ink-50 p-4 hover:border-brand-300 hover:bg-brand-50"><Upload className="h-5 w-5 text-brand-600" /><div className="min-w-0 flex-1"><p className="font-semibold text-ink-800">{proof ? proof.name : 'Upload receipt or transfer confirmation'}</p><p className="text-xs text-ink-400">PDF, JPG, PNG or WebP · max 10 MB</p></div><input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setProof(e.target.files?.[0] || null)} /></label></div>
    <div className="rounded-2xl border border-amber-100 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><strong>What happens next?</strong> Your payment remains pending until the finance team verifies the amount, reference and any uploaded proof. Only then will the invoice be marked paid and a receipt issued.</div>
    <div className="flex gap-3"><button type="button" onClick={onCancel} className="btn-secondary flex-1">Back</button><button type="button" onClick={() => void submit()} disabled={submitting} className="btn-primary flex-1">{submitting ? 'Submitting…' : 'Submit for verification'}</button></div>
  </div>;
}

function MpesaStkForm({ payment, phone: initialPhone, onCancel, onSuccess, onError }: { payment: Payment; phone: string; onCancel: () => void; onSuccess: (message: string) => void; onError: (message: string) => void }) {
  const { toast } = useToast();
  const [phone, setPhone] = useState(initialPhone || '');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [started, setStarted] = useState(false);

  const startPayment = async () => {
    const selectedPhone = phone.trim();
    if (!selectedPhone) { onError('Enter the Safaricom number registered for M-Pesa before continuing.'); return; }
    setSubmitting(true); setMessage('Sending a secure M-Pesa payment prompt to your phone…');
    const { data, error } = await supabase.functions.invoke('mpesa-stk', { body: { payment_id: payment.id, phone: selectedPhone } });
    if (error || !data?.accepted) {
      setSubmitting(false);
      const detail = data?.error || error?.message || 'Could not start the M-Pesa payment.';
      onError(detail);
      return;
    }
    setStarted(true); setMessage(data.customer_message || 'Check your phone and enter your M-Pesa PIN to authorize the payment.');
    toast('M-Pesa prompt sent to your phone.', 'success');

    const startedAt = Date.now();
    const poll = async () => {
      const { data: current, error: pollError } = await supabase.from('payments').select('status,verified,mpesa_receipt_number,provider_result_description').eq('id', payment.id).maybeSingle();
      if (pollError) { console.warn('M-Pesa status check failed', pollError); }
      if (current?.status === 'successful' && current?.verified) {
        setSubmitting(false); onSuccess(current.mpesa_receipt_number ? `Payment confirmed successfully. M-Pesa receipt: ${current.mpesa_receipt_number}.` : 'Payment confirmed successfully. Your rent payment has been recorded.'); return;
      }
      if (current?.status === 'failed' || current?.status === 'cancelled') {
        setSubmitting(false); onError(current.provider_result_description || 'The M-Pesa payment was not completed. Please try again.'); return;
      }
      if (Date.now() - startedAt >= 90000) {
        setSubmitting(false); setMessage('The payment prompt is still being processed. You can close this window and check your payment history shortly.'); return;
      }
      window.setTimeout(() => { void poll(); }, 2500);
    };
    void poll();
  };

  return <div className="space-y-5">
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-5 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm"><Wallet className="h-7 w-7" /></div>
      <p className="text-xs font-bold uppercase tracking-wider text-brand-700">M-Pesa secure payment</p>
      <p className="mt-1 text-3xl font-bold text-brand-900">{formatKES(payment.amount)}</p>
      <p className="mt-2 text-sm text-brand-800">Choose the Safaricom number that should receive the M-Pesa prompt.</p>
    </div>
    {!started ? <>
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
        <label className="label">Safaricom M-Pesa number</label>
        <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="e.g. 0712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <p className="mt-1 text-xs leading-5 text-ink-400">Your registered profile phone is pre-filled when available, but you can enter a different Safaricom M-Pesa number for this payment. The M-Pesa PIN is never entered here.</p>
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-sm">
        <p className="font-semibold text-ink-900">How it works</p>
        <ol className="mt-3 space-y-2 text-sm text-ink-600"><li><span className="mr-2 font-bold text-brand-600">1.</span>Tap <strong>Send M-Pesa Prompt</strong>.</li><li><span className="mr-2 font-bold text-brand-600">2.</span>Check your phone for the M-Pesa payment prompt.</li><li><span className="mr-2 font-bold text-brand-600">3.</span>Enter your M-Pesa PIN <strong>on your phone</strong>.</li><li><span className="mr-2 font-bold text-brand-600">4.</span>Your PMS payment status updates automatically.</li></ol>
      </div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">You will never enter your M-Pesa PIN on this website. The PIN is entered only in the secure M-Pesa prompt on your phone.</div>
      <div className="flex gap-3"><button type="button" onClick={onCancel} className="btn-secondary flex-1">Back</button><button type="button" onClick={() => void startPayment()} disabled={submitting} className="btn-primary flex-1">{submitting ? 'Starting…' : `Send M-Pesa Prompt · ${formatKES(payment.amount)}`}</button></div>
    </> : <div className="text-center py-6">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-600"><div className="h-9 w-9 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" /></div>
      <h4 className="text-lg font-bold text-ink-900">Check your phone</h4><p className="mt-2 text-sm text-ink-500">{message}</p><p className="mt-3 text-xs text-ink-400">Waiting for Safaricom to confirm the payment…</p>
      <button type="button" onClick={onCancel} className="btn-secondary mt-6">Close</button>
    </div>}
  </div>;
}

function EquityPaymentForm({ payment, onCancel, onSuccess, onError }: { payment: Payment; onCancel: () => void; onSuccess: (msg: string) => void; onError: (msg: string) => void }) {
  const [loading, setLoading] = useState(false);
  const start = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('equity-payment-link', { body: { payment_id: payment.id } });
    setLoading(false);
    if (error || data?.error) { onError(data?.error || error?.message || 'Could not create the Equity payment request.'); return; }
    onSuccess(data?.message || 'Your Equity payment request has been created.');
  };
  return <div className="space-y-5">
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Equity secure payment</p>
      <p className="mt-1 text-3xl font-bold text-blue-950">{formatKES(payment.amount)}</p>
      <p className="mt-2 text-sm text-blue-900">A secure Equity payment request will be created for this exact amount. Follow the payment instructions sent to your registered contact.</p>
    </div>
    <div className="rounded-2xl border border-ink-100 bg-white p-4 text-sm text-ink-600">
      <p className="font-semibold text-ink-900">Automatic reconciliation</p>
      <p className="mt-1">Once Equity confirms the incoming payment, HighPark will match it to this payment reference and update the invoice automatically.</p>
    </div>
    <div className="flex gap-3"><button type="button" onClick={onCancel} className="btn-secondary flex-1">Back</button><button type="button" onClick={() => void start()} disabled={loading} className="btn-primary flex-1">{loading ? 'Creating…' : `Create Equity Payment · ${formatKES(payment.amount)}`}</button></div>
  </div>;
}

function PayRentModal({ invoice, onClose }: { invoice: RentInvoice; onClose: () => void }) {
  const { profile } = useAuth();
  const [method, setMethod] = useState<'mpesa' | 'bank_transfer' | 'equity'>('mpesa');
  const [mpesaPayment, setMpesaPayment] = useState<Payment | null>(null);
  const [step, setStep] = useState<'pay' | 'processing' | 'mpesa' | 'bank' | 'equity' | 'success' | 'error'>('pay');
  const [message, setMessage] = useState('');
  const [bankPayment, setBankPayment] = useState<Payment | null>(null);
  const [equityPayment, setEquityPayment] = useState<Payment | null>(null);

  const handlePay = async () => {
    if (!profile) return;
    setStep('processing'); setMessage('Creating a secure payment request…');
    const { data: payment, error } = await supabase.rpc('create_rent_payment', { p_invoice_id: invoice.id, p_payment_method: method });
    if (error || !payment) { setStep('error'); setMessage(error?.message || 'Could not create the payment request.'); return; }
    if (method === 'bank_transfer') { setBankPayment(payment as Payment); setStep('bank'); return; }
    if (method === 'equity') { setEquityPayment(payment as Payment); setStep('equity'); return; }
    setMpesaPayment(payment as Payment); setStep('mpesa');
  };

  return <Modal open onClose={onClose} title={step === 'bank' ? 'Bank Transfer Payment' : step === 'mpesa' ? 'M-Pesa Secure Payment' : step === 'equity' ? 'Equity Secure Payment' : 'Pay Rent'} size="md">
    {step === 'pay' && <div className="space-y-4">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><div className="flex justify-between mb-2"><span className="text-ink-500">Period</span><span className="font-semibold">{invoice.period}</span></div><div className="flex justify-between"><span className="text-ink-500">Amount Due</span><span className="font-bold text-xl text-brand-900">{formatKES(invoice.balance)}</span></div></div>
      <div><label className="label">Payment Method</label><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setMethod('mpesa')} className={`rounded-xl border p-3 text-left ${method === 'mpesa' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}><p className="font-semibold">M-Pesa</p><p className="text-xs opacity-70">Secure prompt · enter PIN on phone</p></button><button type="button" onClick={() => setMethod('bank_transfer')} className={`rounded-xl border p-3 text-left ${method === 'bank_transfer' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}><p className="font-semibold">Bank transfer</p><p className="text-xs opacity-70">Manual fallback</p></button><button type="button" onClick={() => setMethod('equity')} className={`rounded-xl border p-3 text-left ${method === 'equity' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-ink-200 text-ink-600'}`}><p className="font-semibold">Equity</p><p className="text-xs opacity-70">Secure payment link</p></button></div></div>
      {method === 'mpesa' && <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><p className="font-semibold text-brand-900">M-Pesa STK Push</p><p className="mt-1 text-sm text-brand-800">On the next step, enter the Safaricom M-Pesa number that should receive the secure payment prompt. Your registered profile number is only used as a convenient default.</p></div>}
      {method === 'bank_transfer' && <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><p className="font-semibold text-brand-900">Manual bank transfer</p><p className="mt-1 text-sm text-brand-800">Send the payment to HIGHPARK CONSULT LIMITED account 0470281425369, then enter the transaction reference and optionally upload proof.</p></div>}
      {method === 'equity' && <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="font-semibold text-blue-950">Equity secure collection</p><p className="mt-1 text-sm text-blue-900">Create a secure Equity payment request for this invoice. HighPark will reconcile the bank credit automatically.</p></div>}
      <button type="button" onClick={() => void handlePay()} className="btn-primary w-full">{method === 'mpesa' ? `Continue to M-Pesa · ${formatKES(invoice.balance)}` : method === 'equity' ? `Continue to Equity · ${formatKES(invoice.balance)}` : `Continue to Bank Transfer · ${formatKES(invoice.balance)}`}</button>
    </div>}
    {step === 'processing' && <div className="text-center py-10"><div className="inline-block animate-spin rounded-full border-2 border-ink-200 border-t-brand-500 w-12 h-12 mb-4" /><p className="font-semibold text-ink-900">{message}</p><p className="text-sm text-ink-500 mt-2">Please keep this window open.</p></div>}
    {step === 'mpesa' && mpesaPayment && <MpesaStkForm payment={mpesaPayment} phone={profile?.phone || ''} onCancel={() => setStep('pay')} onSuccess={(msg) => { setStep('success'); setMessage(msg); }} onError={(msg) => { setStep('error'); setMessage(msg); }} />}
    {step === 'equity' && equityPayment && <EquityPaymentForm payment={equityPayment} onCancel={() => setStep('pay')} onSuccess={(msg) => { setStep('success'); setMessage(msg); }} onError={(msg) => { setStep('error'); setMessage(msg); }} />}
    {step === 'bank' && bankPayment && <BankTransferForm payment={bankPayment} onCancel={() => setStep('pay')} onSubmitted={() => { setStep('success'); setMessage('Your bank transfer has been submitted for verification. The finance team will review the reference and proof, then issue your receipt.'); }} />}
    {step === 'success' && <div className="text-center py-8"><div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8" /></div><h4 className="font-bold text-ink-900 text-lg">Payment confirmed</h4><p className="text-sm text-ink-500 mt-2">{message}</p><button type="button" onClick={onClose} className="btn-primary mt-6">Done</button></div>}
    {step === 'error' && <div className="text-center py-8"><div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto mb-4"><X className="w-8 h-8" /></div><h4 className="font-bold text-ink-900 text-lg">Payment not completed</h4><p className="text-sm text-ink-500 mt-2">{message}</p><button type="button" onClick={() => setStep('pay')} className="btn-primary mt-6">Try again</button></div>}
  </Modal>;
}

function PayDepositModal({ lease, amount, onClose }: { lease: Lease; amount: number; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [method, setMethod] = useState<'mpesa' | 'bank_transfer' | 'equity'>('mpesa');
    const [mpesaPayment, setMpesaPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [bankPayment, setBankPayment] = useState<Payment | null>(null);
  const [equityPayment, setEquityPayment] = useState<Payment | null>(null);

  const handlePay = async () => {
    if (!profile) return;
    setLoading(true);
    const { data: payment, error } = await supabase.rpc('create_deposit_payment', { p_lease_id: lease.id, p_payment_method: method });
    if (error || !payment) { setLoading(false); toast(error?.message || 'Could not initiate deposit payment.', 'error'); return; }
    if (method === 'bank_transfer') { setLoading(false); setBankPayment(payment as Payment); return; }
    if (method === 'equity') { setLoading(false); setEquityPayment(payment as Payment); return; }
    setLoading(false); setMpesaPayment(payment as Payment);
  };

  if (mpesaPayment) return <Modal open onClose={onClose} title="Security Deposit · M-Pesa Secure Payment" size="md"><MpesaStkForm payment={mpesaPayment} phone={profile?.phone || ''} onCancel={() => setMpesaPayment(null)} onSuccess={(msg) => { setMpesaPayment(null); setPending(true); toast(msg, 'success'); }} onError={(msg) => { setMpesaPayment(null); toast(msg, 'error'); }} /></Modal>;

  if (equityPayment) return <Modal open onClose={onClose} title="Security Deposit · Equity Secure Payment" size="md"><EquityPaymentForm payment={equityPayment} onCancel={() => setEquityPayment(null)} onSuccess={(msg) => { setEquityPayment(null); setPending(true); toast(msg, 'success'); }} onError={(msg) => { setEquityPayment(null); toast(msg, 'error'); }} /></Modal>;

  if (bankPayment) return <Modal open onClose={onClose} title="Security Deposit · Bank Transfer" size="md"><BankTransferForm payment={bankPayment} onCancel={() => setBankPayment(null)} onSubmitted={() => { setBankPayment(null); setPending(true); toast('Deposit bank transfer submitted for verification.', 'success'); }} /></Modal>;

  return <Modal open onClose={onClose} title="Pay Security Deposit" size="md">
    {!pending ? <div className="space-y-4">
      <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><p className="text-sm text-ink-500">Outstanding security deposit</p><p className="mt-1 text-2xl font-bold text-brand-900">{formatKES(amount)}</p><p className="mt-1 text-xs text-ink-500">The final amount is calculated server-side from verified payments.</p></div>
      <div><label className="label">Payment Method</label><div className="grid grid-cols-3 gap-2"><button type="button" onClick={() => setMethod('mpesa')} className={`rounded-xl border p-3 text-left ${method === 'mpesa' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}><p className="font-semibold">M-Pesa</p><p className="text-xs opacity-70">PayBill · house account</p></button><button type="button" onClick={() => setMethod('bank_transfer')} className={`rounded-xl border p-3 text-left ${method === 'bank_transfer' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600'}`}><p className="font-semibold">Bank transfer</p><p className="text-xs opacity-70">Manual fallback</p></button><button type="button" onClick={() => setMethod('equity')} className={`rounded-xl border p-3 text-left ${method === 'equity' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-ink-200 text-ink-600'}`}><p className="font-semibold">Equity</p><p className="text-xs opacity-70">Secure payment link</p></button></div></div>
      {method === 'mpesa' && <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><p className="font-semibold text-brand-900">M-Pesa STK Push</p><p className="mt-1 text-sm text-brand-800">You will choose the Safaricom M-Pesa number that should receive the secure prompt on the next step.</p></div>}
      {method === 'bank_transfer' && <div className="rounded-2xl border border-brand-100 bg-brand-50 p-4"><p className="font-semibold text-brand-900">Manual bank transfer</p><p className="mt-1 text-sm text-brand-800">HIGHPARK CONSULT LIMITED · Account 0470281425369</p></div>}
      {method === 'equity' && <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4"><p className="font-semibold text-blue-950">Equity secure collection</p><p className="mt-1 text-sm text-blue-900">Create a secure Equity payment request and reconcile the resulting bank credit automatically.</p></div>}
      <button type="button" onClick={() => void handlePay()} className="btn-primary w-full" disabled={loading}>{loading ? 'Starting payment…' : method === 'mpesa' ? `Send M-Pesa Prompt · ${formatKES(amount)}` : method === 'equity' ? `Continue to Equity · ${formatKES(amount)}` : `Continue to Bank Transfer · ${formatKES(amount)}`}</button>
    </div> : <div className="py-8 text-center"><div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600"><Wallet className="h-8 w-8" /></div><h4 className="text-lg font-bold text-ink-900">Deposit payment awaiting confirmation</h4><p className="mt-2 text-sm text-ink-500">{method === 'mpesa' ? 'Your M-Pesa payment has been confirmed automatically. Your deposit balance will update from the verified payment.' : method === 'equity' ? 'Your Equity payment request has been created. The deposit balance will update after the bank confirms the payment.' : 'Your bank-transfer payment has been submitted. The finance team will verify it before updating your deposit balance.'}</p><button type="button" onClick={onClose} className="btn-primary mt-6">Close</button></div>}
  </Modal>;
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
