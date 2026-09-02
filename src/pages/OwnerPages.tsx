import { useState, useEffect } from 'react';
import { Building2, Home, Calendar, Users, Wallet, Receipt, Wrench, TrendingUp, FileText, Plus, MapPin, BedDouble, Bath, Trash2, Eye, CheckCircle, XCircle, Download, Calculator, Layers3, ImagePlus, Video, Music2 } from 'lucide-react';
import { DashboardLayout, ownerNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from '@/context/RouterContext';
import { formatKES, formatDate, titleCase, normalizeUnitType, PROPERTY_TYPES, KENYAN_COUNTIES, PROPERTY_AMENITIES, EXPENSE_CATEGORIES } from '@/lib/constants';
import { uploadPropertyMedia, deletePropertyMedia } from '@/lib/media';
import { getPropertyImages } from '@/lib/images';
import type { Property, PropertyUnit, Reservation, Lease, Expense, TaxRecord, MaintenanceRequest, Payment } from '@/lib/supabase';

export function OwnerDashboard() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Array<{
    id: string; name: string; propertyType: string; unitTypes: Record<string, number>; units: number; available: number; reserved: number;
    occupied: number; tenants: number; expectedRent: number; collectedRent: number; tax: number;
  }>>([]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    (async () => {
      const { data: props } = await supabase.from('properties').select('id,name,property_type').eq('owner_id', profile.id).order('created_at', { ascending: false });
      const propertyList = (props || []) as { id: string; name: string; property_type: string }[];
      const ids = propertyList.map((p) => p.id);
      if (!ids.length) { setSummary([]); setLoading(false); return; }

      const start = `${period}-01`;
      const next = new Date(`${period}-01T00:00:00`);
      next.setMonth(next.getMonth() + 1);
      const end = next.toISOString().slice(0, 10);
      const [{ data: units }, { data: leases }, { data: payments }, { data: taxRecords }] = await Promise.all([
        supabase.from('property_units').select('id,property_id,status,monthly_rent,house_type,bedrooms').in('property_id', ids),
        supabase.from('leases').select('property_id,tenant_id,status').in('property_id', ids).eq('status', 'active'),
        supabase.from('payments').select('property_id,amount,status,verified,payment_type').in('property_id', ids).eq('status', 'successful').eq('verified', true).gte('created_at', start).lt('created_at', end),
        supabase.from('tax_records').select('property_id,estimated_tax,period').in('property_id', ids).eq('period', period),
      ]);

      const unitList = (units || []) as Pick<PropertyUnit, 'id'|'property_id'|'status'|'monthly_rent'|'house_type'|'bedrooms'>[];
      const leaseList = (leases || []) as Pick<Lease, 'property_id'|'tenant_id'|'status'>[];
      const paymentList = (payments || []) as Pick<Payment, 'property_id'|'amount'|'status'|'verified'|'payment_type'>[];
      const taxList = (taxRecords || []) as Pick<TaxRecord, 'property_id'|'estimated_tax'>[];

      setSummary(propertyList.map((property) => {
        const propertyUnits = unitList.filter((u) => u.property_id === property.id);
        const propertyLeases = leaseList.filter((l) => l.property_id === property.id);
        const propertyPayments = paymentList.filter((p) => p.property_id === property.id && p.payment_type === 'rent');
        const propertyTax = taxList.filter((t) => t.property_id === property.id).reduce((sum, t) => sum + Number(t.estimated_tax || 0), 0);
        const unitTypes = propertyUnits.reduce<Record<string, number>>((types, unit) => { const key = normalizeUnitType(unit.house_type, unit.bedrooms); types[key] = (types[key] || 0) + 1; return types; }, {});
        return {
          id: property.id,
          name: property.name,
          propertyType: property.property_type,
          unitTypes,
          units: propertyUnits.length,
          available: propertyUnits.filter((u) => u.status === 'available').length,
          reserved: propertyUnits.filter((u) => u.status === 'reserved').length,
          occupied: propertyUnits.filter((u) => u.status === 'occupied').length,
          tenants: propertyLeases.length,
          expectedRent: propertyUnits.filter((u) => u.status === 'occupied').reduce((sum, u) => sum + Number(u.monthly_rent || 0), 0),
          collectedRent: propertyPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0),
          tax: propertyTax,
        };
      }));
      setLoading(false);
    })();
  }, [profile, period]);

  if (loading) return <DashboardLayout navItems={ownerNav} title="Dashboard"><LoadingPage /></DashboardLayout>;

  const totals = summary.reduce((acc, row) => ({
    properties: acc.properties + 1,
    units: acc.units + row.units,
    occupied: acc.occupied + row.occupied,
    available: acc.available + row.available,
    reserved: acc.reserved + row.reserved,
    tenants: acc.tenants + row.tenants,
    expectedRent: acc.expectedRent + row.expectedRent,
    collectedRent: acc.collectedRent + row.collectedRent,
    tax: acc.tax + row.tax,
  }), { properties: 0, units: 0, occupied: 0, available: 0, reserved: 0, tenants: 0, expectedRent: 0, collectedRent: 0, tax: 0 });

  return (
    <DashboardLayout navItems={ownerNav} title="Dashboard">
      <div className="mb-7 rounded-2xl brand-gold-gradient p-6 text-white shadow-soft-lg">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/75">Portfolio overview</p>
            <h2 className="mt-1 text-2xl font-bold">Good day, {profile?.full_name?.split(' ')[0] || 'Owner'}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/80">A single view of your properties, unit mix, tenants, rent collection and tax exposure.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-white/10 px-5 py-3 backdrop-blur"><p className="text-2xl font-bold">{totals.properties}</p><p className="text-xs text-white/70">Properties</p></div>
            <div className="rounded-xl bg-white/10 px-5 py-3 backdrop-blur"><p className="text-2xl font-bold">{totals.units}</p><p className="text-xs text-white/70">Units</p></div>
          </div>
        </div>
      </div>

      <div className="mb-5 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-sm font-semibold text-ink-900">Dashboard reporting period</p><p className="text-xs text-ink-500">Rent and tax figures below are scoped to this month; occupancy is live.</p></div>
        <input type="month" className="input sm:w-52" value={period} onChange={(e) => setPeriod(e.target.value)} />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 mb-7">
        <StatCard label="Total Units" value={totals.units} icon={<Home className="w-5 h-5" />} onClick={() => navigate('/owner/properties')} />
        <StatCard label="Occupied" value={totals.occupied} icon={<Users className="w-5 h-5" />} accent="blue" onClick={() => navigate('/owner/properties')} />
        <StatCard label="Vacant" value={totals.available} icon={<Home className="w-5 h-5" />} accent="ink" onClick={() => navigate('/owner/properties')} />
        <StatCard label="Active Tenants" value={totals.tenants} icon={<Users className="w-5 h-5" />} accent="accent" onClick={() => navigate('/owner/tenants')} />
        <StatCard label="Expected Rent / mo" value={formatKES(totals.expectedRent)} icon={<Wallet className="w-5 h-5" />} onClick={() => navigate('/owner/payments')} />
        <StatCard label={`Rent Collected · ${period}`} value={formatKES(totals.collectedRent)} icon={<Wallet className="w-5 h-5" />} accent="blue" onClick={() => navigate('/owner/payments')} />
        <StatCard label="Reserved Units" value={totals.reserved} icon={<Calendar className="w-5 h-5" />} accent="accent" onClick={() => navigate('/owner/reservations')} />
        <StatCard label={`Estimated Tax · ${period}`} value={formatKES(totals.tax)} icon={<TrendingUp className="w-5 h-5" />} accent="red" onClick={() => navigate('/owner/tax')} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold text-ink-900">Property-by-property performance</h3><p className="text-sm text-ink-500">Each building is separated so you can immediately see what is happening.</p></div>
          <span className="badge bg-brand-50 text-brand-700">Live portfolio data</span>
        </div>
        {summary.length === 0 ? (
          <EmptyState icon={<Building2 className="w-8 h-8" />} title="No properties yet" description="Add your first property to start tracking its units and income." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-ink-50 text-left text-ink-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Property</th><th className="px-5 py-3 font-medium">Type</th><th className="px-5 py-3 font-medium">Units</th><th className="px-5 py-3 font-medium">Vacant</th><th className="px-5 py-3 font-medium">Reserved</th><th className="px-5 py-3 font-medium">Occupied</th><th className="px-5 py-3 font-medium">Tenants</th><th className="px-5 py-3 font-medium">Rent Collected</th><th className="px-5 py-3 font-medium">Est. Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {summary.map((row) => (
                  <tr key={row.id} className="cursor-pointer hover:bg-brand-50/50" onClick={() => navigate(`/owner/units/${row.id}`)}>
                    <td className="px-5 py-4 font-semibold text-ink-900">{row.name}</td>
                    <td className="px-5 py-4"><div className="flex flex-wrap gap-1"><span className="badge bg-ink-100 text-ink-600">{row.propertyType}</span>{Object.entries(row.unitTypes).map(([type, count]) => <span key={type} className="badge bg-brand-50 text-brand-700">{type}: {count}</span>)}</div></td>
                    <td className="px-5 py-4">{row.units}</td><td className="px-5 py-4 text-ink-500">{row.available}</td><td className="px-5 py-4 text-ink-500">{row.reserved}</td><td className="px-5 py-4 font-medium">{row.occupied}</td><td className="px-5 py-4">{row.tenants}</td><td className="px-5 py-4 font-semibold">{formatKES(row.collectedRent)}</td><td className="px-5 py-4 font-semibold text-brand-700">{formatKES(row.tax)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-7 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <div className="mb-4"><h3 className="font-semibold text-ink-900">Unit type mix</h3><p className="text-xs text-ink-500">Across all your properties.</p></div>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(summary.reduce<Record<string, number>>((acc, row) => { Object.entries(row.unitTypes).forEach(([type, count]) => { acc[type] = (acc[type] || 0) + count; }); return acc; }, {})).sort((a,b) => b[1]-a[1]).map(([type,count]) => <div key={type} className="rounded-xl border border-ink-100 bg-ink-50 p-3"><p className="text-sm font-semibold text-ink-800">{type}</p><p className="mt-1 text-xl font-bold text-brand-700">{count}</p><p className="text-[11px] text-ink-500">units</p></div>)}
            {summary.length === 0 && <p className="text-sm text-ink-500">Your unit mix will appear here.</p>}
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="font-semibold text-ink-900 mb-4">Collection health</h3>
          <div className="space-y-4">
            <div><div className="mb-1 flex justify-between text-sm"><span className="text-ink-500">Rent collection</span><span className="font-semibold">{totals.expectedRent ? Math.min(100, Math.round((totals.collectedRent / totals.expectedRent) * 100)) : 0}%</span></div><div className="h-2 rounded-full bg-ink-100"><div className="h-2 rounded-full bg-brand-500" style={{ width: `${totals.expectedRent ? Math.min(100, (totals.collectedRent / totals.expectedRent) * 100) : 0}%` }} /></div></div>
            <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-brand-50 p-4"><p className="text-xs text-brand-700">Collected</p><p className="mt-1 text-lg font-bold text-brand-900">{formatKES(totals.collectedRent)}</p></div><div className="rounded-xl bg-red-50 p-4"><p className="text-xs text-red-700">Estimated tax</p><p className="mt-1 text-lg font-bold text-red-900">{formatKES(totals.tax)}</p></div></div>
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
  const [mediaProperty, setMediaProperty] = useState<Property | null>(null);

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
                <p className="text-sm text-ink-500 flex items-center gap-1 mb-3"><MapPin className="w-3.5 h-3.5" /> {p.town}, {p.county}</p><div className="mb-4 grid grid-cols-3 gap-2"><button type="button" onClick={() => navigate(`/owner/units/${p.id}`)} className="stat-chip"><strong>{p.number_of_units || 0}</strong><span>Units</span></button><button type="button" onClick={() => navigate(`/owner/units/${p.id}`)} className="stat-chip"><strong>{p.number_of_floors || 1}</strong><span>Floors</span></button><button type="button" onClick={() => navigate(`/owner/units/${p.id}`)} className="stat-chip"><strong>{p.property_type === 'Apartment' ? 'View' : 'Open'}</strong><span>Structure</span></button></div>
                <div className="flex gap-2">
                  <button onClick={() => navigate(`/property/${p.id}`)} className="btn-secondary text-sm flex-1"><Eye className="w-4 h-4" /> View</button>
                  <button onClick={() => navigate(`/owner/units/${p.id}`)} className="btn-secondary text-sm flex-1"><Home className="w-4 h-4" /> Units</button>
                  <button onClick={() => setMediaProperty(p)} className="btn-secondary text-sm flex-1">Media</button>
                  <button onClick={() => setDeleteId(p.id)} className="btn-ghost text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {showAdd && <AddPropertyModal onClose={() => { setShowAdd(false); load(); }} />}
      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Property" message="Are you sure? This will also delete all units, reservations, and leases associated with this property. This cannot be undone." confirmLabel="Delete" danger />
      {mediaProperty && <PropertyMediaModal property={mediaProperty} onClose={() => { setMediaProperty(null); load(); }} />}
    </DashboardLayout>
  );
}

function AddPropertyModal({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: '', description: '', property_type: 'Apartment', county: 'Nairobi', town: '', estate: '', street: '',
    number_of_units: 1, number_of_floors: 1, parking: false, water_availability: true, electricity: true, internet: false, pets_allowed: false,
  });
  const [amenities, setAmenities] = useState<string[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [videos, setVideos] = useState<File[]>([]);
  const [audio, setAudio] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    const { data: property, error } = await supabase.from('properties').insert({
      ...form,
      owner_id: profile.id,
      amenities,
      photos: [],
      videos: [],
      audio: [],
      status: 'pending_verification',
    }).select('id').single();
    if (error || !property) { setLoading(false); toast(error?.message || 'Could not create property. Please try again.', 'error'); return; }

    const uploadedPhotos: string[] = [];
    const uploadedVideos: string[] = [];
    const uploadedAudio: string[] = [];
    for (const file of photos) {
      const url = await uploadPropertyMedia(profile.id, property.id, file);
      if (url) uploadedPhotos.push(url); else toast(`Could not upload ${file.name}`, 'error');
    }
    for (const file of videos) {
      const url = await uploadPropertyMedia(profile.id, property.id, file);
      if (url) uploadedVideos.push(url); else toast(`Could not upload ${file.name}`, 'error');
    }
    for (const file of audio) {
      const url = await uploadPropertyMedia(profile.id, property.id, file);
      if (url) uploadedAudio.push(url); else toast(`Could not upload ${file.name}`, 'error');
    }
    const { error: mediaError } = await supabase.from('properties').update({ photos: uploadedPhotos, videos: uploadedVideos, audio: uploadedAudio }).eq('id', property.id);
    setLoading(false);
    if (mediaError) { toast('Property was created, but its media could not be saved.', 'error'); return; }
    toast('Property created! It will be reviewed by our team before going live.', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Add Property" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900"><strong>Property first, media second.</strong> Add the building details below, then attach clear photos and an optional walkthrough video. The listing stays pending until an administrator verifies it.</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="label">Property Name</label><input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Sunrise Apartments" /></div>
          <div><label className="label">Property Type</label><select className="input" value={form.property_type} onChange={(e) => setForm({ ...form, property_type: e.target.value })}>{PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="label">County</label><select className="input" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })}>{KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
          <div><label className="label">Town</label><input className="input" required value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} placeholder="Kilimani" /></div>
          <div><label className="label">Estate/Neighborhood</label><input className="input" value={form.estate} onChange={(e) => setForm({ ...form, estate: e.target.value })} placeholder="Kilimani" /></div>
          <div><label className="label">Street/Address</label><input className="input" value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} placeholder="Argwings Kodhek Road" /></div>
        </div>
        <div><label className="label">Description</label><textarea className="input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe your property..." /></div>
        <div>
          <label className="label">Amenities</label>
          <div className="flex flex-wrap gap-2">
            {PROPERTY_AMENITIES.map((a) => (
              <button key={a} type="button" onClick={() => setAmenities(amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a])} className={`badge cursor-pointer ${amenities.includes(a) ? 'bg-brand-100 text-brand-700' : 'bg-ink-100 text-ink-500'}`}>{a}</button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label">Total Units</label><input type="number" min="1" className="input" value={form.number_of_units} onChange={(e) => setForm({ ...form, number_of_units: Math.max(1, parseInt(e.target.value || '1')) })} /></div>
          <div><label className="label">Number of Floors</label><input type="number" min="1" className="input" value={form.number_of_floors} onChange={(e) => setForm({ ...form, number_of_floors: Math.max(1, parseInt(e.target.value || '1')) })} /></div>
          <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-800"><strong>Apartment?</strong><p className="mt-1">Set the floor count now. Units can later be assigned to each floor.</p></div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[{ k: 'parking', l: 'Parking' }, { k: 'water_availability', l: 'Water' }, { k: 'electricity', l: 'Electricity' }, { k: 'internet', l: 'Internet' }, { k: 'pets_allowed', l: 'Pets' }].map((f) => (
            <label key={f.k} className="flex items-center gap-2 text-sm text-ink-700"><input type="checkbox" className="h-4 w-4 rounded text-brand-600" checked={(form as Record<string, unknown>)[f.k] as boolean} onChange={(e) => setForm({ ...form, [f.k]: e.target.checked })} />{f.l}</label>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4"><ImagePlus className="mb-2 h-5 w-5 text-brand-600" /><label className="label">Photos</label><input className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => setPhotos(Array.from(e.target.files || []))} /><p className="mt-2 text-xs text-ink-500">JPG, PNG, WebP.</p></div>
          <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 p-4"><Video className="mb-2 h-5 w-5 text-brand-600" /><label className="label">Walkthrough Videos</label><input className="input" type="file" accept="video/mp4,video/webm,video/quicktime" multiple onChange={(e) => setVideos(Array.from(e.target.files || []))} /><p className="mt-2 text-xs text-ink-500">MP4, WebM, MOV.</p></div>
          <div className="rounded-2xl border border-dashed border-accent-200 bg-accent-50/50 p-4"><Music2 className="mb-2 h-5 w-5 text-accent-600" /><label className="label">Audio / Voice Tour</label><input className="input" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a" multiple onChange={(e) => setAudio(Array.from(e.target.files || []))} /><p className="mt-2 text-xs text-ink-500">MP3, WAV, OGG, M4A.</p></div>
        </div>
        <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Creating property & uploading media...' : 'Create Property'}</button>
      </form>
    </Modal>
  );
}

function PropertyMediaModal({ property, onClose }: { property: Property; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [photos, setPhotos] = useState<string[]>(property.photos || []);
  const [videos, setVideos] = useState<string[]>(property.videos || []);
  const [audio, setAudio] = useState<string[]>(property.audio || []);
  const [uploading, setUploading] = useState(false);

  const uploadFiles = async (files: FileList | null, kind: 'photo' | 'video' | 'audio') => {
    if (!profile || !files?.length) return;
    setUploading(true);
    const next = kind === 'photo' ? [...photos] : kind === 'video' ? [...videos] : [...audio];
    for (const file of Array.from(files)) {
      const url = await uploadPropertyMedia(profile.id, property.id, file);
      if (url) next.push(url); else toast(`Could not upload ${file.name}`, 'error');
    }
    if (kind === 'photo') setPhotos(next); else if (kind === 'video') setVideos(next); else setAudio(next);
    const payload = kind === 'photo' ? { photos: next } : kind === 'video' ? { videos: next } : { audio: next };
    const { error } = await supabase.from('properties').update(payload).eq('id', property.id);
    setUploading(false);
    if (error) { toast(`Files uploaded, but listing media could not be saved: ${error.message}`, 'error'); return; }
    toast('Media updated successfully.', 'success');
  };

  const remove = async (url: string, kind: 'photo' | 'video' | 'audio') => {
    const ok = await deletePropertyMedia(url);
    const current = kind === 'photo' ? photos : kind === 'video' ? videos : audio;
    const next = current.filter((item) => item !== url);
    if (kind === 'photo') setPhotos(next); else if (kind === 'video') setVideos(next); else setAudio(next);
    const payload = kind === 'photo' ? { photos: next } : kind === 'video' ? { videos: next } : { audio: next };
    await supabase.from('properties').update(payload).eq('id', property.id);
    if (!ok) toast('Media removed from the listing, but the storage file may need cleanup.', 'info'); else toast('Media removed', 'success');
  };

  return (
    <Modal open onClose={onClose} title={`Manage Media — ${property.name}`} size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div><label className="label">Add Photos</label><input className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(e) => uploadFiles(e.target.files, 'photo')} /></div>
          <div><label className="label">Add Videos</label><input className="input" type="file" accept="video/mp4,video/webm,video/quicktime" multiple disabled={uploading} onChange={(e) => uploadFiles(e.target.files, 'video')} /></div>
          <div><label className="label">Add Audio</label><input className="input" type="file" accept="audio/mpeg,audio/wav,audio/ogg,audio/mp4,audio/x-m4a" multiple disabled={uploading} onChange={(e) => uploadFiles(e.target.files, 'audio')} /></div>
        </div>
        {uploading && <p className="text-sm text-brand-700">Uploading media…</p>}
        <div><h4 className="mb-3 font-semibold text-ink-900">Photos ({photos.length})</h4>{photos.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{photos.map((url) => <div key={url} className="group relative overflow-hidden rounded-xl border border-ink-100"><img src={url} alt="Property" className="h-32 w-full object-cover" /><button type="button" onClick={() => remove(url, 'photo')} className="absolute right-2 top-2 rounded-lg bg-white/90 px-2 py-1 text-xs font-semibold text-red-600 shadow">Remove</button></div>)}</div> : <p className="text-sm text-ink-500">No owner-uploaded photos yet.</p>}</div>
        <div><h4 className="mb-3 font-semibold text-ink-900">Videos ({videos.length})</h4>{videos.length ? <div className="space-y-3">{videos.map((url) => <div key={url} className="flex items-center justify-between rounded-xl bg-ink-50 p-3"><video src={url} controls className="h-28 w-48 rounded-lg object-cover" /><button type="button" onClick={() => remove(url, 'video')} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Remove</button></div>)}</div> : <p className="text-sm text-ink-500">No walkthrough videos yet.</p>}</div>
        <div><h4 className="mb-3 font-semibold text-ink-900">Audio / Voice Tours ({audio.length})</h4>{audio.length ? <div className="space-y-3">{audio.map((url) => <div key={url} className="flex items-center gap-3 rounded-xl bg-accent-50 p-3"><Music2 className="h-5 w-5 text-accent-600" /><audio src={url} controls className="min-w-0 flex-1" /><button type="button" onClick={() => remove(url, 'audio')} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Remove</button></div>)}</div> : <p className="text-sm text-ink-500">No audio tours yet.</p>}</div>
      </div>
    </Modal>
  );
}

export function OwnerUnits({ propertyId }: { propertyId: string }) {
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
          <p className="text-sm text-ink-500">{units.length} units total · click any unit card to manage it</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Unit</button>
      </div>

      {!loading && property?.property_type === 'Apartment' && (
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: Math.max(1, property?.number_of_floors || 1) }, (_, i) => i + 1).map((floorNumber) => {
            const floorUnits = units.filter((u) => u.floor === floorNumber);
            const available = floorUnits.filter((u) => u.status === 'available').length;
            const occupied = floorUnits.filter((u) => u.status === 'occupied').length;
            const reserved = floorUnits.filter((u) => u.status === 'reserved').length;
            return (
              <Card key={floorNumber} className="p-5 border-brand-100 bg-gradient-to-br from-white to-brand-50/40 shadow-sm">
                <div className="flex items-center justify-between"><p className="text-sm font-semibold text-ink-900">Floor {floorNumber}</p><Layers3 className="h-4 w-4 text-brand-500" /></div>
                <p className="mt-2 text-2xl font-bold text-brand-700">{available} <span className="text-sm font-medium text-ink-400">available</span></p>
                <p className="mt-2 text-xs text-ink-500">{floorUnits.length} total · {occupied} occupied · {reserved} reserved</p>
              </Card>
            );
          })}
        </div>
      )}

      {loading ? <LoadingPage /> : units.length === 0 ? (
        <EmptyState icon={<Home className="w-8 h-8" />} title="No units yet" description="Add individual units to this property with rent, deposit, and amenities." action={<button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Add Unit</button>} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {units.map((u) => (
            <Card key={u.id} className="p-4 transition-all hover:-translate-y-0.5 hover:shadow-soft-lg">
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
  const [reservations, setReservations] = useState<(Reservation & { property_units: { unit_number: string; monthly_rent?: number; security_deposit?: number }; properties: { name: string } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [leaseReservation, setLeaseReservation] = useState<(Reservation & { property_units: { unit_number: string; monthly_rent?: number; security_deposit?: number }; properties: { name: string } }) | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: props } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from('reservations').select('*, property_units(unit_number,monthly_rent,security_deposit), properties(name)').in('property_id', propIds).order('created_at', { ascending: false });
      setReservations((data as typeof reservations) || []);
      setLoading(false);
    })();
  }, [profile]);

  const convertToLease = async (r: Reservation & { property_units: { unit_number: string; monthly_rent?: number; security_deposit?: number }; properties: { name: string } }) => {
    const start = new Date();
    const end = new Date(start); end.setFullYear(end.getFullYear() + 1);
    const { error } = await supabase.from('leases').insert({
      tenant_id: r.customer_id, property_id: r.property_id, unit_id: r.unit_id, reservation_id: r.id,
      lease_start: start.toISOString().slice(0,10), lease_end: end.toISOString().slice(0,10),
      monthly_rent: Number(r.property_units.monthly_rent || 0), deposit: Number(r.property_units.security_deposit || 0),
      status: 'active', signed_by_tenant: false, signed_by_owner: true,
    });
    if (error) { toast(`Could not create lease: ${error.message}`, 'error'); return; }
    await supabase.from('reservations').update({ status: 'converted' }).eq('id', r.id);
    await supabase.from('property_units').update({ status: 'occupied' }).eq('id', r.unit_id);
    await supabase.from('notifications').insert({ user_id: r.customer_id, title: 'Lease activated', message: `Your lease for ${r.properties.name}, Unit ${r.property_units.unit_number} is now active.`, type: 'lease' });
    toast('Reservation converted to an active lease.', 'success');
    setLeaseReservation(null);
    setReservations(reservations.map((x) => x.id === r.id ? { ...x, status: 'converted' } : x));
  };

  const updateStatus = async (id: string, status: string) => {
    const reservation = reservations.find((r) => r.id === id);
    await supabase.from('reservations').update({ status }).eq('id', id);
    if (status === 'cancelled' && reservation) await supabase.from('property_units').update({ status: 'available' }).eq('id', reservation.unit_id);
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
                      {r.status === 'confirmed' && (
                        <button onClick={() => setLeaseReservation(r)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100">Convert to lease</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {leaseReservation && (
        <Modal open onClose={() => setLeaseReservation(null)} title="Activate Lease" size="md">
          <div className="space-y-4">
            <div className="rounded-xl bg-brand-50 p-4 text-sm text-brand-900"><strong>{leaseReservation.properties?.name}</strong> · Unit {leaseReservation.property_units?.unit_number}<br />This will activate a 12-month lease using the unit's current rent and deposit.</div>
            <div className="grid grid-cols-2 gap-3"><div><label className="label">Monthly Rent</label><input className="input" value={formatKES(leaseReservation.property_units?.monthly_rent || 0)} readOnly /></div><div><label className="label">Deposit</label><input className="input" value={formatKES(leaseReservation.property_units?.security_deposit || 0)} readOnly /></div></div>
            <button type="button" onClick={() => convertToLease(leaseReservation)} className="btn-primary w-full">Activate Lease</button>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
}

export function OwnerExpenses() {
  const { profile } = useAuth();
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
  const { toast } = useToast();
  const [records, setRecords] = useState<(TaxRecord & { properties: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalc, setShowCalc] = useState(false);

  const load = async () => {
    if (!profile) return;
    const { data } = await supabase.from('tax_records').select('*, properties(name)').eq('owner_id', profile.id).order('period', { ascending: false }).order('created_at', { ascending: false });
    setRecords((data as typeof records) || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [profile]);

  const prepareLatest = async () => {
    const record = records.find((r) => r.status === 'calculated');
    if (!record) { toast('There is no calculated tax record to prepare.', 'info'); return; }
    const { error } = await supabase.from('tax_records').update({ status: 'prepared' }).eq('id', record.id);
    if (error) { toast('Could not prepare the tax record.', 'error'); return; }
    toast('Tax record prepared for filing.', 'success');
    load();
  };

  const exportCsv = () => {
    if (!records.length) { toast('There is no tax data to export yet.', 'info'); return; }
    const rows = [['Period','Property','Gross Income','Allowable Expenses','Taxable Income','Tax Rate %','Estimated Tax','Tax Paid','Status','KRA Reference'], ...records.map((r) => [r.period,r.properties?.name || 'All properties',r.gross_income,r.allowable_expenses,r.taxable_income,r.tax_rate_pct,r.estimated_tax,r.tax_paid,r.status,r.kra_reference || ''])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `highpark-tax-report-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const totalTax = records.reduce((s, r) => s + Number(r.estimated_tax || 0), 0);
  const totalPaid = records.reduce((s, r) => s + Number(r.tax_paid || 0), 0);

  return (
    <DashboardLayout navItems={ownerNav} title="Tax & KRA">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Estimated Tax" value={formatKES(totalTax)} icon={<TrendingUp className="w-5 h-5" />} accent="accent" />
        <StatCard label="Tax Paid" value={formatKES(totalPaid)} icon={<CheckCircle className="w-5 h-5" />} />
        <StatCard label="Outstanding" value={formatKES(Math.max(0, totalTax - totalPaid))} icon={<Receipt className="w-5 h-5" />} accent="red" />
      </div>

      <div className="card p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0"><Calculator className="w-6 h-6" /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-ink-900 mb-1">Tax calculation & filing workspace</h3>
            <p className="text-sm text-ink-500 mb-4">Calculations are based on verified rent payments and recorded expenses for the selected month and property. The configured administrator tax rate is used for the estimate.</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setShowCalc(true)} className="btn-primary text-sm"><Calculator className="w-4 h-4" /> Calculate Tax</button>
              <button onClick={prepareLatest} className="btn-secondary text-sm"><FileText className="w-4 h-4" /> Prepare a Tax Record</button>
              <button onClick={exportCsv} className="btn-secondary text-sm"><Download className="w-4 h-4" /> Export Report</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-6 bg-yellow-50 border-yellow-200"><p className="text-sm text-yellow-700"><strong>Important:</strong> These are estimates, not an electronic KRA filing. Actual filing/payment must use the applicable official KRA process.</p></div>

      {loading ? <LoadingPage /> : records.length === 0 ? (
        <EmptyState icon={<TrendingUp className="w-8 h-8" />} title="No tax records yet" description="Calculate a period to create a tax record." action={<button onClick={() => setShowCalc(true)} className="btn-primary"><Calculator className="w-4 h-4" /> Calculate Tax</button>} />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="bg-ink-50 text-ink-500 text-left"><tr><th className="px-4 py-3 font-medium">Period</th><th className="px-4 py-3 font-medium">Property</th><th className="px-4 py-3 font-medium">Gross Income</th><th className="px-4 py-3 font-medium">Expenses</th><th className="px-4 py-3 font-medium">Taxable</th><th className="px-4 py-3 font-medium">Rate</th><th className="px-4 py-3 font-medium">Est. Tax</th><th className="px-4 py-3 font-medium">Status</th></tr></thead><tbody className="divide-y divide-ink-100">{records.map((r) => <tr key={r.id} className="hover:bg-ink-50"><td className="px-4 py-3 font-medium text-ink-900">{r.period}</td><td className="px-4 py-3">{r.properties?.name || 'All properties'}</td><td className="px-4 py-3">{formatKES(r.gross_income)}</td><td className="px-4 py-3">{formatKES(r.allowable_expenses)}</td><td className="px-4 py-3">{formatKES(r.taxable_income)}</td><td className="px-4 py-3">{r.tax_rate_pct}%</td><td className="px-4 py-3 font-semibold">{formatKES(r.estimated_tax)}</td><td className="px-4 py-3"><Badge status={r.status} /></td></tr>)}</tbody></table></div>
        </Card>
      )}

      {showCalc && <TaxCalcModal ownerId={profile?.id || ''} onClose={() => { setShowCalc(false); load(); }} />}
    </DashboardLayout>
  );
}

function TaxCalcModal({ ownerId, onClose }: { ownerId: string; onClose: () => void }) {
  const { toast } = useToast();
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [propertyId, setPropertyId] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [rate, setRate] = useState(7.5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const [{ data: props }, { data: settings }] = await Promise.all([
        supabase.from('properties').select('*').eq('owner_id', ownerId).order('name'),
        supabase.from('system_settings').select('default_tax_rate_pct').eq('id', 1).maybeSingle(),
      ]);
      setProperties((props as Property[]) || []);
      setRate(Number(settings?.default_tax_rate_pct ?? 7.5));
    })();
  }, [ownerId]);

  const handleCalc = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const selected = propertyId ? properties.filter((p) => p.id === propertyId) : properties;
    if (!selected.length) { toast('Add a property before calculating tax.', 'error'); setLoading(false); return; }
    const start = `${period}-01`;
    const nextMonth = new Date(`${period}-01T00:00:00`); nextMonth.setMonth(nextMonth.getMonth() + 1);
    const end = nextMonth.toISOString().slice(0, 10);
    const results = await Promise.all(selected.map(async (property) => {
      const [{ data: payments }, { data: expenses }] = await Promise.all([
        supabase.from('payments').select('amount').eq('property_id', property.id).eq('payment_type', 'rent').eq('status', 'successful').eq('verified', true).gte('created_at', start).lt('created_at', end),
        supabase.from('expenses').select('amount').eq('property_id', property.id).gte('expense_date', start).lt('expense_date', end),
      ]);
      const gross = ((payments || []) as { amount: number }[]).reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const exp = ((expenses || []) as { amount: number }[]).reduce((sum, x) => sum + Number(x.amount || 0), 0);
      const taxable = Math.max(0, gross - exp);
      const estimatedTax = taxable * (rate / 100);
      return { propertyId: property.id, gross, exp, taxable, estimatedTax };
    }));
    const { error } = await supabase.from('tax_records').insert(results.map((r) => ({ owner_id: ownerId, property_id: r.propertyId, period, gross_income: r.gross, allowable_expenses: r.exp, taxable_income: r.taxable, tax_rate_pct: rate, estimated_tax: r.estimatedTax, tax_paid: 0, status: 'calculated' })));
    setLoading(false);
    if (error) { toast(error.message || 'Could not calculate tax.', 'error'); return; }
    const total = results.reduce((sum, r) => sum + r.estimatedTax, 0);
    toast(`${selected.length} property tax record${selected.length === 1 ? '' : 's'} saved: ${formatKES(total)}`, 'success'); onClose();
  };

  return <Modal open onClose={onClose} title="Calculate Tax" size="sm"><form onSubmit={handleCalc} className="space-y-4"><div><label className="label">Tax Period</label><input type="month" className="input" required value={period} onChange={(e) => setPeriod(e.target.value)} /></div><div><label className="label">Property</label><select className="input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}><option value="">All my properties</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div><div className="bg-ink-50 rounded-xl p-4 text-sm space-y-2"><p className="font-medium text-ink-800">Calculation preview</p><p className="text-ink-500">Each selected property is calculated separately: verified rent for the month minus recorded expenses, multiplied by the configured rate of <strong>{rate}%</strong>. This keeps tax visible per property.</p></div><button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? 'Calculating...' : 'Calculate & Save'}</button></form></Modal>;
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
      const { data } = await supabase.from('maintenance_requests').select('*, property_units(unit_number,monthly_rent,security_deposit), properties(name)').in('property_id', propIds).order('created_at', { ascending: false });
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
