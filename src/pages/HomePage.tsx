import { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  ArrowRight,
  Star,
  ShieldCheck,
  Wallet,
  FileText,
  Home as HomeIcon,
  Building2,
} from 'lucide-react';

import { Link } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';
import { supabase } from '@/lib/supabase';
import {
  formatKES,
  KENYAN_COUNTIES,
  ASSET_CLASS_OPTIONS,
  OPERATION_MODEL_OPTIONS,
} from '@/lib/constants';
import { SkeletonCard } from '@/components/ui';
import { getPropertyImage } from '@/lib/images';
import { getPropertyPresentation } from '@/lib/propertyPresentation';

interface PropertyWithUnits {
  id: string; name: string; county: string; town: string; estate: string | null; property_type: string; asset_class: string; operation_model: string;
  ownership_type: string | null; title_number: string | null; parcel_number: string | null; total_land_area: number | null; land_area_unit: string | null; plot_count: number | null; plot_dimensions: string | null;
  photos: string[]; available_units: number; min_monthly_rent: number | null; sale_listing_count: number; sale_min_price: number | null;
  short_stay_listing_count: number; short_stay_min_rate: number | null;
}

interface Stat {
  label: string;
  value: number;
  suffix: string;
  prefix?: string;
}

function AnimatedStat({ value, suffix = '', prefix = '', label }: Stat) {
  const [count, setCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const statRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = statRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true);
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;
    const duration = 1200;
    const startTime = performance.now();
    let animationFrame: number;
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.floor(easedProgress * value);
      setCount(currentValue);
      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      } else {
        setCount(value);
      }
    };
    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [hasStarted, value]);

  return (
    <div ref={statRef} className="text-center">
      <p className="text-2xl font-bold tabular-nums" style={{ color: '#0d2342' }}>
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide" style={{ color: '#68758a' }}>
        {label}
      </p>
    </div>
  );
}

export function HomePage() {
  const { navigate } = useRouter();
  const [properties, setProperties] = useState<PropertyWithUnits[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stat[]>([
    { value: 0, suffix: '+', label: 'Verified Properties' },
    { value: 0, suffix: '+', label: 'Available Units' },
    { value: 0, suffix: '+', label: 'Counties' },
    { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation Hold' },
  ]);

  const [search, setSearch] = useState({
    location: '',
    assetClass: '',
    operation: '',
  });

  // Preload hero image for performance
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = '/hero-property-consulting.jpg';
    link.setAttribute('fetchpriority', 'high');
    document.head.appendChild(link);
    return () => {
      if (document.head.contains(link)) document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: catalog, error: catalogError }, { data: siteStats, error: statsError }] = await Promise.all([
        supabase.rpc('get_public_universal_catalog'),
        supabase.rpc('get_public_site_stats'),
      ]);
      if (catalogError) console.error('Home universal catalog load error:', catalogError);
      if (statsError) console.error('Home public statistics load error:', statsError);
      const rows = (catalog || []) as Array<Record<string, unknown>>;
      const props: PropertyWithUnits[] = rows.map((row) => ({
        id: String(row.property_id), name: String(row.name ?? ''), county: String(row.county ?? ''), town: String(row.town ?? ''),
        estate: row.estate == null ? null : String(row.estate), property_type: String(row.property_type ?? ''), asset_class: String(row.asset_class ?? 'built_property'),
        operation_model: String(row.operation_model ?? 'long_term_rental'), ownership_type: row.ownership_type == null ? null : String(row.ownership_type),
        title_number: row.title_number == null ? null : String(row.title_number), parcel_number: row.parcel_number == null ? null : String(row.parcel_number),
        total_land_area: row.total_land_area == null ? null : Number(row.total_land_area), land_area_unit: row.land_area_unit == null ? null : String(row.land_area_unit),
        plot_count: row.plot_count == null ? null : Number(row.plot_count), plot_dimensions: row.plot_dimensions == null ? null : String(row.plot_dimensions),
        photos: Array.isArray(row.photos) ? row.photos.filter((x): x is string => typeof x === 'string') : [], available_units: Number(row.available_units || 0),
        min_monthly_rent: row.min_monthly_rent == null ? null : Number(row.min_monthly_rent), sale_listing_count: Number(row.sale_listing_count || 0),
        sale_min_price: row.sale_min_price == null ? null : Number(row.sale_min_price), short_stay_listing_count: Number(row.short_stay_listing_count || 0),
        short_stay_min_rate: row.short_stay_min_rate == null ? null : Number(row.short_stay_min_rate),
      })).slice(0, 6);
      const statRow = Array.isArray(siteStats) && siteStats.length ? siteStats[0] as Record<string, unknown> : null;
      const verifiedCount = Number(statRow?.verified_properties || rows.length);
      const availableCount = rows.reduce((sum, row) => sum + Number(row.available_units || 0), 0);
      const countyCount = new Set(rows.map((row) => row.county).filter((x) => typeof x === 'string' && x)).size;
      setStats([
        { value: verifiedCount, suffix: '+', label: 'Verified Assets' },
        { value: Number(statRow?.available_homes || availableCount), suffix: '+', label: 'Available' },
        { value: Number(statRow?.counties_covered || countyCount), suffix: '+', label: 'Counties' },
        { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation Hold' },
      ]);
      if (!cancelled) { setProperties(props); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.location) params.set('location', search.location);
    if (search.assetClass) params.set('asset_class', search.assetClass);
    if (search.operation) params.set('operation', search.operation);
    navigate(`/properties?${params.toString()}`);
  };

  return (
    <div>
      {/* ======================================================
          FULL-WIDTH HERO — AI-generated image, 50-65% overlay, centered CTA
          Responsive: 50vh mobile, 70vh desktop, object-fit cover, preloaded
          ====================================================== */}
      <section className="hero-full" aria-label="HighPark Consult hero">
        <img
          src="/hero-property-consulting.jpg"
          alt="Modern property consulting and real estate advisory in Kenya"
          className="hero-full__image"
          fetchPriority="high"
          decoding="async"
        />
        <div className="hero-full__overlay" aria-hidden="true" />
        <div className="hero-full__content">
          <h1>Verified property, land and investment opportunities in Kenya</h1>
          <p>
            HighPark Consult connects you to professionally managed homes, commercial spaces, land and short stays — with clarity, trust and expert guidance.
          </p>
          <Link to="/properties" className="hero-full__cta">
            Explore Opportunities
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* ======================================================
          SEARCH — Minimal, performance-friendly
          ====================================================== */}
      <section className="section" style={{ background: '#f7f8fa', borderBottom: '1px solid #eef0f4' }}>
        <div className="container-main">
          <div className="card" style={{ padding: '1rem', maxWidth: '960px', margin: '0 auto' }}>
            <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="label">Location</label>
                <select className="input" value={search.location} onChange={(e) => setSearch({ ...search, location: e.target.value })}>
                  <option value="">All locations</option>
                  {KENYAN_COUNTIES.map((county) => <option key={county}>{county}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Asset Class</label>
                <select className="input" value={search.assetClass} onChange={(e) => setSearch({ ...search, assetClass: e.target.value })}>
                  <option value="">All assets</option>
                  {ASSET_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Opportunity</label>
                <select className="input" value={search.operation} onChange={(e) => setSearch({ ...search, operation: e.target.value })}>
                  <option value="">Any opportunity</option>
                  {OPERATION_MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex items-end">
                <button type="submit" className="btn-primary w-full">
                  <Search className="h-4 w-4" /> Search
                </button>
              </div>
            </form>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4" style={{ maxWidth: '800px', margin: '40px auto 0' }}>
            {stats.map((stat) => (
              <AnimatedStat key={stat.label} value={stat.value} suffix={stat.suffix} prefix={stat.prefix} label={stat.label} />
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          FEATURED PROPERTIES — Single column mobile, 3 col desktop
          ====================================================== */}
      <section className="section">
        <div className="container-main">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Verified listings</p>
              <h2 className="mt-2">Opportunities worth exploring</h2>
              <p className="mt-2 text-sm text-ink-500 max-w-2xl">
                Explore verified homes, land, commercial spaces and short stays available through HighPark Consult.
              </p>
            </div>
            <Link to="/properties" className="btn-secondary hidden sm:inline-flex">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : properties.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => (
                <FeaturedPropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <p className="text-ink-500">No verified opportunities available right now.</p>
            </div>
          )}

          <div className="mt-8 text-center sm:hidden">
            <Link to="/properties" className="btn-primary">View All Opportunities</Link>
          </div>
        </div>
      </section>

      {/* ======================================================
          HOW IT WORKS — Increased spacing, 8px grid
          ====================================================== */}
      <section className="section" style={{ background: '#ffffff', borderTop: '1px solid #eef0f4' }}>
        <div className="container-main">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="section-kicker">How it works</p>
            <h2 className="mt-2">A straightforward property journey</h2>
            <p className="mt-3 text-sm text-ink-500">Search, enquire, transact and manage through one connected experience.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Search className="h-5 w-5" />, title: 'Search & Browse', desc: 'Explore verified homes, commercial spaces, land and short stays by location and purpose.' },
              { icon: <Wallet className="h-5 w-5" />, title: 'Enquire or Reserve', desc: 'Send an enquiry, request a viewing or reserve an available opportunity.' },
              { icon: <FileText className="h-5 w-5" />, title: 'Sign Agreement', desc: 'Complete registration and lease documentation through your customer workspace.' },
              { icon: <HomeIcon className="h-5 w-5" />, title: 'Move In & Manage', desc: 'Track rent, invoices, maintenance and documents in one place.' },
            ].map((step, i) => (
              <div key={i} className="card" style={{ padding: '1rem' }}>
                <div className="flex h-10 w-10 items-center justify-center bg-ink-50 text-brand-900" style={{ borderRadius: '2px' }}>
                  {step.icon}
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-ink-500 leading-6">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          FEATURES — Minimal cards, thin border, no shadow heavy
          ====================================================== */}
      <section className="section" style={{ background: '#f7f8fa', borderTop: '1px solid #eef0f4', borderBottom: '1px solid #eef0f4' }}>
        <div className="container-main">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { icon: <ShieldCheck className="h-5 w-5" />, title: 'Verified Properties Only', desc: 'Listings go through verification so you can decide with confidence.' },
              { icon: <Search className="h-5 w-5" />, title: 'Instant Enquiry', desc: 'Send enquiries and schedule viewings through a streamlined digital process.' },
              { icon: <Building2 className="h-5 w-5" />, title: 'Full Management', desc: 'Keep rent, maintenance, lease and communications organised in one workspace.' },
            ].map((feature) => (
              <div key={feature.title} className="card" style={{ padding: '1rem' }}>
                <div className="flex h-10 w-10 items-center justify-center bg-white text-brand-900 border border-ink-100" style={{ borderRadius: '2px' }}>
                  {feature.icon}
                </div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-ink-500 leading-6">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          TESTIMONIALS — Simple, editorial
          ====================================================== */}
      <section className="section">
        <div className="container-main">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <h2>Property should feel simpler and more dependable</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { name: 'Wanjiru K.', role: 'Tenant, Kilimani', text: 'I found my apartment in two days and reserved it online. The whole process was smooth and transparent.' },
              { name: 'Mwangi O.', role: 'Owner, Westlands', text: 'Managing 12 units used to be a headache. Now I track rent, expenses, and taxes all in one dashboard.' },
              { name: 'Aisha N.', role: 'Tenant, Mombasa', text: 'The M-Pesa rent payment feature is a game changer. No more queuing at the agent office.' },
            ].map((t) => (
              <div key={t.name} className="card" style={{ padding: '1rem' }}>
                <div className="flex gap-1 mb-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 text-accent-500 fill-accent-500" />
                  ))}
                </div>
                <p className="text-sm text-ink-600 leading-6">"{t.text}"</p>
                <div className="mt-4">
                  <p className="text-sm font-semibold text-ink-900">{t.name}</p>
                  <p className="text-xs text-ink-400">{t.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          CTA — Solid dark blue, minimal
          ====================================================== */}
      <section className="section" style={{ background: '#0d2342' }}>
        <div className="container-main">
          <div className="mx-auto max-w-3xl text-center">
            <h2 style={{ color: '#ffffff' }}>Your next property decision starts here</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.8)' }}>
              Explore verified opportunities, compare what matters, and connect with HighPark Consult when you are ready to take the next step.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/properties" className="btn-accent">
                Browse Properties
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/register" className="btn-secondary" style={{ background: '#ffffff', color: '#0d2342', borderColor: '#ffffff' }}>
                Create Account
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function FeaturedPropertyCard({ property }: { property: PropertyWithUnits }) {
  const image = property.photos?.[0] || getPropertyImage(property.property_type);
  const view = getPropertyPresentation(property.asset_class, property.operation_model, property.property_type);
  const isLand = view.kind === 'land';
  const isSale = property.sale_listing_count > 0 || ['sale', 'land_sale'].includes(property.operation_model);
  const isStay = property.short_stay_listing_count > 0 || property.operation_model === 'short_stay';
  const opportunity = property.min_monthly_rent
    ? `${formatKES(property.min_monthly_rent)}/mo`
    : property.sale_min_price
      ? `From ${formatKES(property.sale_min_price)}`
      : property.short_stay_min_rate
        ? `${formatKES(property.short_stay_min_rate)}/night`
        : 'Enquire for details';

  return (
    <Link to={`/property/${property.id}`} className="card group overflow-hidden" style={{ padding: 0 }}>
      <div className="relative overflow-hidden bg-ink-100" style={{ aspectRatio: '16 / 9' }}>
        <img
          src={image}
          alt={property.name}
          className="property-card__image transition-transform duration-150 ease-out group-hover:scale-[1.02]"
          loading="lazy"
          decoding="async"
        />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="badge badge-brand">Verified</span>
          {isSale && <span className="badge badge-accent">For sale</span>}
          {isStay && <span className="badge">Short stay</span>}
        </div>
      </div>
      <div style={{ padding: '1rem' }}>
        <h3 className="truncate font-semibold" style={{ fontSize: '1rem' }}>{property.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-500">
          <MapPin className="h-3.5 w-3.5" /> {property.estate ? `${property.estate}, ` : ''}{property.town}, {property.county}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          <span className="badge">{view.label}</span>
          <span className="badge">{property.property_type}</span>
          {isLand && property.total_land_area && <span className="badge">{property.total_land_area} {property.land_area_unit || 'acres'}</span>}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
          <div>
            <p className="text-sm font-bold" style={{ color: '#0d2342' }}>{isLand ? 'Enquire for land price' : opportunity}</p>
            {isLand ? (
              <p className="text-xs text-ink-400">{property.plot_count || 0} plots · {property.plot_dimensions || 'dimensions on enquiry'}</p>
            ) : property.available_units > 0 ? (
              <p className="text-xs text-ink-400">{property.available_units} {view.inventoryLabel.toLowerCase()} available</p>
            ) : null}
          </div>
          <span className="text-xs font-semibold" style={{ color: '#0d2342' }}>View →</span>
        </div>
      </div>
    </Link>
  );
}
