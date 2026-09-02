import { useState, useEffect, useCallback } from 'react';
import { Building2, Home, Calendar, Users, Wallet, Receipt, Wrench, TrendingUp, FileText, Plus, MapPin, BedDouble, Bath, Trash2, Eye, CheckCircle, XCircle, Download, Calculator, Layers3, Clock, ImagePlus, Video, Music2 } from 'lucide-react';
import { DashboardLayout, ownerNav } from '@/components/DashboardLayout';
import { StatCard, Card, Badge, EmptyState, LoadingPage } from '@/components/ui';
import { Modal, ConfirmDialog } from '@/components/Modal';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { useRouter } from '@/context/RouterContext';
import { formatKES, formatDate, titleCase, PROPERTY_TYPES, KENYAN_COUNTIES, PROPERTY_AMENITIES, EXPENSE_CATEGORIES } from '@/lib/constants';
import { uploadPropertyMedia, deletePropertyMedia } from '@/lib/media';
import { getPropertyImages } from '@/lib/images';
import { downloadPaymentReceiptPdf } from '@/lib/documents';
import { loadDashboardPropertyPerformance, loadManagedExpenses, loadManagedMaintenance } from '@/lib/operationalData';
import type { Property, PropertyUnit, Reservation, Lease, Expense, TaxRecord, MaintenanceRequest, Payment } from '@/lib/supabase';

export function OwnerDashboard() {
  const { profile } = useAuth();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState<Array<{
    id: string; name: string; propertyType: string; unitTypes: Record<string, number>; units: number; available: number; reserved: number;
    occupied: number; tenants: number; expectedRent: number; collectedRent: number; tax: number; floors: Record<string, { total: number; available: number; occupied: number; reserved: number }>;
  }>>([]);

  useEffect(() => {
    if (!profile) return;
    setLoading(true);
    loadDashboardPropertyPerformance(profile.id, profile.role, period)
      .then(setSummary)
      .catch((error) => {
        console.error('Owner dashboard summary error:', error);
        setSummary([]);
      })
      .finally(() => setLoading(false));
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
        <div className="flex flex-col gap-3 border-b border-ink-100 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="font-semibold text-ink-900">Property-by-property performance</h3><p className="text-sm text-ink-500">A visual operating snapshot for every property. Click a card to inspect units and floors.</p></div>
          <span className="badge bg-brand-50 text-brand-700">Live portfolio data</span>
        </div>
        {summary.length === 0 ? <EmptyState icon={<Building2 className="w-8 h-8" />} title="No properties yet" description="Add your first property to start tracking its units and income." /> :
          <div className="grid grid-cols-1 gap-5 p-5 xl:grid-cols-2">
            {summary.map((row) => { const occupancy = row.units ? Math.round((row.occupied / row.units) * 100) : 0; return <button key={row.id} type="button" onClick={() => navigate(`/owner/units/${row.id}`)} className="group text-left rounded-2xl border border-ink-100 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-soft-lg focus:outline-none focus:ring-2 focus:ring-brand-500/20">
              <div className="flex items-start gap-4"><img src={getPropertyImages(row.propertyType)[0]} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /><div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3"><div><h4 className="font-bold text-ink-900 group-hover:text-brand-700">{row.name}</h4><div className="mt-1 flex flex-wrap gap-1.5"><span className="badge bg-ink-100 text-ink-600">{row.propertyType}</span>{Object.entries(row.unitTypes).map(([type,count]) => <span key={type} className="badge bg-brand-50 text-brand-700">{type} · {count}</span>)}</div></div><span className="text-xs font-semibold text-brand-700">View details →</span></div>
                <div className="mt-3"><div className="mb-1 flex justify-between text-[11px] text-ink-500"><span>Occupancy</span><span className="font-semibold text-ink-700">{occupancy}%</span></div><div className="h-1.5 rounded-full bg-ink-100"><div className="h-1.5 rounded-full bg-brand-500" style={{width:`${occupancy}%`}} /></div></div>
              </div></div>
              <div className="mt-4 grid grid-cols-4 gap-2">{[[row.units,'Units','text-ink-900'],[row.available,'Vacant','text-brand-700'],[row.reserved,'Reserved','text-accent-700'],[row.occupied,'Occupied','text-blue-700']].map(([value,label,cls]) => <div key={String(label)} className="rounded-xl bg-ink-50 p-2.5"><p className={`text-lg font-bold ${cls}`}>{value}</p><p className="text-[10px] uppercase tracking-wide text-ink-400">{label}</p></div>)}</div>
              <div className="mt-3 grid grid-cols-3 gap-3 border-t border-ink-100 pt-3 text-xs"><div><p className="text-ink-400">Tenants</p><p className="mt-0.5 font-semibold text-ink-900">{row.tenants}</p></div><div><p className="text-ink-400">Rent collected</p><p className="mt-0.5 font-semibold text-ink-900">{formatKES(row.collectedRent)}</p></div><div><p className="text-ink-400">Est. tax</p><p className="mt-0.5 font-semibold text-brand-700">{formatKES(row.tax)}</p></div></div>
              {row.propertyType.toLowerCase().includes('apartment') && <div className="mt-3 rounded-xl bg-brand-50/60 p-3"><p className="mb-2 text-xs font-semibold text-brand-900">Floor availability</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{Object.entries(row.floors).sort((a,b)=>a[0].localeCompare(b[0],undefined,{numeric:true})).map(([floor,x]) => <div key={floor} className="rounded-lg border border-brand-100 bg-white px-2.5 py-2"><p className="text-[11px] font-semibold text-ink-800">{floor}</p><p className="text-[11px] text-brand-700"><strong>{x.available}</strong> available / {x.total}</p></div>)}</div></div>}
            </button>; })}
          </div>}
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

  const convertToLease = async (r: Reservation & { property_units: { unit_number: string; monthly_rent?: number; security_deposit?: number }; properties: { name: string } }) => {
    const start = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.rpc('create_lease_from_reservation', { p_reservation_id: r.id, p_lease_start: start, p_lease_months: 12 });
    if (error) { toast(`Could not create lease: ${error.message}`, 'error'); return; }
    toast('Reservation converted to an active lease.', 'success');
    setLeaseReservation(null);
    setReservations(reservations.map((x) => x.id === r.id ? { ...x, status: 'converted' } : x));
  };

  const loadReservations = useCallback(async () => {
    if (!profile) return;
    const { data: props, error: propsError } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
    if (propsError) { toast(`Could not load properties: ${propsError.message}`, 'error'); setLoading(false); return; }
    const propIds = (props || []).map((p) => p.id);
    if (propIds.length === 0) { setReservations([]); setLoading(false); return; }
    const { data, error } = await supabase.from('reservations').select('*, property_units(unit_number,monthly_rent,security_deposit), properties(name)').in('property_id', propIds).order('created_at', { ascending: false });
    if (error) { toast(`Could not load reservations: ${error.message}`, 'error'); return; }
    setReservations((data as typeof reservations) || []);
    setLoading(false);
  }, [profile, toast]);

  useEffect(() => { void loadReservations(); }, [loadReservations]);

  const updateStatus = async (id: string, status: 'confirmed' | 'cancelled') => {
    const { error } = await supabase.rpc('update_reservation_status_by_manager', { p_reservation_id: id, p_status: status });
    if (error) { toast(`Could not ${status === 'confirmed' ? 'confirm' : 'cancel'} reservation: ${error.message}`, 'error'); return; }
    toast(`Reservation ${status}`, 'success');
    await loadReservations();
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
    const [{ data: props }, expenseResult] = await Promise.all([
      supabase.from('properties').select('*').eq('owner_id', profile.id).order('name'),
      loadManagedExpenses(profile.id, profile.role),
    ]);
    setProperties((props as Property[]) || []);
    setExpenses((expenseResult.data as typeof expenses) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [profile]);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <DashboardLayout navItems={ownerNav} title="Expenses">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-600">Portfolio operations</p>
          <h2 className="mt-1 text-2xl font-bold text-ink-900">Property Expenses</h2>
          <p className="mt-1 text-sm text-ink-500">Record and review operating costs from the same property records used by tax and reports.</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary"><Plus className="w-4 h-4" /> Record Expense</button>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3"><StatCard label="Total Expenses" value={formatKES(total)} icon={<Receipt className="h-5 w-5" />} accent="red" /><StatCard label="Expense Records" value={expenses.length} icon={<FileText className="h-5 w-5" />} /><StatCard label="Properties With Costs" value={new Set(expenses.map((e) => e.property_id)).size} icon={<Building2 className="h-5 w-5" />} accent="accent" /></div>

      {loading ? <LoadingPage /> : expenses.length === 0 ? (
        <EmptyState icon={<Receipt className="w-8 h-8" />} title="No expenses recorded" description="Track property expenses for tax deduction purposes." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="premium-table w-full min-w-[820px] text-sm">
              <thead><tr><th>Property</th><th>Category</th><th>Amount</th><th>Date</th><th>Vendor</th><th>Method</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-ink-50">
                    <td className="px-4 py-3 font-medium text-ink-900">{e.properties?.name}</td>
                    <td className="px-4 py-3">{e.category}</td>
                    <td className="px-4 py-3 font-semibold">{formatKES(e.amount)}</td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3 text-ink-500">{e.vendor || '—'}</td>
                    <td className="px-4 py-3 capitalize">{e.payment_method || 'cash'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && <AddExpenseModal properties={properties} onClose={() => setShowAdd(false)} onSuccess={(expense) => { const property = properties.find((item) => item.id === expense.property_id); setExpenses((current) => [{ ...expense, properties: { name: property?.name || 'Property' } }, ...current]); setShowAdd(false); void load(); }} />}
    </DashboardLayout>
  );
}

function AddExpenseModal({ properties, onClose, onSuccess }: { properties: Property[]; onClose: () => void; onSuccess: (expense: Expense) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ property_id: properties[0]?.id || '', category: 'Repairs', amount: '', expense_date: new Date().toISOString().split('T')[0], vendor: '', description: '', payment_method: 'cash' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.property_id || !Number.isFinite(amount) || amount <= 0) { toast('Select a property and enter an expense amount greater than zero.', 'error'); return; }
    setLoading(true);
    const { data, error } = await supabase.rpc('create_owner_expense', { p_property_id: form.property_id, p_category: form.category, p_amount: amount, p_expense_date: form.expense_date, p_vendor: form.vendor || null, p_description: form.description || null, p_payment_method: form.payment_method });
    setLoading(false);
    if (error) { toast(`Could not record expense: ${error.message}`, 'error'); return; }
    let saved = data as Expense | null;
    if (!saved) {
      const fallback = await supabase.from('expenses').select('*').eq('property_id', form.property_id).eq('amount', amount).eq('expense_date', form.expense_date).order('created_at', { ascending: false }).limit(1).maybeSingle();
      saved = (fallback.data as Expense | null) ?? null;
    }
    if (!saved) { toast('The expense could not be confirmed in the ledger. Please refresh and check before submitting it again.', 'error'); return; }
    toast('Expense recorded and added to the ledger.', 'success');
    onSuccess(saved);
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
        <div><label className="label">Payment Method</label><select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}><option value="cash">Cash</option><option value="mpesa">M-Pesa</option><option value="bank_transfer">Bank Transfer</option><option value="card">Card</option><option value="other">Other</option></select></div>
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

  const load = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    const result = await loadManagedMaintenance(profile.id, profile.role);
    setRequests((result.data as typeof requests) || []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { void load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.rpc('update_maintenance_status_by_manager', { p_request_id: id, p_status: status });
    if (error) { toast(error.message, 'error'); return; }
    toast(`Request ${titleCase(status)}`, 'success');
    setRequests((current) => current.map((r) => r.id === id ? { ...r, status: status as MaintenanceRequest['status'] } : r));
  };

  return (
    <DashboardLayout navItems={ownerNav} title="Maintenance">
      <div className="mb-6 rounded-2xl brand-gradient p-6 text-white shadow-soft-lg"><p className="text-sm font-semibold text-white/75">Property service desk</p><h2 className="mt-1 text-2xl font-bold">Maintenance & service requests</h2><p className="mt-1 max-w-2xl text-sm text-white/80">Every tenant-reported issue is tied to its property and unit. Update the status here and the tenant is notified.</p></div>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4"><StatCard label="All Requests" value={requests.length} icon={<Wrench className="h-5 w-5" />} /><StatCard label="Open" value={requests.filter((r) => !['completed','closed'].includes(r.status)).length} icon={<Clock className="h-5 w-5" />} accent="accent" /><StatCard label="In Progress" value={requests.filter((r) => ['assigned','in_progress','awaiting_parts'].includes(r.status)).length} icon={<TrendingUp className="h-5 w-5" />} accent="blue" /><StatCard label="Completed" value={requests.filter((r) => ['completed','closed'].includes(r.status)).length} icon={<CheckCircle className="h-5 w-5" />} accent="brand" /></div>
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
  const [payments, setPayments] = useState<(Payment & { properties: { name: string } | null; property_units: { unit_number: string } | null; profiles: { full_name: string | null } | null })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data: props } = await supabase.from('properties').select('id').eq('owner_id', profile.id);
      const propIds = (props || []).map((p) => p.id);
      if (propIds.length === 0) { setLoading(false); return; }
      const { data } = await supabase.from('payments').select('*, properties(name), property_units(unit_number), profiles:user_id(full_name)').in('property_id', propIds).order('created_at', { ascending: false });
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
            <table className="premium-table w-full min-w-[980px] text-sm">
              <thead><tr><th>Tenant</th><th>Property / Unit</th><th className="px-4 py-3 font-medium">Type</th><th className="px-4 py-3 font-medium">Amount</th><th className="px-4 py-3 font-medium">Method</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Date</th><th className="px-4 py-3 font-medium">Receipt</th></tr>
              </thead>
              <tbody className="divide-y divide-ink-100">
                {payments.map((p) => (
                  <tr key={p.id} className="hover:bg-ink-50">
                    <td><p className="font-medium text-ink-900">{p.profiles?.full_name || 'Tenant'}</p></td><td><p className="font-medium text-ink-900">{p.properties?.name || '—'}</p><p className="text-xs text-ink-400">Unit {p.property_units?.unit_number || '—'}</p></td>
                    <td className="px-4 py-3 capitalize">{p.payment_type}</td>
                    <td className="px-4 py-3 font-semibold">{formatKES(p.amount)}</td>
                    <td className="px-4 py-3 capitalize">{p.payment_method}</td>
                    <td className="px-4 py-3"><Badge status={p.status} /></td>
                    <td className="px-4 py-3 text-ink-500">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3">{p.verified ? <button type="button" onClick={() => downloadPaymentReceiptPdf({ payment: p, propertyName: p.properties?.name || 'Property', unitNumber: p.property_units?.unit_number || null, tenantName: p.profiles?.full_name || 'Tenant' })} className="btn-secondary px-3 py-2 text-xs">Download</button> : <span className="text-xs text-ink-400">Awaiting verification</span>}</td>
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
  const { profile } = useAuth();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const download = (filename: string, content: string, mime = 'text/plain') => { const blob = new Blob([content], { type: `${mime};charset=utf-8` }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  const csv = (rows: string[][]) => rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const makePdf = (title: string, lines: string[]) => {
    const esc = (x: string) => x.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    const commands = [`BT /F1 16 Tf 50 760 Td (${esc(title)}) Tj /F1 9 Tf`, ...lines.slice(0, 40).map(x => `0 -16 Td (${esc(x).slice(0, 105)}) Tj`), 'ET'].join(' ');
    const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${commands.length} >>\nstream\n${commands}\nendstream`];
    let pdf = '%PDF-1.4\n'; const offsets = [0]; objects.forEach((obj, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`; }); const xref = pdf.length; pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`; for (let i = 1; i < offsets.length; i++) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`; pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; download(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`, pdf, 'application/pdf');
  };
  const generate = async (kind: string) => {
    if (!profile) return; setBusy(true);
    try {
      const { data: props } = await supabase.from('properties').select('id,name,property_type').eq('owner_id', profile.id);
      const ids = (props || []).map(p => p.id);
      const [{ data: units }, { data: payments }, { data: expenses }, { data: leases }] = await Promise.all([
        ids.length ? supabase.from('property_units').select('property_id,status,monthly_rent').in('property_id', ids) : Promise.resolve({ data: [] as Array<{ property_id: string; status: string; monthly_rent: number }> }),
        ids.length ? supabase.from('payments').select('property_id,amount,status,verified,payment_type,created_at').in('property_id', ids) : Promise.resolve({ data: [] as Array<{ property_id: string; amount: number; status: string; verified: boolean; payment_type: string; created_at: string }> }),
        ids.length ? supabase.from('expenses').select('property_id,category,amount,expense_date').in('property_id', ids) : Promise.resolve({ data: [] as Array<{ property_id: string; category: string; amount: number; expense_date: string }> }),
        ids.length ? supabase.from('leases').select('property_id,status,tenant_id').in('property_id', ids) : Promise.resolve({ data: [] as Array<{ property_id: string; status: string; tenant_id: string }> }),
      ]);
      const rows: string[][] = [['Property','Type','Units','Occupied','Vacant','Reserved','Active Tenants','Rent Collected','Expenses']];
      (props || []).forEach(p => { const us=(units||[]).filter(x=>x.property_id===p.id); const ps=(payments||[]).filter(x=>x.property_id===p.id && x.status==='successful' && x.verified); const es=(expenses||[]).filter(x=>x.property_id===p.id); rows.push([p.name,p.property_type,String(us.length),String(us.filter(x=>x.status==='occupied').length),String(us.filter(x=>x.status==='available').length),String(us.filter(x=>x.status==='reserved').length),String((leases||[]).filter(x=>x.property_id===p.id && x.status==='active').length),String(ps.reduce((a,x)=>a+Number(x.amount||0),0)),String(es.reduce((a,x)=>a+Number(x.amount||0),0))]); });
      const names: Record<string,string> = { income:'Rental Income Report', expense:'Expense Report', occupancy:'Occupancy Report', tax:'Tax & Compliance Report', reservation:'Reservation Report', tenant:'Tenant Report' }; const title=names[kind] || 'Portfolio Report'; const lines=rows.map(r=>r.join(' | ')); download(`${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.csv`, csv(rows), 'text/csv'); makePdf(title, lines); toast(`${title} downloaded as CSV and PDF.`, 'success');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not generate report.', 'error'); } finally { setBusy(false); }
  };
  const reports: Array<[string,string,string,typeof Wallet]> = [['income','Rental Income Report','Monthly rental income breakdown',Wallet],['expense','Expense Report','Property expenses by category',Receipt],['occupancy','Occupancy Report','Unit occupancy and vacancy rates',Building2],['tax','Tax Report','Tax calculations and compliance records',TrendingUp],['reservation','Reservation Report','Reservation activity and conversion',Calendar],['tenant','Tenant Report','Active tenants and lease status',Users]];
  return <DashboardLayout navItems={ownerNav} title="Reports"><div className="mb-6 rounded-2xl brand-gold-gradient p-6 text-white shadow-soft-lg"><p className="text-sm font-semibold text-white/90">Reporting centre</p><h2 className="mt-1 text-2xl font-bold text-white">Portfolio reports</h2><p className="mt-1 max-w-2xl text-sm text-white/90">Generate downloadable operational and financial reports from your live portfolio data.</p></div><div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{reports.map(([kind,title,desc,Icon])=><Card key={kind} className="p-5"><div className="mb-4 flex items-start justify-between"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon className="h-5 w-5"/></div><span className="badge bg-ink-50 text-ink-500">Live data</span></div><h3 className="font-semibold text-ink-900">{title}</h3><p className="mt-1 min-h-10 text-sm text-ink-500">{desc}</p><button disabled={busy} onClick={()=>generate(kind)} className="btn-primary mt-4 w-full"><Download className="h-4 w-4"/>{busy?'Generating…':'Download CSV + PDF'}</button></Card>)}</div></DashboardLayout>;
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
