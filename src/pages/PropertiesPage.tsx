import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Building2, MapPin, Search, ShieldCheck, SlidersHorizontal, Tag } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';
import { supabase } from '@/lib/supabase';
import { formatKES, KENYAN_COUNTIES, ASSET_CLASS_OPTIONS, OPERATION_MODEL_OPTIONS } from '@/lib/constants';
import { EmptyState, SkeletonCard } from '@/components/ui';
import { getPropertyImage } from '@/lib/images';

type UniversalProperty = {
  property_id: string; name: string; description: string | null; property_type: string; asset_class: string; operation_model: string;
  ownership_type: string | null; title_number: string | null; parcel_number: string | null; total_land_area: number | null; land_area_unit: string | null;
  zoning: string | null; year_built: number | null; county: string; sub_county: string | null; town: string; estate: string | null; street: string | null;
  address: string | null; number_of_units: number; number_of_floors: number; amenities: string[]; parking: boolean; water_availability: boolean;
  electricity: boolean; internet: boolean; pets_allowed: boolean; photos: string[]; created_at: string; available_units: number; min_monthly_rent: number | null;
  sale_listing_count: number; sale_min_price: number | null; short_stay_listing_count: number; short_stay_min_rate: number | null;
};

const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (x) => x.toUpperCase());

export function PropertiesPage() {
  const { path } = useRouter();
  const params = useMemo(() => new URLSearchParams(path.split('?')[1] || ''), [path]);
  const [rows, setRows] = useState<UniversalProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(params.get('q') || '');
  const [assetClass, setAssetClass] = useState(params.get('asset_class') || '');
  const [operation, setOperation] = useState(params.get('operation') || '');
  const [location, setLocation] = useState(params.get('location') || '');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_public_universal_catalog');
      if (error) console.error('Universal public catalog error:', error);
      if (!cancelled) { setRows((data as UniversalProperty[]) || []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const text = [r.name, r.description, r.property_type, r.town, r.county, r.estate, r.title_number, r.parcel_number, r.zoning].filter(Boolean).join(' ').toLowerCase();
      return (!q || text.includes(q)) && (!assetClass || r.asset_class === assetClass) && (!operation || r.operation_model === operation) && (!location || r.county === location || r.town === location);
    });
  }, [rows, query, assetClass, operation, location]);

  const hasFilters = Boolean(query || assetClass || operation || location);
  const clear = () => { setQuery(''); setAssetClass(''); setOperation(''); setLocation(''); };

  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <div className="mb-7 rounded-3xl brand-gradient p-7 text-white shadow-soft-lg sm:p-9">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.15em] text-accent-100"><ShieldCheck className="h-4 w-4" /> Verified real-estate opportunities</div><h1 className="text-3xl font-bold sm:text-4xl">Properties, land, developments & stays</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">Explore verified homes and apartments, commercial spaces, land and plots, development projects, sale opportunities and short-stay properties across Kenya.</p></div><Link to="/register" className="btn-accent shrink-0"><ArrowRight className="h-4 w-4" /> Get started</Link></div>
    </div>

    <div className="mb-7 rounded-2xl border border-ink-100 bg-white p-4 shadow-sm"><div className="flex flex-col gap-3 lg:flex-row"><div className="relative flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" /><input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search properties, land, plots, offices, developments or stays…" /></div><button type="button" className="btn-secondary lg:hidden" onClick={() => setShowFilters(!showFilters)}><SlidersHorizontal className="h-4 w-4" /> Filters</button><div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:flex-1`}><select className="input lg:w-52" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}><option value="">All asset classes</option>{ASSET_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><select className="input lg:w-52" value={operation} onChange={(e) => setOperation(e.target.value)}><option value="">All opportunities</option>{OPERATION_MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select><select className="input lg:w-44" value={location} onChange={(e) => setLocation(e.target.value)}><option value="">All counties</option>{KENYAN_COUNTIES.map((c) => <option key={c}>{c}</option>)}</select></div>{hasFilters && <button type="button" className="btn-ghost" onClick={clear}>Clear</button>}</div></div>

    <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold text-ink-900">Marketplace</h2><p className="text-sm text-ink-500">{loading ? 'Loading verified opportunities…' : `${filtered.length} opportunity${filtered.length === 1 ? '' : 'ies'} available`}</p></div><span className="badge bg-brand-50 text-brand-700">Universal catalogue</span></div>

    {loading ? <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({length:6}).map((_,i)=><SkeletonCard key={i}/>)}</div> : filtered.length === 0 ? <EmptyState icon={<Building2 className="h-8 w-8" />} title="No matching opportunities" description="Try another location, asset class or operating model." action={<button type="button" className="btn-primary" onClick={clear}>View all opportunities</button>} /> : <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((r) => {
      const image = r.photos?.[0] || getPropertyImage(r.property_type);
      const isLand = r.asset_class === 'land'; const isStay = r.short_stay_listing_count > 0 || r.operation_model === 'short_stay'; const isSale = r.sale_listing_count > 0 || ['sale','land_sale'].includes(r.operation_model);
      return <Link key={r.property_id} to={`/property/${r.property_id}`} className="group overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-soft-lg">
        <div className="relative h-52 overflow-hidden bg-ink-100"><img src={image} alt={r.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /><div className="absolute left-3 top-3 flex flex-wrap gap-1.5"><span className="badge bg-white/95 text-ink-800 shadow-sm">{label(r.asset_class)}</span>{isSale&&<span className="badge bg-accent-100 text-accent-800">For sale</span>}{isStay&&<span className="badge bg-brand-100 text-brand-800">Short stay</span>}</div></div>
        <div className="p-5"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold text-ink-900 group-hover:text-brand-700">{r.name}</h3><p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500"><MapPin className="h-3.5 w-3.5" /> {r.town}, {r.county}</p></div><Tag className="h-4 w-4 shrink-0 text-brand-500" /></div><div className="mt-4 flex flex-wrap gap-1.5"><span className="badge bg-ink-50 text-ink-600">{r.property_type}</span>{r.ownership_type&&<span className="badge bg-ink-50 text-ink-600">{label(r.ownership_type)}</span>}{isLand&&r.total_land_area&&<span className="badge bg-brand-50 text-brand-700">{r.total_land_area} {r.land_area_unit || 'acres'}</span>}</div><div className="mt-5 grid grid-cols-2 gap-3 border-t border-ink-100 pt-4">{r.min_monthly_rent ? <div><p className="text-[11px] uppercase tracking-wide text-ink-400">From / month</p><p className="font-bold text-brand-700">{formatKES(Number(r.min_monthly_rent))}</p></div> : r.sale_min_price ? <div><p className="text-[11px] uppercase tracking-wide text-ink-400">Asking from</p><p className="font-bold text-brand-700">{formatKES(Number(r.sale_min_price))}</p></div> : r.short_stay_min_rate ? <div><p className="text-[11px] uppercase tracking-wide text-ink-400">From / night</p><p className="font-bold text-brand-700">{formatKES(Number(r.short_stay_min_rate))}</p></div> : <div><p className="text-[11px] uppercase tracking-wide text-ink-400">Opportunity</p><p className="font-bold text-brand-700">Enquire</p></div>}<div className="text-right">{r.available_units>0?<><p className="text-[11px] uppercase tracking-wide text-ink-400">Availability</p><p className="font-semibold text-ink-800">{r.available_units} available</p></>:<><p className="text-[11px] uppercase tracking-wide text-ink-400">Use</p><p className="font-semibold text-ink-800">{label(r.operation_model)}</p></>}</div></div></div>
      </Link>;
    })}</div>}
  </div>;
}
