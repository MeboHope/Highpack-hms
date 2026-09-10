import { useEffect, useState } from 'react';
import { Building2, LandPlot, Search, RefreshCw, Save, Hotel, MapPin, Tag, BriefcaseBusiness } from 'lucide-react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { adminNav, ownerNav } from '@/components/dashboardNav';
import { Card, EmptyState, LoadingPage, Pagination, StatCard, Badge } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/context/hooks';
import { useAuth } from '@/context/hooks';
import { titleCase } from '@/lib/constants';
import { DonutChart } from '@/components/AnalyticsCharts';
import { getPropertyPresentation } from '@/lib/propertyPresentation';

type AssetClass = 'built_property' | 'land' | 'mixed_use' | 'development_project' | 'other';
type OperationModel = 'long_term_rental' | 'short_stay' | 'sale' | 'lease' | 'land_sale' | 'mixed';
type PropertyRow = {
  id: string;
  name: string;
  property_type: string;
  town: string;
  county: string;
  asset_class: AssetClass;
  operation_model: OperationModel;
  ownership_type: string | null;
  title_number: string | null;
  parcel_number: string | null;
  total_land_area: number | null;
  land_area_unit: string | null;
  zoning: string | null;
  year_built: number | null;
  status: string;
};

const assetOptions: Array<{ value: AssetClass; label: string }> = [
  { value: 'built_property', label: 'Built property' },
  { value: 'land', label: 'Land / plot' },
  { value: 'mixed_use', label: 'Mixed-use' },
  { value: 'development_project', label: 'Development project' },
  { value: 'other', label: 'Other asset' },
];
const operationOptions: Array<{ value: OperationModel; label: string }> = [
  { value: 'long_term_rental', label: 'Long-term rental' },
  { value: 'short_stay', label: 'Short-stay / Airbnb' },
  { value: 'sale', label: 'Sale' },
  { value: 'lease', label: 'Lease / letting' },
  { value: 'land_sale', label: 'Land sale' },
  { value: 'mixed', label: 'Mixed model' },
];

function PortfolioPage({ ownerOnly = false }: { ownerOnly?: boolean }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [rows, setRows] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [assetClass, setAssetClass] = useState('all');
  const [operationModel, setOperationModel] = useState('all');
  const [selected, setSelected] = useState<PropertyRow | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const from = (page - 1) * 20;
    const to = from + 19;
    let q = supabase.from('properties').select('id,name,property_type,town,county,asset_class,operation_model,ownership_type,title_number,parcel_number,total_land_area,land_area_unit,zoning,year_built,status', { count: 'exact' });
    if (ownerOnly && profile?.id) q = q.eq('owner_id', profile.id);
    if (assetClass !== 'all') q = q.eq('asset_class', assetClass);
    if (operationModel !== 'all') q = q.eq('operation_model', operationModel);
    if (query.trim()) {
      const s = query.trim();
      q = q.or(`name.ilike.%${s}%,town.ilike.%${s}%,county.ilike.%${s}%,property_type.ilike.%${s}%,title_number.ilike.%${s}%,parcel_number.ilike.%${s}%`);
    }
    const { data, count, error } = await q.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, to);
    if (error) toast(`Could not load portfolio: ${error.message}`, 'error');
    setRows((data as PropertyRow[]) || []);
    setTotal(count || 0);
    setLoading(false);
  };

  useEffect(() => { setPage(1); }, [query, assetClass, operationModel]);
  useEffect(() => { void load(); }, [page, query, assetClass, operationModel, ownerOnly, profile?.id]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    const payload = {
      asset_class: selected.asset_class,
      operation_model: selected.operation_model,
      ownership_type: selected.ownership_type || null,
      title_number: selected.title_number || null,
      parcel_number: selected.parcel_number || null,
      total_land_area: selected.total_land_area === null || Number.isNaN(Number(selected.total_land_area)) ? null : Number(selected.total_land_area),
      land_area_unit: selected.land_area_unit || 'acres',
      zoning: selected.zoning || null,
      year_built: selected.year_built === null || Number.isNaN(Number(selected.year_built)) ? null : Number(selected.year_built),
    };
    const { error } = await supabase.from('properties').update(payload).eq('id', selected.id);
    setSaving(false);
    if (error) { toast(`Could not save asset profile: ${error.message}`, 'error'); return; }
    setRows((current) => current.map((r) => r.id === selected.id ? { ...r, ...payload } : r));
    setSelected(null);
    toast('Asset profile updated', 'success');
  };

  const built = rows.filter((r) => r.asset_class === 'built_property').length;
  const land = rows.filter((r) => r.asset_class === 'land').length;
  const shortStay = rows.filter((r) => r.operation_model === 'short_stay').length;
  const sale = rows.filter((r) => ['sale', 'land_sale'].includes(r.operation_model)).length;
  const nav = ownerOnly ? ownerNav : adminNav;

  if (loading && rows.length === 0) return <DashboardLayout navItems={nav} title="Portfolio & Assets"><LoadingPage /></DashboardLayout>;
  return (
    <DashboardLayout navItems={nav} title="Portfolio & Assets">
      <div className="mb-7 rounded-2xl brand-gradient p-6 text-white shadow-soft-lg">
        <p className="text-sm font-semibold text-white/90">Universal real-estate portfolio</p>
        <h2 className="mt-1 text-2xl font-bold text-white">Portfolio & asset classification</h2>
        <p className="mt-2 max-w-3xl text-sm font-medium text-white/90">Manage houses, apartments, commercial buildings, land, plots, mixed-use developments and short-stay properties from the same portfolio model.</p>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Portfolio records" value={total} icon={<BriefcaseBusiness className="h-5 w-5" />} />
        <StatCard label="Built properties · page" value={built} icon={<Building2 className="h-5 w-5" />} accent="blue" />
        <StatCard label="Land / plots · page" value={land} icon={<LandPlot className="h-5 w-5" />} accent="accent" />
        <StatCard label="Short-stay · page" value={shortStay} icon={<Hotel className="h-5 w-5" />} accent="red" />
      </div>      <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <DonutChart segments={[{ label: 'Built property', value: built }, { label: 'Land / plots', value: land }, { label: 'Short-stay', value: shortStay }, { label: 'Sales-oriented', value: sale }]} centerLabel="This page" centerValue={String(rows.length)} />
        <Card className="p-5"><div className="mb-4"><p className="chart-kicker">Portfolio pulse</p><p className="chart-caption">Current page inventory signals</p></div><div className="space-y-4">{[['Built properties',built],['Land / plots',land],['Short-stay',shortStay],['Sale-oriented',sale]].map(([label,value])=><div key={String(label)}><div className="mb-1 flex justify-between text-xs"><span className="font-semibold text-ink-700">{label}</span><span className="text-ink-400">{value}</span></div><div className="h-2 rounded-full bg-ink-100"><div className="chart-progress-bar h-2 rounded-full bg-brand-600" style={{width:`${rows.length ? Math.min(100, Number(value)/rows.length*100) : 0}%`}} /></div></div>)}</div></Card>
      </div>

      <Card className="mb-5 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" placeholder="Search property, location, title or parcel number…" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
          <select className="input lg:w-56" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}><option value="all">All asset classes</option>{assetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          <select className="input lg:w-56" value={operationModel} onChange={(e) => setOperationModel(e.target.value)}><option value="all">All operating models</option>{operationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
          <button type="button" className="btn-secondary" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Refresh</button>
        </div>
      </Card>
      {rows.length === 0 ? <Card><EmptyState icon={<BriefcaseBusiness className="h-8 w-8" />} title="No matching assets" description="Add or update properties from the property registry, then classify them here." /></Card> : (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 px-5 py-4"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold text-ink-900">Universal asset register</h3><p className="text-xs text-ink-500">{total} record{total === 1 ? '' : 's'} · page-by-page</p></div><span className="badge bg-brand-50 text-brand-700">{sale} sale-oriented on this page</span></div></div>
          <div className="overflow-x-auto"><table className="premium-table w-full min-w-[1050px] text-sm"><thead><tr><th>Asset</th><th>Class</th><th>Operating model</th><th>Location</th><th>Land / title</th><th>Status</th><th>Action</th></tr></thead><tbody>
            {rows.map((r) => <tr key={r.id}>
              <td><p className="font-semibold text-ink-900">{r.name}</p><p className="text-xs text-ink-400">{r.property_type}</p></td>
              <td><Badge>{titleCase(r.asset_class)}</Badge></td>
              <td><Badge>{titleCase(r.operation_model)}</Badge></td>
              <td><div className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-ink-400" />{r.town}, {r.county}</div></td>
              <td>{(() => { const view = getPropertyPresentation(r.asset_class, r.operation_model, r.property_type); return view.kind === 'land' || view.kind === 'development' ? <><p>{r.total_land_area ? `${r.total_land_area} ${r.land_area_unit || 'acres'}` : '—'}</p><p className="text-xs text-ink-400">{r.title_number || r.parcel_number || r.zoning || 'No land reference'}</p></> : <><p>{view.kind === 'short_stay' ? 'Hospitality' : view.kind === 'sale' ? 'Sale asset' : `${r.year_built || '—'}${r.year_built ? ' build year' : ''}`}</p><p className="text-xs text-ink-400">{r.ownership_type || 'Ownership not specified'}</p></>; })()}</td>
              <td><Badge status={r.status}>{titleCase(r.status)}</Badge></td>
              <td><button type="button" className="icon-action" title="Configure asset" onClick={() => setSelected({ ...r })}><Tag className="h-4 w-4" /></button></td>
            </tr>)}
          </tbody></table></div>
        </Card>
      )}
      <Pagination page={page} totalPages={Math.max(1, Math.ceil(total / 20))} totalItems={total} pageSize={20} onPageChange={setPage} />
      {selected && <div className="fixed inset-0 z-[80] flex items-center justify-center p-4"><div className="absolute inset-0 bg-ink-950/50" onClick={() => setSelected(null)} /><div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-brand-700">Asset profile</p><h3 className="text-xl font-bold text-ink-900">{selected.name}</h3><p className="text-sm text-ink-500">Classify the asset now; detailed land and short-stay operations build on this foundation.</p></div><button className="btn-secondary" onClick={() => setSelected(null)}>Close</button></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="field"><span className="field-label">Asset class</span><select className="input" value={selected.asset_class} onChange={(e) => setSelected({ ...selected, asset_class: e.target.value as AssetClass })}>{assetOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Operating model</span><select className="input" value={selected.operation_model} onChange={(e) => setSelected({ ...selected, operation_model: e.target.value as OperationModel })}>{operationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></label>
          <label className="field"><span className="field-label">Ownership / tenure</span><input className="input" value={selected.ownership_type || ''} onChange={(e) => setSelected({ ...selected, ownership_type: e.target.value })} placeholder="Freehold, leasehold, sectional title…" /></label>
          <label className="field"><span className="field-label">Title number</span><input className="input" value={selected.title_number || ''} onChange={(e) => setSelected({ ...selected, title_number: e.target.value })} /></label>
          <label className="field"><span className="field-label">Parcel / plot number</span><input className="input" value={selected.parcel_number || ''} onChange={(e) => setSelected({ ...selected, parcel_number: e.target.value })} /></label>
          <label className="field"><span className="field-label">Total land area</span><input type="number" min="0" step="0.01" className="input" value={selected.total_land_area ?? ''} onChange={(e) => setSelected({ ...selected, total_land_area: e.target.value === '' ? null : Number(e.target.value) })} /></label>
          <label className="field"><span className="field-label">Area unit</span><select className="input" value={selected.land_area_unit || 'acres'} onChange={(e) => setSelected({ ...selected, land_area_unit: e.target.value })}><option value="acres">Acres</option><option value="hectares">Hectares</option><option value="square_metres">Square metres</option><option value="square_feet">Square feet</option></select></label>
          <label className="field"><span className="field-label">Zoning / permitted use</span><input className="input" value={selected.zoning || ''} onChange={(e) => setSelected({ ...selected, zoning: e.target.value })} placeholder="Residential, commercial, agricultural…" /></label>
          <label className="field"><span className="field-label">Year built</span><input type="number" min="1800" max="2200" className="input" value={selected.year_built ?? ''} onChange={(e) => setSelected({ ...selected, year_built: e.target.value === '' ? null : Number(e.target.value) })} /></label>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setSelected(null)}>Cancel</button><button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}><Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save asset profile'}</button></div>
      </div></div>}
    </DashboardLayout>
  );
}

export function AdminPortfolio() { return <PortfolioPage />; }
export function OwnerPortfolio() { return <PortfolioPage ownerOnly />; }
