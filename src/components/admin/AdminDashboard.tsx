import { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, Building2, Users, Calendar, DollarSign, Home, AlertCircle } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Card, LoadingScreen, Badge } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { QuickActions, type AdminPage } from '@/components/admin/AdminLayout';

interface DashboardData {
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  pendingPayments: number;
  totalProperties: number;
  availableProperties: number;
  reservedProperties: number;
  occupiedProperties: number;
  soldProperties: number;
  maintenanceProperties: number;
  totalCustomers: number;
  totalLandlords: number;
  totalAgents: number;
  totalAdmins: number;
  todayReservations: number;
  pendingReservations: number;
  confirmedReservations: number;
  cancelledReservations: number;
  expiredReservations: number;
  refunds: number;
  taxableSales: number;
  taxAmount: number;
  outstandingBalances: number;
  revenueByDay: { date: string; amount: number }[];
  reservationsByDay: { date: string; count: number }[];
  propertiesByDay: { date: string; count: number }[];
  paymentsByMethod: { method: string; count: number; amount: number }[];
  reservationsByLocation: { location: string; count: number }[];
}

type DateRange = 'today' | '7days' | '30days' | 'month' | 'year';

export function AdminDashboard({ onNavigate }: { onNavigate: (page: AdminPage) => void }) {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>('30days');

  useEffect(() => {
    async function load() {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [payments, properties, profiles, reservations] = await Promise.all([
        supabase.from('payments').select('*'),
        supabase.from('properties').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('reservations').select('*'),
      ]);

      const allPayments = (payments.data ?? []) as any[];
      const allProperties = (properties.data ?? []) as any[];
      const allProfiles = (profiles.data ?? []) as any[];
      const allReservations = (reservations.data ?? []) as any[];

      const successfulPayments = allPayments.filter((p) => p.status === 'successful');
      const totalRevenue = successfulPayments.reduce((s, p) => s + p.amount, 0);
      const todayRevenue = successfulPayments.filter((p) => p.created_at >= todayStart).reduce((s, p) => s + p.amount, 0);
      const monthRevenue = successfulPayments.filter((p) => p.created_at >= monthStart).reduce((s, p) => s + p.amount, 0);

      // Revenue by day (last 30 days)
      const revByDay: { date: string; amount: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        const amount = successfulPayments.filter((p) => p.created_at >= dStart && p.created_at < dEnd).reduce((s, p) => s + p.amount, 0);
        revByDay.push({ date: d.toISOString().split('T')[0], amount });
      }

      // Reservations by day
      const resByDay: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        const count = allReservations.filter((r) => r.created_at >= dStart && r.created_at < dEnd).length;
        resByDay.push({ date: d.toISOString().split('T')[0], count });
      }

      // Properties by day
      const propByDay: { date: string; count: number }[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now); d.setDate(d.getDate() - i);
        const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
        const dEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
        const count = allProperties.filter((p) => p.created_at >= dStart && p.created_at < dEnd).length;
        propByDay.push({ date: d.toISOString().split('T')[0], count });
      }

      // Payments by method
      const methodMap: Record<string, { count: number; amount: number }> = {};
      successfulPayments.forEach((p) => {
        if (!methodMap[p.payment_method]) methodMap[p.payment_method] = { count: 0, amount: 0 };
        methodMap[p.payment_method].count++;
        methodMap[p.payment_method].amount += p.amount;
      });
      const paymentsByMethod = Object.entries(methodMap).map(([method, v]) => ({ method, ...v }));

      // Reservations by location
      const locMap: Record<string, number> = {};
      allReservations.forEach((r) => {
        const prop = allProperties.find((p) => p.id === r.property_id);
        const loc = prop?.county ?? 'Unknown';
        locMap[loc] = (locMap[loc] ?? 0) + 1;
      });
      const reservationsByLocation = Object.entries(locMap).map(([location, count]) => ({ location, count })).sort((a, b) => b.count - a.count).slice(0, 6);

      setData({
        totalRevenue, todayRevenue, monthRevenue,
        pendingPayments: allPayments.filter((p) => p.status === 'pending').length,
        totalProperties: allProperties.length,
        availableProperties: allProperties.filter((p) => p.availability_status === 'available').length,
        reservedProperties: allProperties.filter((p) => p.availability_status === 'reserved').length,
        occupiedProperties: allProperties.filter((p) => p.availability_status === 'occupied').length,
        soldProperties: allProperties.filter((p) => p.availability_status === 'sold').length,
        maintenanceProperties: allProperties.filter((p) => p.availability_status === 'maintenance').length,
        totalCustomers: allProfiles.filter((p) => p.role === 'customer').length,
        totalLandlords: allProfiles.filter((p) => p.role === 'landlord').length,
        totalAgents: allProfiles.filter((p) => p.role === 'agent').length,
        totalAdmins: allProfiles.filter((p) => p.role === 'super_admin').length,
        todayReservations: allReservations.filter((r) => r.created_at >= todayStart).length,
        pendingReservations: allReservations.filter((r) => r.status === 'pending_payment').length,
        confirmedReservations: allReservations.filter((r) => r.status === 'confirmed').length,
        cancelledReservations: allReservations.filter((r) => r.status === 'cancelled').length,
        expiredReservations: allReservations.filter((r) => r.status === 'expired').length,
        refunds: allPayments.filter((p) => p.status === 'refunded').reduce((s, p) => s + p.amount, 0),
        taxableSales: totalRevenue,
        taxAmount: 0,
        outstandingBalances: 0,
        revenueByDay: revByDay,
        reservationsByDay: resByDay,
        propertiesByDay: propByDay,
        paymentsByMethod,
        reservationsByLocation,
      });
      setLoading(false);
    }
    load();
  }, []);

  if (loading) return <LoadingScreen message="Loading dashboard..." />;
  if (!data) return null;

  const formatKES = (n: number) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <QuickActions onNavigate={onNavigate} />

      {/* Date Range Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-500">Period:</span>
        {(['today', '7days', '30days', 'month', 'year'] as DateRange[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${range === r ? 'bg-teal-700 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
          >
            {r === 'today' ? 'Today' : r === '7days' ? '7 Days' : r === '30days' ? '30 Days' : r === 'month' ? 'This Month' : 'This Year'}
          </button>
        ))}
      </div>

      {/* Financial Stats */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Financial Statistics</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total Revenue" value={formatKES(data.totalRevenue)} icon={DollarSign} trend="+12.5%" color="bg-green-50 text-green-700" />
          <StatCard label="Today's Revenue" value={formatKES(data.todayRevenue)} icon={TrendingUp} trend="+5.2%" color="bg-teal-50 text-teal-700" />
          <StatCard label="This Month" value={formatKES(data.monthRevenue)} icon={TrendingUp} trend="+8.1%" color="bg-blue-50 text-blue-700" />
          <StatCard label="Pending Payments" value={String(data.pendingPayments)} icon={AlertCircle} color="bg-amber-50 text-amber-700" />
          <StatCard label="Refunds" value={formatKES(data.refunds)} icon={TrendingDown} color="bg-rose-50 text-rose-700" />
          <StatCard label="Taxable Sales" value={formatKES(data.taxableSales)} icon={DollarSign} color="bg-indigo-50 text-indigo-700" />
          <StatCard label="Tax Amount" value={formatKES(data.taxAmount)} icon={DollarSign} color="bg-purple-50 text-purple-700" />
          <StatCard label="Outstanding" value={formatKES(data.outstandingBalances)} icon={AlertCircle} color="bg-orange-50 text-orange-700" />
        </div>
      </div>

      {/* Property Stats */}
      <div>
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Property Statistics</h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Total" value={String(data.totalProperties)} icon={Building2} color="bg-slate-100 text-slate-700" />
          <StatCard label="Available" value={String(data.availableProperties)} icon={Home} color="bg-green-50 text-green-700" />
          <StatCard label="Reserved" value={String(data.reservedProperties)} icon={Calendar} color="bg-amber-50 text-amber-700" />
          <StatCard label="Occupied" value={String(data.occupiedProperties)} icon={Home} color="bg-blue-50 text-blue-700" />
          <StatCard label="Sold" value={String(data.soldProperties)} icon={TrendingUp} color="bg-purple-50 text-purple-700" />
          <StatCard label="Maintenance" value={String(data.maintenanceProperties)} icon={AlertCircle} color="bg-orange-50 text-orange-700" />
        </div>
      </div>

      {/* User & Booking Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">User Statistics</h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="Customers" value={String(data.totalCustomers)} icon={Users} color="bg-teal-50 text-teal-700" />
            <StatCard label="Landlords" value={String(data.totalLandlords)} icon={Home} color="bg-blue-50 text-blue-700" />
            <StatCard label="Agents" value={String(data.totalAgents)} icon={Users} color="bg-amber-50 text-amber-700" />
            <StatCard label="Admins" value={String(data.totalAdmins)} icon={Users} color="bg-slate-100 text-slate-700" />
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">Booking Statistics</h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <StatCard label="Today" value={String(data.todayReservations)} icon={Calendar} color="bg-teal-50 text-teal-700" />
            <StatCard label="Pending" value={String(data.pendingReservations)} icon={AlertCircle} color="bg-amber-50 text-amber-700" />
            <StatCard label="Confirmed" value={String(data.confirmedReservations)} icon={TrendingUp} color="bg-green-50 text-green-700" />
            <StatCard label="Cancelled" value={String(data.cancelledReservations)} icon={TrendingDown} color="bg-rose-50 text-rose-700" />
            <StatCard label="Expired" value={String(data.expiredReservations)} icon={AlertCircle} color="bg-orange-50 text-orange-700" />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Revenue Chart */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900">Revenue Over Time</h3>
          <p className="text-sm text-slate-500">Last 30 days</p>
          <LineChart data={data.revenueByDay.map((d) => ({ label: d.date.slice(5), value: d.amount }))} color="#0f766e" formatValue={formatKES} />
        </Card>

        {/* Reservations Chart */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900">Reservations Over Time</h3>
          <p className="text-sm text-slate-500">Last 30 days</p>
          <BarChart data={data.reservationsByDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} color="#0f766e" />
        </Card>

        {/* Properties Added */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900">Properties Added Over Time</h3>
          <p className="text-sm text-slate-500">Last 30 days</p>
          <BarChart data={data.propertiesByDay.map((d) => ({ label: d.date.slice(5), value: d.count }))} color="#3b82f6" />
        </Card>

        {/* Payment Methods */}
        <Card className="p-6">
          <h3 className="font-semibold text-slate-900">Payment Methods</h3>
          <p className="text-sm text-slate-500">Distribution by method</p>
          {data.paymentsByMethod.length === 0 ? (
            <p className="mt-8 text-sm text-slate-400">No payment data yet</p>
          ) : (
            <div className="mt-4 space-y-3">
              {data.paymentsByMethod.map((pm) => {
                const total = data.paymentsByMethod.reduce((s, p) => s + p.count, 0);
                const pct = total > 0 ? (pm.count / total) * 100 : 0;
                return (
                  <div key={pm.method}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium capitalize text-slate-700">{pm.method}</span>
                      <span className="text-slate-500">{pm.count} · {formatKES(pm.amount)}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-teal-600" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Reservations by Location */}
      <Card className="p-6">
        <h3 className="font-semibold text-slate-900">Reservations by Location</h3>
        <p className="text-sm text-slate-500">Top counties by reservation count</p>
        {data.reservationsByLocation.length === 0 ? (
          <p className="mt-8 text-sm text-slate-400">No reservation data yet</p>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.reservationsByLocation.map((loc) => {
              const max = Math.max(...data.reservationsByLocation.map((l) => l.count));
              const pct = max > 0 ? (loc.count / max) * 100 : 0;
              return (
                <div key={loc.location} className="flex items-center gap-3">
                  <span className="w-24 text-sm font-medium text-slate-700">{loc.location}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="flex h-full items-center rounded-full bg-gradient-to-r from-teal-500 to-teal-700 px-2 text-xs font-semibold text-white" style={{ width: `${Math.max(pct, 15)}%` }}>{loc.count}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, trend, color }: { label: string; value: string; icon: typeof Home; trend?: string; color: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${color}`}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && <span className="text-xs font-medium text-green-600">{trend}</span>}
      </div>
      <p className="mt-3 text-xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </Card>
  );
}

function LineChart({ data, color, formatValue }: { data: { label: string; value: number }[]; color: string; formatValue?: (n: number) => string }) {
  const width = 600;
  const height = 200;
  const padding = { top: 10, right: 10, bottom: 20, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * chartW,
    y: padding.top + chartH - (d.value / maxVal) * chartH,
    ...d,
  }));
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${pathD} L ${padding.left + chartW} ${padding.top + chartH} L ${padding.left} ${padding.top + chartH} Z`;

  return (
    <div className="mt-4 overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ minWidth: 300 }}>
        <defs>
          <linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={padding.left} y1={padding.top + chartH * t} x2={padding.left + chartW} y2={padding.top + chartH * t} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padding.left - 5} y={padding.top + chartH * (1 - t) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">
              {formatValue ? formatValue(maxVal * (1 - t)) : Math.round(maxVal * (1 - t))}
            </text>
          </g>
        ))}
        <path d={areaD} fill={`url(#grad-${color})`} />
        <path d={pathD} fill="none" stroke={color} strokeWidth="2" />
        {points.map((p, i) => (
          i % 5 === 0 ? (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3" fill={color} />
              <text x={p.x} y={height - 5} textAnchor="middle" className="fill-slate-400 text-[9px]">{p.label}</text>
            </g>
          ) : null
        ))}
      </svg>
    </div>
  );
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="mt-4 flex h-48 items-end gap-1 overflow-x-auto">
      {data.map((d, i) => (
        <div key={i} className="group relative flex flex-1 flex-col items-center justify-end" style={{ minWidth: 8 }}>
          <div className="absolute -top-6 hidden rounded bg-slate-800 px-1.5 py-0.5 text-xs text-white group-hover:block z-10">{d.value}</div>
          <div className="w-full rounded-t transition-all hover:opacity-80" style={{ height: `${(d.value / maxVal) * 100}%`, minHeight: d.value > 0 ? 4 : 0, backgroundColor: color }} />
          {i % 5 === 0 && <span className="mt-1 text-[8px] text-slate-400">{d.label}</span>}
        </div>
      ))}
    </div>
  );
}
