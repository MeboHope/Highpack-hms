import { useState, useEffect } from 'react';
import { Building2, Home, Calendar, Users, Wallet, Receipt, Wrench, TrendingUp, FileText, Settings, Plus, MapPin, BedDouble, Bath, Trash2, Edit3, Eye, CheckCircle, XCircle, Download, Calculator } from 'lucide-react';
import { DashboardLayout, ownerNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, Spinner, LoadingPage } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from '@/context/RouterContext';
import { formatKES, formatDate, titleCase, PROPERTY_TYPES, KENYAN_COUNTIES, PROPERTY_AMENITIES, EXPENSE_CATEGORIES } from '@/lib/constants';
import { getPropertyImages } from '@/lib/images';
import type { Property, PropertyUnit, Reservation, Lease, Expense, TaxRecord, MaintenanceRequest, Payment } from '@/lib/supabase';

export function OwnerDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ properties: 0, units: 0, occupied: 0, vacant: 0, reserved: 0, expectedRent: 0, collected: 0, outstanding: 0, expenses: 0, maintenance: 0, tenants: 0 });

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: props } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) { setLoading(false); return; }

      const { data: units } = await supabase.from('property_units').select('*').in('property_id', propIds);
      const unitList = (units as PropertyUnit[]) || [];
      const occupied = unitList.filter((u) => u.status === 'occupied').length;
      const vacant = unitList.filter((u) => u.status === 'available').length;
      const reserved = unitList.filter((u) => u.status === 'reserved').length;
      const expectedRent = unitList.filter((u) => u.status === 'occupied').reduce((s, u) => s + u.monthly_rent, 0);

      const { data: leases } = await supabase.from('leases').select('*').in('property_id', propIds).eq('status', 'active');
      const leaseList = (leases as Lease[]) || [];

      const { data: payments } = await supabase.from('payments').select('amount, status, verified').in('property_id', propIds).eq('status', 'successful');
      const payList = (payments as Payment[]) || [];
      const collected = payList.filter((p) => p.verified).reduce((s, p) => s + p.amount, 0);

      const { data: expenses } = await supabase.from('expenses').select('amount').in('property_id', propIds);
      const totalExpenses = ((expenses as Expense[]) || []).reduce((s, e) => s + e.amount, 0);

      const { data: maint } = await supabase.from('maintenance_requests').select('id').in('property_id', propIds).neq('status', 'closed');

      setStats({
        properties: propIds.length,
        units: unitList.length,
        occupied,
        vacant,
        reserved,
        expectedRent,
        collected,
        outstanding: Math.max(0, expectedRent - collected),
        expenses: totalExpenses,
        maintenance: (maint || []).length,
        tenants: leaseList.length,
      });
      setLoading(false);
    })();
  }, [profile]);

  if (loading) return <DashboardLayout navItems={ownerNav} title="Dashboard"><LoadingPage /></DashboardLayout>;

  return (
    <DashboardLayout navItems={ownerNav} title="Dashboard">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Properties" value={stats.properties} icon={<Building2 className="w-5 h-5" />} />
        <StatCard label="Total Units" value={stats.units} icon={<Home className="w-5 h-5" />} accent="accent" />
        <StatCard label="Occupied" value={stats.occupied} icon={<Users className="w-5 h-5" />} accent="blue" />
        <StatCard label="Vacant" value={stats.vacant} icon={<Home className="w-5 h-5" />} accent="ink" />
        <StatCard label="Reserved" value={stats.reserved} icon={<Calendar className="w-5 h-5" />} accent="accent" />
        <StatCard label="Expected Rent/mo" value={formatKES(stats.expectedRent)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Rent Collected" value={formatKES(stats.collected)} icon={<Wallet className="w-5 h-5" />} accent="blue" />
        <StatCard label="Outstanding" value={formatKES(stats.outstanding)} icon={<Receipt className="w-5 h-5" />} accent="red" />
        <StatCard label="Expenses" value={formatKES(stats.expenses)} icon={<Receipt className="w-5 h-5" />} accent="ink" />
        <StatCard label="Maintenance" value={stats.maintenance} icon={<Wrench className="w-5 h-5" />} accent="accent" />
        <StatCard label="Active Tenants" value={stats.tenants} icon={<Users className="w-5 h-5" />} />
        <StatCard label="Taxable Income" value={formatKES(Math.max(0, stats.collected - stats.expenses))} icon={<TrendingUp className="w-5 h-5" />} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold text-ink-900 mb-4">Monthly Rental Income</h3>
          <div className="flex items-end gap-2 h-48">
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'].map((m, i) => {
              const h = 30 + ((i * 17) % 60);
              return (
                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-brand-200 rounded-t-lg" style={{ height: `${h}%` }}>
                    <div className="w-full bg-brand-500 rounded-t-lg" style={{ height: `${h * 0.7}%` }} />
                  </div>
                  <span className="text-xs text-ink-400">{m}</span>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold text-ink-900 mb-4">Occupancy Rate</h3>
          <div className="flex items-center justify-center h-48">
            <div className="relative w-40 h-40">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#eceef2" strokeWidth="12" />
                <circle
                  cx="50" cy="50" r="40" fill="none" stroke="#1ea25e" strokeWidth="12"
                  strokeDasharray={`${stats.units > 0 ? (stats.occupied / stats.units) * 251 : 0} 251`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold text-ink-900">{stats.units > 0 ? Math.round((stats.occupied / stats.units) * 100) : 0}%</span>
                <span className="text-xs text-ink-400">Occupied</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export function OwnerProperties() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('properties').select('*').eq('owner_id', profile.id).order('created_at', { ascending: false });
    setProperties((data as Property[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('properties').delete().eq('id', deleteId);
    toast('Property deleted', 'success');
    setDeleteId(null);
    load();
  };

  return (
    <DashboardLayout navItems={ownerNav} title="Properties">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-ink-900">My Properties</h2>
        <button onClick={() => setShowAdd(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Add Property
        </button>
      </div>

      {loading ? <LoadingPage /> : properties.length === 0 ? (
        <EmptyState icon={<Building2 className="w-8 h-8" />} title="No properties yet" description="Add your first property to start listing units and receiving reservations." action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Property</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="h-40 bg-ink-100 overflow-hidden cursor-pointer" onClick={() => navigate(`/property/${p.id}`)}>
                <img src={p.photos?.[0] || getPropertyImages(p.property_type)[0]} alt={p.name} className="w-full h-full object-cover hover:scale-105 transition-transform" />
              </div>
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-ink-900 truncate">{p.name}</h3>
                  <Badge status={p.status} />
                </div>
                <p className="text-sm text-ink-500 flex items-center gap-1 mb-3"><MapPin className="w-3.5 h-3.5" /> {p.town}, {p.county}</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/property/${p.id}`)} className="btn-secondary text-sm flex-1"><Eye className="w-4 h-4" /> View</button>
                  <button onClick={() => navigate(`/owner/units/${p.id}`)} className="btn-secondary text-sm flex-1"><Home className="w-4 h-4" /> Units</button>
                  <button onClick={() => setDeleteId(p.id)} className="btn-ghost text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddPropertyModal onClose={() => { setShowAdd(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Property" message="Are you sure? This will also delete all units, reservations, and leases associated with this property. This cannot be undone." confirmLabel="Delete" danger />
    </DashboardLayout>
  );
}

function AddPropertyModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '', description: '', property_type: 'Apartment', county: 'Nairobi', town: '', estate: '', street: '',
    number_of_units: 1, parking: false, water_availability: true, electricity: true, internet: false, pets_allowed: false,
  });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const { error } = await supabase.from('properties').insert({
      ...form,
      owner_id: profile.id,
      amenities,
      photos: getPropertyImages(form.property_type),
      status: 'pending_verification',
    });
    setLoading(false);
    if (error) { toast('Could not create property. Please try again.', 'error'); return; }
    toast('Property created! It will be reviewed by our team before going live.', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add Property" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div><label className="label">Property Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sunrise Apartments" /></div>
          <div><label className="label">Property Type</label><select className="input" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>{PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="label">County</label><select className="input" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}>{KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label">Town</label><input className="input" required value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="Kilimani" /></div>
          <div><label className="label">Estate/Neighborhood</label><input className="input" value={form.estate} onChange={(e) => setForm({ ...form, estate: e.target.value })} placeholder="Kilimani" /></div>
          <div><label className="label">Street/Address</label><input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="Argwings Kodhek Road" /></div>
          <div><label className="label">Number of Units</label><input type="number" className="input" min="1" value={form.number_of_units} onChange={(e) => setForm({ ...form, number_of_units: parseInt(e.target.value) || 1 })} /></div>
        </div>
        <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your property..." /></div>
        <div>
          <label className="label">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_AMENITIES.map((a) => (
              <button key={a} type="button" onClick={() => setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a])}
                className={`badge cursor-pointer ${amenities.includes(a) ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>{a}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[{ k: 'parking', l: 'Parking' }, { k: 'water_availability', l: 'Water' }, { k: 'electricity', l: 'Electricity' }, { k: 'internet', l: 'Internet' }, { k: 'pets_allowed', l: 'Pets' }].map((f) => (
            <label key={f.k} className="flex items-center gap-2 text-sm text-ink-700">
              <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={(form as Record<string, unknown>)[f.k] as boolean} onChange={(e) => setForm({ ...form, [f.k]: e.target.checked })} />
              {f.l}
            </label>
          ))}
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Creating...' : 'Create Property'}</button>
      </form>
    </Modal>
  );
}

export function OwnerUnits({ propertyId }: { propertyId: string }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = async () => {
    const { data: prop } = await supabase.from('properties').select('*').eq('id', propertyId).maybeSingle();
    setProperty(prop as Property | null);
    const { data } = await supabase.from('property_units').select('*').eq('property_id', propertyId).order('unit_number', { ascending: true });
    setUnits((data as PropertyUnit[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [propertyId]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('property_units').delete().eq('id', deleteId);
    toast('Unit deleted', 'success');
    setDeleteId(null);
    load();
  };

  return (
    <DashboardLayout navItems={ownerNav} title="Units">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-ink-900">{property?.name || 'Property'} — Units</h2>
          <p className="text-sm text-ink-500">{units.length} units total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Unit</button>
      </div>

      {loading ? <LoadingPage /> : units.length === 0 ? (
        <EmptyState icon={<Home className="w-8 h-8" />} title="No units yet" description="Add individual units to this property with rent, deposit, and amenities." action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Unit</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((u) => (
            <Card key={u.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-ink-900">Unit {u.unit_number}</h3>
                <Badge status={u.status} />
              </div>
              <div className="flex items-center gap-3 text-sm text-ink-500 mb-3">
                <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {u.bedrooms || 'Studio'}</span>
                <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {u.bathrooms}</span>
                <span>{titleCase(u.furnishing)}</span>
              </div>
              <p className="text-lg font-bold text-brand-700">{formatKES(u.monthly_rent)}<span className="text-sm font-normal text-ink-400">/mo</span></p>
              <p className="text-xs text-ink-400 mb-3">Deposit: {formatKES(u.security_deposit)} · Reserve: {formatKES(u.reservation_fee)}</p>
              <button onClick={() => setDeleteId(u.id)} className="btn-ghost text-red-500 text-sm w-full"><Trash2 className="w-4 h-4" /> Delete</button>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddUnitModal propertyId={propertyId} onClose={() => { setShowAdd(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Unit" message="Delete this unit? Reservations and leases may be affected." confirmLabel="Delete" danger />
    </DashboardLayout>
  );
}

function AddUnitModal({ propertyId, onClose }: { propertyId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    unit_number: '', floor: '1', house_type: 'Apartment', bedrooms: '1', bathrooms: '1',
    monthly_rent: '25000', security_deposit: '25000', reservation_fee: '2000', service_charge: '0',
    furnishing: 'unfurnished', description: '',
  });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('property_units').insert({
      property_id: propertyId,
      unit_number: form.unit_number,
      floor: parseInt(form.floor),
      house_type: form.house_type,
      bedrooms: parseInt(form.bedrooms),
      bathrooms: parseInt(form.bathrooms),
      monthly_rent: parseFloat(form.monthly_rent),
      security_deposit: parseFloat(form.security_deposit),
      reservation_fee: parseFloat(form.reservation_fee),
      service_charge: parseFloat(form.service_charge),
      furnishing: form.furnishing,
      amenities,
      description: form.description,
      status: 'available',
      photos: getPropertyImages(form.house_type),
    });
    setLoading(false);
    if (error) { toast('Could not create unit.', 'error'); return; }
    toast('Unit created successfully!', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add Unit" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Unit Number</label><input className="input" required value={form.unit_number} onChange={(e) => setForm({ ...form, unit_number: e.target.value })} placeholder="A01" /></div>
          <div><label className="label">Floor</label><input type="number" className="input" value={form.floor} onChange={(e) => setForm({ ...form, floor: e.target.value })} /></div>
          <div><label className="label">House Type</label><select className="input" value={form.house_type} onChange={(e) => setForm({ ...form, house_type: e.target.value })}>{PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="label">Furnishing</label><select className="input" value={form.furnishing} onChange={(e) => setForm({ ...form, furnishing: e.target.value })}><option value="furnished">Furnished</option><option value="semi_furnished">Semi-Furnished</option><option value="unfurnished">Unfurnished</option></select></div>
          <div><label className="label">Bedrooms</label><input type="number" className="input" min="0" value={form.bedrooms} onChange={(e) => setForm({ ...form, bedrooms: e.target.value })} /></div>
          <div><label className="label">Bathrooms</label><input type="number" className="input" min="1" value={form.bathrooms} onChange={(e) => setForm({ ...form, bathrooms: e.target.value })} /></div>
          <div><label className="label">Monthly Rent (KSh)</label><input type="number" className="input" required value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: e.target.value })} /></div>
          <div><label className="label">Security Deposit (KSh)</label><input type="number" className="input" value={form.security_deposit} onChange={(e) => setForm({ ...form, security_deposit: e.target.value })} /></div>
          <div><label className="label">Reservation Fee (KSh)</label><input type="number" className="input" value={form.reservation_fee} onChange={(e) => setForm({ ...form, reservation_fee: e.target.value })} /></div>
          <div><label className="label">Service Charge (KSh)</label><input type="number" className="input" value={form.service_charge} onChange={(e) => setForm({ ...form, service_charge: e.target.value })} /></div>
        </div>
        <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div>
          <label className="label">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_AMENITIES.map((a) => (
              <button key={a} type="button" onClick={() => setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a])}
                className={`badge cursor-pointer ${amenities.includes(a) ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>{a}</button>
            ))}
          </div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Creating...' : 'Create Unit'}</button>
      </form>
    </Modal>
  );
}

export function OwnerReservations() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [reservations, setReservations] = useState<(Reservation & { property_units: { unit_number: string }; properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: props } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from('reservations').select('*, property_units(unit_number), properties(name)').in('property_id', propIds).order('created_at', { ascending: false });
      setReservations((data as typeof reservations) || []);
      setLoading(false);
    })();
  }, [profile]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('reservations').update({ status }).eq('id', id);
    toast(`Reservation ${status}`, 'success');
    setReservations(reservations.map((r) => r.id === id ? { ...r, status: status as Reservation['status'] } : r));
  };

  return (
    <DashboardLayout navItems={ownerNav} title="Reservations">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Property Reservations</h2>
      {loading ? <LoadingPage /> : reservations.length === 0 ? (
        <EmptyState icon={<Calendar className="w-8 h-8" />} title="No reservations yet" description="When customers reserve your units, they'll appear here for approval." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Property</th>
                  <th className="px-4 py-3 font-medium">Unit</th>
                  <th className="px-4 py-3 font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {reservations.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{r.properties?.name}</td>
                    <td className="px-4 py-3">{r.property_units?.unit_number}</td>
                    <td className="px-4 py-3">{formatKES(r.reservation_fee)}</td>
                    <td className="px-4 py-3"><Badge status={r.status} /></td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(r.created_at)}</td>
                    <td className="px-4 py-3">
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateStatus(r.id, 'confirmed')} className="text-brand-600 hover:bg-brand-50 p-1.5 rounded-lg"><CheckCircle className="w-4 h-4" /></button>
                          <button onClick={() => updateStatus(r.id, 'cancelled')} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><XCircle className="w-4 h-4" /></button>
                        </div>
                      )}
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

export function OwnerExpenses() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [expenses, setExpenses] = useState<(Expense & { properties: { name: string } })[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data: props } = await supabase.from('properties').select('*').eq('owner_id', profile.id);
    setProperties((props as Property[]) || []);
    const { data } = await supabase.from('expenses').select('*, properties(name)').eq('owner_id', profile.id).order('expense_date', { ascending: false });
    setExpenses((data as typeof expenses) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <DashboardLayout navItems={ownerNav} title="Expenses">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-ink-900">Property Expenses</h2>
          <p className="text-sm text-ink-500">Total: {formatKES(total)}</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Record Expense</button>
      </div>

      {loading ? <LoadingPage /> : expenses.length === 0 ? (
        <EmptyState icon={<Receipt className="w-8 h-8" />} title="No expenses recorded" description="Track property expenses for tax deduction purposes." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Category</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Vendor</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{e.properties?.name}</td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3 font-semibold">{formatKES(e.amount)}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3 text-ink-500">{e.vendor || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && <AddExpenseModal properties={properties} ownerId={profile?.id || ''} onClose={() => { setShowAdd(false); load(); }} />}
    </DashboardLayout>
  );
}

function AddExpenseModal({ properties, ownerId, onClose }: { properties: Property[]; ownerId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ property_id: properties[0]?.id || '', category: 'Repairs', amount: '', expense_date: new Date().toISOString().split('T')[0], vendor: '', description: '', payment_method: 'cash' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.from('expenses').insert({ ...form, owner_id: ownerId, amount: parseFloat(form.amount) });
    setLoading(false);
    if (error) { toast('Could not record expense.', 'error'); return; }
    toast('Expense recorded!', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Record Expense" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div><label className="label">Property</label><select className="input" required value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })}>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="label">Category</label><select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label">Amount (KSh)</label><input type="number" className="input" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><label className="label">Date</label><input type="date" className="input" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
          <div><label className="label">Vendor/Supplier</label><input className="input" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} /></div>
        </div>
        <div><label className="label">Description</label><textarea className="input" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Saving...' : 'Record Expense'}</button>
      </form>
    </Modal>
  );
}

export function OwnerTax() {
  const { profile } = useAuth();
  const [records, setRecords] = useState<(TaxRecord & { properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase.from('tax_records').select('*, properties(name)').eq('owner_id', profile.id).order('created_at', { ascending: false });
      setRecords((data as typeof records) || []);
      setLoading(false);
    })();
  }, [profile]);

  const totalTax = records.reduce((s, r) => s + r.estimated_tax, 0);
  const totalPaid = records.reduce((s, r) => s + r.tax_paid, 0);

  return (
    <DashboardLayout navItems={ownerNav} title="Tax & KRA">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Estimated Tax" value={formatKES(totalTax)} icon={<TrendingUp className="w-5 h-5" />} accent="accent" />
        <StatCard label="Tax Paid" value={formatKES(totalPaid)} icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard label="Outstanding" value={formatKES(Math.max(0, totalTax - totalPaid))} icon={<Receipt className="w-5 h-5" />} accent="red" />
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Calculator className="w-6 h-6" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-ink-900 mb-1">Tax Rules Engine</h3>
            <p className="text-sm text-ink-500 mb-4">The system uses configurable tax rules (default: 7.5% residential rental income tax). Tax rates are set by administrators and can be updated when KRA regulations change.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowCalc(true)} className="btn-primary text-sm"><Calculator className="w-4 h-4" /> Calculate Tax</button>
              <button className="btn-secondary text-sm"><FileText className="w-4 h-4" /> Prepare Tax Record</button>
              <button className="btn-secondary text-sm"><Download className="w-4 h-4" /> Export Report</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-6 bg-yellow-50 border-yellow-200">
        <p className="text-sm text-yellow-700">
          <strong>KRA Integration:</strong> This system is designed to integrate with official KRA-approved services. Tax calculations are estimates based on configured rates. Actual KRA filings must be completed through official KRA channels (KRA Portal, iTax, or authorized payment providers).
        </p>
      </div>

      {loading ? <LoadingPage /> : records.length === 0 ? (
        <EmptyState icon={<TrendingUp className="w-8 h-8" />} title="No tax records yet" description="Calculate your tax liability to generate records for KRA filing." action={<button onClick={() => setShowCalc(true)} className="btn-primary"><Calculator className="w-4 h-4" /> Calculate Tax</button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Gross Income</th><th className="px-4 py-3 font-medium">Expenses</th><th className="px-4 py-3 font-medium">Taxable</th><th className="px-4 py-3 font-medium">Est. Tax</th><th className="px-4 py-3 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{r.period}</td>
                    <td className="px-4 py-3">{r.properties?.name || 'All'}</td>
                    <td className="px-4 py-3">{formatKES(r.gross_income)}</td>
                    <td className="px-4 py-3">{formatKES(r.allowable_expenses)}</td>
                    <td className="px-4 py-3">{formatKES(r.taxable_income)}</td>
                    <td className="px-4 py-3 font-semibold">{formatKES(r.estimated_tax)}</td>
                    <td className="px-4 py-3"><Badge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showCalc && <TaxCalcModal ownerId={profile?.id || ''} onClose={() => { setShowCalc(false); window.location.reload(); }} />}
    </DashboardLayout>
  );
}

function TaxCalcModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const handleCalc = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data: props } = await supabase.from('properties').select('id').eq('owner_id', ownerId);
    const propIds = (props || []).map((p) => p.id);

    const { data: payments } = await supabase.from('payments').select('amount').in('property_id', propIds).eq('status', 'successful').eq('verified', true);
    const gross = ((payments as Payment[]) || []).reduce((s, p) => s + p.amount, 0);

    const { data: expenses } = await supabase.from('expenses').select('amount').in('property_id', propIds);
    const exp = ((expenses as Expense[]) || []).reduce((s, e) => s + e.amount, 0);

    const taxable = Math.max(0, gross - exp);
    const estimatedTax = taxable * 0.075;

    const { error } = await supabase.from('tax_records').insert({
      owner_id: ownerId, period, gross_income: gross, allowable_expenses: exp,
      taxable_income: taxable, tax_rate_pct: 7.5, estimated_tax: estimatedTax, tax_paid: 0, status: 'calculated',
    });
    setLoading(false);
    if (error) { toast('Could not calculate tax.', 'error'); return; }
    toast('Tax calculated successfully!', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Calculate Tax" size="sm">
      <form onSubmit={handleCalc} className="space-y-4">
        <div><label className="label">Tax Period (YYYY-MM)</label><input type="month" className="input" required value={period} onChange={(e) => setPeriod(e.target.value)} /></div>
        <div className="bg-ink-50 rounded-xl p-4 text-sm space-y-2">
          <p className="text-ink-500">This will calculate your tax based on:</p>
          <ul className="space-y-1 text-ink-600">
            <li>• Gross rental income (verified payments)</li>
            <li>• Allowable expenses recorded</li>
            <li>• Tax rate: 7.5% (residential rental income)</li>
          </ul>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Calculating...' : 'Calculate & Save'}</button>
      </form>
    </Modal>
  );
}

export function OwnerMaintenance() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [requests, setRequests] = useState<(MaintenanceRequest & { property_units: { unit_number: string }; properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: props } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from('maintenance_requests').select('*, property_units(unit_number), properties(name)').in('property_id', propIds).order('created_at', { ascending: false });
      setRequests((data as typeof requests) || []);
      setLoading(false);
    })();
  }, [profile]);

  const updateStatus = async (id: string, status: string) => {
    await supabase.from('maintenance_requests').update({ status }).eq('id', id);
    toast(`Request ${titleCase(status)}`, 'success');
    setRequests(requests.map((r) => r.id === id ? { ...r, status: status as MaintenanceRequest['status'] } : r));
  };

  return (
    <DashboardLayout navItems={ownerNav} title="Maintenance">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Maintenance Requests</h2>
      {loading ? <LoadingPage /> : requests.length === 0 ? (
        <EmptyState icon={<Wrench className="w-8 h-8" />} title="No maintenance requests" description="Tenant maintenance requests will appear here." />
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <Card key={r.id} className="p-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-ink-900">{r.category}</h3>
                    <Badge status={r.status} />
                    <Badge>{r.priority}</Badge>
                  </div>
                  <p className="text-sm text-ink-600">{r.description}</p>
                  <p className="text-xs text-ink-400 mt-1">{r.properties?.name} — Unit {r.property_units?.unit_number} · {formatDate(r.created_at)}</p>
                </div>
                <select className="input sm:w-40" value={r.status} onChange={(e) => updateStatus(r.id, e.target.value)}>
                  <option value="submitted">Submitted</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="awaiting_parts">Awaiting Parts</option>
                  <option value="completed">Completed</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}

export function OwnerTenants() {
  const { profile } = useAuth();
  const [leases, setLeases] = useState<(Lease & { properties: { name: string }; property_units: { unit_number: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: props } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from('leases').select('*, properties(name), property_units(unit_number)').in('property_id', propIds).order('created_at', { ascending: false });
      setLeases((data as typeof leases) || []);
      setLoading(false);
    })();
  }, [profile]);

  return (
    <DashboardLayout navItems={ownerNav} title="Tenants">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Active Tenants</h2>
      {loading ? <LoadingPage /> : leases.length === 0 ? (
        <EmptyState icon={<Users className="w-8 h-8" />} title="No tenants yet" description="When reservations convert to tenancies, your tenants will appear here." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Unit</th><th className="px-4 py-3 font-medium">Rent</th><th className="px-4 py-3 font-medium">Start</th><th className="px-4 py-3 font-medium">End</th><th className="px-4 py-3 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {leases.map((l) => (
                  <tr key={l.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{l.properties?.name}</td>
                    <td className="px-4 py-3">{l.property_units?.unit_number}</td>
                    <td className="px-4 py-3">{formatKES(l.monthly_rent)}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(l.lease_start)}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(l.lease_end)}</td>
                    <td className="px-4 py-3"><Badge status={l.status} /></td>
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

export function OwnerPayments() {
  const { profile } = useAuth();
  const [payments, setPayments] = useState<(Payment & { properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: props } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from('payments').select('*, properties(name)').in('property_id', propIds).order('created_at', { ascending: false });
      setPayments((data as typeof payments) || []);
      setLoading(false);
    })();
  }, [profile]);

  const total = payments.filter((p) => p.verified && p.status === 'successful').reduce((s, p) => s + p.amount, 0);

  return (
    <DashboardLayout navItems={ownerNav} title="Payments">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Collected" value={formatKES(total)} icon={<Wallet className="w-5 h-5" />} />
        <StatCard label="Transactions" value={payments.length} icon={<Receipt className="w-5 h-5" />} accent="blue" />
        <StatCard label="Verified" value={payments.filter((p) => p.verified).length} icon={<CheckCircle className="w-5 h-5" />} accent="accent" />
      </div>
      {loading ? <LoadingPage /> : payments.length === 0 ? (
        <EmptyState icon={<Wallet className="w-8 h-8" />} title="No payments yet" description="Payment transactions will appear here once tenants start paying rent." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-ink-50 text-ink-500 text-left">
                <tr><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{p.properties?.name || '—'}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_type}</td>
                    <td className="px-4 py-3 font-semibold">{formatKES(p.amount)}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
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

export function OwnerReports() {
  return (
    <DashboardLayout navItems={ownerNav} title="Reports">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Financial Reports</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: 'Rental Income Report', desc: 'Monthly rental income breakdown', icon: <Wallet className="w-5 h-5" /> },
          { title: 'Expense Report', desc: 'Property expenses by category', icon: <Receipt className="w-5 h-5" /> },
          { title: 'Occupancy Report', desc: 'Unit occupancy and vacancy rates', icon: <Building2 className="w-5 h-5" /> },
          { title: 'Tax Report', desc: 'Tax calculations and payments', icon: <TrendingUp className="w-5 h-5" /> },
          { title: 'Reservation Report', desc: 'Reservation activity and conversion', icon: <Calendar className="w-5 h-5" /> },
          { title: 'Tenant Report', desc: 'Active tenants and lease status', icon: <Users className="w-5 h-5" /> },
        ].map((r) => (
          <Card key={r.title} className="p-5 hover:shadow-md transition-shadow cursor-pointer">
            <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-3">{r.icon}</div>
            <h3 className="font-semibold text-ink-900 mb-1">{r.title}</h3>
            <p className="text-sm text-ink-500 mb-4">{r.desc}</p>
            <div className="flex gap-2">
              <button className="btn-secondary text-xs flex-1"><Download className="w-3.5 h-3.5" /> PDF</button>
              <button className="btn-secondary text-xs flex-1"><Download className="w-3.5 h-3.5" /> CSV</button>
            </div>
          </Card>
        ))}
      </div>
    </DashboardLayout>
  );
}

export function OwnerSettings() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({ full_name: '', phone: '', national_id: '', kra_pin: '', bio: '' });

  useEffect(() => {
    if (profile) setForm({
      full_name: profile.full_name || '', phone: profile.phone || '',
      national_id: profile.national_id || '', kra_pin: profile.kra_pin || '', bio: profile.bio || '',
    });
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.from('profiles').update(form).eq('id', profile?.id);
    toast('Profile updated successfully', 'success');
  };

  return (
    <DashboardLayout navItems={ownerNav} title="Settings">
      <h2 className="text-xl font-bold text-ink-900 mb-6">Account Settings</h2>
      <Card className="p-6 max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div><label className="label">Full Name</label><input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><label className="label">National ID</label><input className="input" value={form.national_id} onChange={(e) => setForm({ ...form, national_id: e.target.value })} /></div>
          </div>
          <div><label className="label">KRA PIN</label><input className="input" value={form.kra_pin} onChange={(e) => setForm({ ...form, kra_pin: e.target.value })} placeholder="A000000000X" /></div>
          <div><label className="label">Bio</label><textarea className="input" rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></div>
          <button type="submit" className="btn-primary">Save Changes</button>
        </form>
      </Card>
    </DashboardLayout>
  );
}
