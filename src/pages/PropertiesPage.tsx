import { useEffect, useMemo, useState } from 'react';
import { Building2, MapPin, Search, ShieldCheck, SlidersHorizontal, Tag, X } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';
import { supabase } from '@/lib/supabase';
import { formatKES, KENYAN_COUNTIES, ASSET_CLASS_OPTIONS, OPERATION_MODEL_OPTIONS } from '@/lib/constants';
import { EmptyState, SkeletonCard } from '@/components/ui';
import { getPropertyImage } from '@/lib/images';
import { getPropertyPresentation } from '@/lib/propertyPresentation';

type UniversalProperty = {
  property_id: string; name: string; description: string | null; property_type: string; asset_class: string; operation_model: string;
  ownership_type: string | null; title_number: string | null; parcel_number: string | null; total_land_area: number | null; land_area_unit: string | null; plot_count: number | null; plot_dimensions: string | null;
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
  const [category, setCategory] = useState(params.get('category') || '');
  const [assetClass, setAssetClass] = useState(params.get('asset_class') || '');
  const [operation, setOperation] = useState(params.get('operation') || '');
  const [location, setLocation] = useState(params.get('location') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [sort, setSort] = useState('featured');
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    setQuery(params.get('q') || '');
    setCategory(params.get('category') || '');
    setAssetClass(params.get('asset_class') || '');
    setOperation(params.get('operation') || '');
    setLocation(params.get('location') || '');
  }, [params]);

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('highpark_recently_viewed') || '[]');
      if (Array.isArray(saved)) setRecentIds(saved.filter((id): id is string => typeof id === 'string'));
    } catch {
      setRecentIds([]);
    }
  }, []);

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
      const normalizedType = String(r.property_type || '').toLowerCase();
      const categoryMatch = !category ||
        (category === 'rent' && ['long_term_rental', 'lease', 'mixed'].includes(r.operation_model)) ||
        (category === 'buy' && (['sale', 'land_sale'].includes(r.operation_model) || r.sale_listing_count > 0)) ||
        (category === 'land' && (r.asset_class === 'land' || r.operation_model === 'land_sale' || /land|plot|acre|parcel|acreage|ranch|farm/.test(normalizedType))) ||
        (category === 'short_stay' && (r.operation_model === 'short_stay' || r.short_stay_listing_count > 0));
      return (!q || text.includes(q)) && categoryMatch && (!assetClass || r.asset_class === assetClass) && (!operation || r.operation_model === operation) && (!location || r.county === location || r.town === location);
    });
  }, [rows, query, category, assetClass, operation, location]);

  const hasFilters = Boolean(query || category || assetClass || operation || location);
  const categoryMeta: Record<string, { eyebrow: string; title: string; description: string }> = {
    buy: { eyebrow: 'Buy with confidence', title: 'Properties and land for purchase', description: 'Review verified sale opportunities with location and pricing information.' },
    rent: { eyebrow: 'Rent with clarity', title: 'Homes and commercial spaces for rent', description: 'Explore long-term rental opportunities with clear availability and rental information.' },
    land: { eyebrow: 'Land & Plots', title: 'Land and plots for your next move', description: 'Compare land opportunities by location, acreage, plot count and dimensions.' },
    short_stay: { eyebrow: 'Short stays', title: 'Comfortable stays, ready when you are', description: 'Discover short-stay accommodation and enquire about availability and rates.' },
    '': { eyebrow: 'Marketplace', title: 'Property opportunities, all in one place', description: 'Explore verified homes, commercial spaces, land and short stays.' },
  };
  const meta = categoryMeta[category] || categoryMeta[''];

  const clear = () => { setQuery(''); setCategory(''); setAssetClass(''); setOperation(''); setLocation(''); setSort('featured'); };
  const selectCategory = (value: string) => {
    const target = value ? `/properties?category=${value}` : '/properties';
    window.location.hash = `#${target}`;
  };
  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    if (sort === 'newest') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (sort === 'price_low') {
      const pa = a.min_monthly_rent ?? a.sale_min_price ?? a.short_stay_min_rate ?? Number.MAX_SAFE_INTEGER;
      const pb = b.min_monthly_rent ?? b.sale_min_price ?? b.short_stay_min_rate ?? Number.MAX_SAFE_INTEGER;
      return Number(pa) - Number(pb);
    }
    if (sort === 'price_high') {
      const pa = a.min_monthly_rent ?? a.sale_min_price ?? a.short_stay_min_rate ?? 0;
      const pb = b.min_monthly_rent ?? b.sale_min_price ?? b.short_stay_min_rate ?? 0;
      return Number(pb) - Number(pa);
    }
    return 0;
  }), [filtered, sort]);

  return (
    <div style={{ background: '#ffffff' }}>
      <div className="container-main" style={{ paddingTop: '24px', paddingBottom: '24px' }}>
        {/* Header — solid, minimal */}
        <div className="card" style={{ padding: '24px', background: '#0d2342', border: '1px solid #0d2342' }}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div style={{ maxWidth: '640px' }}>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#c9972e' }}>{meta.eyebrow}</p>
              <h1 className="mt-2" style={{ color: '#ffffff' }}>{meta.title}</h1>
              <p className="mt-3 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.8)' }}>{meta.description}</p>
            </div>
            <Link to="/register" className="btn-accent shrink-0">Get started</Link>
          </div>
        </div>

        {/* Filters — mobile-first, single column on mobile */}
        <div className="card mt-6" style={{ padding: '1rem' }}>
          <div className="flex flex-wrap gap-2 border-b border-ink-100 pb-3">
            {[['', 'All'], ['buy', 'Buy'], ['rent', 'Rent'], ['land', 'Land & Plots'], ['short_stay', 'Short Stays']].map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => selectCategory(value)}
                className={`${category === value ? 'btn-primary' : 'btn-secondary'}`}
                style={{ minHeight: '36px', padding: '0.5rem 1rem', fontSize: '0.8125rem' }}
              >
                {text}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 pt-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by property, location or opportunity…" />
            </div>
            <button type="button" className="btn-secondary lg:hidden" onClick={() => setShowFilters(!showFilters)} style={{ justifyContent: 'center' }}>
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </button>
            <div className={`${showFilters ? 'grid' : 'hidden'} grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:flex-1`}>
              <select className="input lg:w-44" value={assetClass} onChange={(e) => setAssetClass(e.target.value)}>
                <option value="">All asset classes</option>
                {ASSET_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="input lg:w-44" value={operation} onChange={(e) => setOperation(e.target.value)}>
                <option value="">All opportunities</option>
                {OPERATION_MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="input lg:w-40" value={location} onChange={(e) => setLocation(e.target.value)}>
                <option value="">All counties</option>
                {KENYAN_COUNTIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            {hasFilters && (
              <button type="button" className="btn-ghost" onClick={clear} style={{ minHeight: '44px' }}>
                <X className="h-4 w-4" /> Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#c9972e' }}>Current opportunities</p>
            <h2 className="mt-1">Available listings</h2>
            <p className="mt-1 text-sm text-ink-500">{loading ? 'Loading verified opportunities…' : `${filtered.length} opportunities available`}</p>
          </div>
          <select className="input w-full sm:w-48" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort opportunities">
            <option value="featured">Featured</option>
            <option value="newest">Newest</option>
            <option value="price_low">Price: low to high</option>
            <option value="price_high">Price: high to low</option>
          </select>
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : sorted.length === 0 ? (
          <div className="mt-6">
            <EmptyState icon={<Building2 className="h-8 w-8" />} title="No matching opportunities" description="Try another location, asset class or operating model." action={<button type="button" className="btn-primary" onClick={clear}>View all opportunities</button>} />
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((r) => {
              const image = r.photos?.[0] || getPropertyImage(r.property_type);
              const view = getPropertyPresentation(r.asset_class, r.operation_model, r.property_type);
              const isLand = view.kind === 'land';
              const isStay = r.short_stay_listing_count > 0 || r.operation_model === 'short_stay';
              const isSale = r.sale_listing_count > 0 || ['sale', 'land_sale'].includes(r.operation_model);
              return (
                <Link key={r.property_id} to={`/property/${r.property_id}`} className="card group overflow-hidden" style={{ padding: 0, borderRadius: '4px' }}>
                  <div className="relative overflow-hidden bg-ink-100" style={{ aspectRatio: '16 / 9' }}>
                    <img src={image} alt={r.name} className="h-full w-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.02]" loading="lazy" decoding="async" />
                    <div className="absolute left-2 top-2 flex flex-wrap gap-1">
                      <span className="badge badge-brand">Verified</span>
                      {isSale && <span className="badge badge-accent">For sale</span>}
                      {isStay && <span className="badge">Short stay</span>}
                    </div>
                  </div>
                  <div style={{ padding: '1rem' }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{r.name}</h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500"><MapPin className="h-3.5 w-3.5" /> {r.town}, {r.county}</p>
                      </div>
                      <Tag className="h-4 w-4 shrink-0 text-ink-400" />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      <span className="badge">{r.property_type}</span>
                      <span className="badge">{view.label}</span>
                      {r.ownership_type && <span className="badge">{label(r.ownership_type)}</span>}
                      {isLand && r.total_land_area && <span className="badge">{r.total_land_area} {r.land_area_unit || 'acres'}</span>}
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-3 border-t border-ink-100 pt-3">
                      {isLand ? (
                        <>
                          <div><p className="text-[11px] uppercase tracking-wide text-ink-400">Plots</p><p className="font-bold text-brand-900">{r.plot_count || 0}</p></div>
                          <div className="text-right"><p className="text-[11px] uppercase tracking-wide text-ink-400">Dimensions</p><p className="truncate font-semibold text-ink-800">{r.plot_dimensions || 'On enquiry'}</p></div>
                        </>
                      ) : r.min_monthly_rent ? (
                        <div><p className="text-[11px] uppercase tracking-wide text-ink-400">From / month</p><p className="font-bold text-brand-900">{formatKES(Number(r.min_monthly_rent))}</p></div>
                      ) : r.sale_min_price ? (
                        <div><p className="text-[11px] uppercase tracking-wide text-ink-400">Asking from</p><p className="font-bold text-brand-900">{formatKES(Number(r.sale_min_price))}</p></div>
                      ) : r.short_stay_min_rate ? (
                        <div><p className="text-[11px] uppercase tracking-wide text-ink-400">From / night</p><p className="font-bold text-brand-900">{formatKES(Number(r.short_stay_min_rate))}</p></div>
                      ) : (
                        <div><p className="text-[11px] uppercase tracking-wide text-ink-400">Opportunity</p><p className="font-bold text-brand-900">Enquire</p></div>
                      )}
                      {isLand ? (
                        <div className="text-right"><p className="text-[11px] uppercase tracking-wide text-ink-400">Land reference</p><p className="truncate font-semibold text-ink-800">{r.parcel_number || r.title_number || 'Not provided'}</p></div>
                      ) : (
                        <div className="text-right">
                          {r.available_units > 0 ? (
                            <>
                              <p className="text-[11px] uppercase tracking-wide text-ink-400">{view.availableLabel}</p>
                              <p className="font-semibold text-ink-800">{r.available_units} available</p>
                            </>
                          ) : (
                            <>
                              <p className="text-[11px] uppercase tracking-wide text-ink-400">Operating model</p>
                              <p className="font-semibold text-ink-800">{label(r.operation_model)}</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!loading && recentIds.length > 0 && (
          <section className="mt-12 border-t border-ink-100 pt-8" aria-labelledby="recently-viewed-heading">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#c9972e' }}>Continue browsing</p>
                <h2 id="recently-viewed-heading" className="mt-1">Recently viewed</h2>
                <p className="mt-1 text-sm text-ink-500">Return to opportunities you have already inspected.</p>
              </div>
              <button type="button" onClick={() => { localStorage.removeItem('highpark_recently_viewed'); setRecentIds([]); }} className="btn-ghost text-xs">Clear history</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentIds.map((id) => rows.find((r) => String(r.property_id) === id)).filter(Boolean).slice(0, 3).map((r) => {
                const row = r as UniversalProperty;
                const image = row.photos?.[0] || getPropertyImage(row.property_type);
                return (
                  <Link key={row.property_id} to={`/property/${row.property_id}`} className="card flex overflow-hidden group" style={{ padding: 0 }}>
                    <img src={image} alt="" className="h-24 w-28 shrink-0 object-cover" loading="lazy" decoding="async" />
                    <div className="min-w-0 p-3">
                      <p className="truncate font-semibold group-hover:text-brand-900">{row.name}</p>
                      <p className="mt-1 truncate text-xs text-ink-500">{row.town}, {row.county}</p>
                      <p className="mt-2 text-xs font-bold" style={{ color: '#0d2342' }}>View opportunity</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
