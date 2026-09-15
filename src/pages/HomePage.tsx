import { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Home as HomeIcon,
  ArrowRight,
  Star,
  ShieldCheck,
  Wallet,
  FileText,
  Building,
  Building2,
  BedDouble,
  BadgeDollarSign,
  Map,
  Users,
  Settings,
  HelpCircle,
  Bot,
  ClipboardList,
  BarChart3,
  MessageSquare,
  CalendarCheck,
  TrendingUp,
  Zap,
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
        {prefix}{count.toLocaleString()}{suffix}
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
      {/* HERO — full-width image, 55% overlay, centered */}
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
          <p>Discover professionally managed homes, commercial spaces, land and short stays — with clarity, trust and expert guidance from HighPark Consult.</p>
          <Link to="/properties" className="hero-full__cta">Explore Opportunities <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </section>

      {/* SEARCH + STATS */}
      <section className="section" style={{ background: '#f7f8fa', borderBottom: '1px solid #eef0f4' }}>
        <div className="container-main">
          <div className="card" style={{ padding: '1rem', maxWidth: '960px', margin: '0 auto' }}>
            <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="label">Location</label><select className="input" value={search.location} onChange={(e) => setSearch({ ...search, location: e.target.value })}><option value="">All locations</option>{KENYAN_COUNTIES.map((county) => <option key={county}>{county}</option>)}</select></div>
              <div><label className="label">Asset Class</label><select className="input" value={search.assetClass} onChange={(e) => setSearch({ ...search, assetClass: e.target.value })}><option value="">All assets</option>{ASSET_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="label">Opportunity</label><select className="input" value={search.operation} onChange={(e) => setSearch({ ...search, operation: e.target.value })}><option value="">Any opportunity</option>{OPERATION_MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div className="flex items-end"><button type="submit" className="btn-primary w-full"><Search className="h-4 w-4" /> Search</button></div>
            </form>
          </div>
          <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4" style={{ maxWidth: '800px', margin: '40px auto 0' }}>
            {stats.map((stat) => <AnimatedStat key={stat.label} value={stat.value} suffix={stat.suffix} prefix={stat.prefix} label={stat.label} />)}
          </div>
        </div>
      </section>

      {/* FEATURED PROPERTIES */}
      <section className="section">
        <div className="container-main">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">Verified listings</p>
              <h2 className="mt-2">Opportunities worth exploring</h2>
              <p className="mt-2 text-sm text-ink-500 max-w-2xl">Explore verified homes, land, commercial spaces, development opportunities and short stays available through HighPark Consult.</p>
            </div>
            <Link to="/properties" className="btn-secondary hidden sm:inline-flex">View All <ArrowRight className="h-4 w-4" /></Link>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : properties.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property) => <FeaturedPropertyCard key={property.id} property={property} />)}
            </div>
          ) : (
            <div className="text-center py-16"><p className="text-ink-500">No verified opportunities available right now.</p></div>
          )}

          <div className="mt-8 text-center sm:hidden"><Link to="/properties" className="btn-primary">View All Opportunities</Link></div>
        </div>
      </section>

      {/* PLATFORM JOURNEY */}
      <section id="platform" className="section" style={{ background: '#f7f8fa', borderTop: '1px solid #eef0f4', borderBottom: '1px solid #eef0f4' }}>
        <div className="container-main">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">From discovery to management</p>
              <h2 className="mt-2">One trusted platform for the complete property journey</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">From first search to ownership, tenancy, investment or hospitality, HighPark Consult brings discovery, communication, transactions and management into one connected experience.</p>
            </div>
            <Link to="/properties" className="btn-secondary shrink-0">Open marketplace <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { icon: <Search className="h-5 w-5" />, number: '01', title: 'Discover', desc: 'Search verified homes, commercial spaces, land, plots, mixed-use assets and short-stay opportunities by location and purpose.', links: [['Marketplace', '/properties'], ['Property details', '/properties']] },
              { icon: <Users className="h-5 w-5" />, number: '02', title: 'Engage & transact', desc: 'Save opportunities, request a viewing, send an enquiry, reserve a stay or begin the next step with the HighPark team.', links: [['Create account', '/register'], ['Sign in', '/login']] },
              { icon: <Building2 className="h-5 w-5" />, number: '03', title: 'Operate & manage', desc: 'Customers, owners and administrators move into dedicated workspaces for leases, payments, maintenance, documents, messages and reporting.', links: [['Customer workspace', '/login'], ['Owner workspace', '/login']] },
            ].map((item) => (
              <div key={item.number} className="card" style={{ padding: '1rem' }}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-10 w-10 items-center justify-center bg-ink-50 text-brand-900 border border-ink-100" style={{ borderRadius: '2px' }}>{item.icon}</div>
                  <span className="text-2xl font-bold text-ink-100">{item.number}</span>
                </div>
                <h3 className="mt-4 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{item.desc}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.links.map(([label, to]) => (
                    <Link key={label} to={to} className="btn-secondary" style={{ minHeight: '32px', padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>{label} <ArrowRight className="h-3 w-3" /></Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PROPERTY CATEGORIES */}
      <section className="section" style={{ background: '#0d2342' }}>
        <div className="container-main">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#c9972e' }}>Property, land & hospitality</p>
              <h2 className="mt-2" style={{ color: '#ffffff' }}>Choose an opportunity that fits your objective</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.7)' }}>Whether your goal is to find a home, secure business space, acquire land, explore development or book a short stay, start with the category that matches your objective.</p>
            </div>
            <Link to="/properties" className="btn-accent shrink-0">Explore all <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ['Homes', 'Residential properties', <HomeIcon className="h-5 w-5" />, ''],
              ['Commercial', 'Offices & business spaces', <Building className="h-5 w-5" />, 'commercial'],
              ['Land & Plots', 'Development & investment land', <Map className="h-5 w-5" />, 'land'],
              ['Mixed Use', 'Multi-purpose assets', <Building2 className="h-5 w-5" />, 'mixed_use'],
              ['Short Stays', 'Flexible hospitality stays', <BedDouble className="h-5 w-5" />, 'short_stay'],
              ['For Sale', 'Ownership opportunities', <BadgeDollarSign className="h-5 w-5" />, 'sale'],
            ] as Array<[string, string, JSX.Element, string]>).map(([title, desc, icon, filter]) => (
              <Link key={title} to={filter === 'sale' ? '/properties?category=buy' : filter === 'land' ? '/properties?category=land' : filter === 'short_stay' ? '/properties?category=short_stay' : filter ? `/properties?asset_class=${filter}` : '/properties'} className="card group" style={{ padding: '1rem', background: '#ffffff0d', borderColor: 'rgba(255,255,255,0.1)' }}>
                <div style={{ color: '#c9972e' }}>{icon}</div>
                <h3 className="mt-3 text-sm font-bold" style={{ color: '#ffffff' }}>{title}</h3>
                <p className="mt-1 text-xs leading-5" style={{ color: 'rgba(255,255,255,0.6)' }}>{desc}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: '#c9972e' }}>Explore <ArrowRight className="h-3 w-3" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* EXPERIENCES */}
      <section id="experiences" className="section" style={{ background: '#ffffff' }}>
        <div className="container-main">
          <div className="mx-auto mb-10 max-w-3xl text-center">
            <p className="section-kicker">Explore the platform</p>
            <h2 className="mt-2">From the first search to the next step, we stay with you</h2>
            <p className="mt-3 text-sm leading-6 text-ink-500">HighPark Consult is designed to make property decisions clearer and property relationships easier to manage.</p>
          </div>

          <div className="space-y-4">
            {[
              {
                eyebrow: 'Marketplace',
                title: 'Properties, land, plots & stays',
                desc: 'Search the marketplace by location, asset type and purpose. Compare verified opportunities and open a full listing for the information you need.',
                icon: <Building2 className="h-5 w-5" />,
                links: [['Browse properties', '/properties'], ['Explore land & plots', '/properties?asset_class=land'], ['Explore short stays', '/properties?operation=short_stay']],
                bullets: ['Verified inventory', 'Map/location information', 'Asset-aware presentation'],
              },
              {
                eyebrow: 'Property details',
                title: 'Inspect an opportunity before you enquire',
                desc: 'Review photos, location, pricing, availability and asset-specific information, then enquire, request a viewing or reserve where available.',
                icon: <MapPin className="h-5 w-5" />,
                links: [['Open marketplace', '/properties'], ['Ask HighPark AI', '/properties']],
                bullets: ['Location & map context', 'Land-specific information', 'Enquiry and reservation pathways'],
              },
              {
                eyebrow: 'Customer workspace',
                title: 'Your saved properties, bookings & tenancy journey',
                desc: 'Your customer workspace keeps reservations, viewings, rent, leases, maintenance, documents and messages together.',
                icon: <ClipboardList className="h-5 w-5" />,
                links: [['Create account', '/register'], ['Sign in', '/login']],
                bullets: ['Reservations & viewings', 'Rent, lease & maintenance', 'Messages & documents'],
              },
              {
                eyebrow: 'Owner workspace',
                title: 'Run the property portfolio from one command centre',
                desc: 'Owners can manage properties and units alongside reservations, expenses, tax, maintenance, tenants, payments, reports, documents, sales and short-stay operations.',
                icon: <BarChart3 className="h-5 w-5" />,
                links: [['Owner dashboard', '/login'], ['Owner properties', '/login']],
                bullets: ['Universal asset portfolio', 'Financial & operational controls', 'Customer enquiries & messaging'],
              },
              {
                eyebrow: 'Support & trust',
                title: 'About, FAQs and direct contact',
                desc: 'Learn about HighPark Consult, find answers to common questions and contact the team directly when you need assistance.',
                icon: <HelpCircle className="h-5 w-5" />,
                links: [['About HighPark', '/about'], ['FAQs', '/faqs'], ['Contact us', '/contact']],
                bullets: ['Company information', 'Frequently asked questions', 'Direct contact options'],
              },
            ].map((item) => (
              <div key={item.title} className="card grid overflow-hidden lg:grid-cols-[1fr_.9fr]" style={{ padding: 0 }}>
                <div style={{ padding: '1.5rem' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center bg-brand-900 text-white" style={{ borderRadius: '2px' }}>{item.icon}</div>
                    <span className="text-xs font-bold uppercase tracking-wide" style={{ color: '#0d2342' }}>{item.eyebrow}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-ink-500 max-w-2xl">{item.desc}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {item.links.map(([label, to]) => (
                      <Link key={label} to={to} className="btn-secondary" style={{ minHeight: '32px', padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}>{label} <ArrowRight className="h-3 w-3" /></Link>
                    ))}
                  </div>
                </div>
                <div className="flex items-center bg-ink-50 p-6 border-t lg:border-t-0 lg:border-l border-ink-100">
                  <div className="w-full bg-white p-4 border border-ink-100" style={{ borderRadius: '4px' }}>
                    <div className="mb-3 flex items-center justify-between border-b border-ink-100 pb-2">
                      <span className="text-xs font-bold uppercase tracking-wide text-ink-400">HighPark experience</span>
                      <span className="badge badge-brand"><ShieldCheck className="h-3 w-3" /> Connected</span>
                    </div>
                    <div className="space-y-2">
                      {item.bullets.map((bullet, index) => (
                        <div key={bullet} className="flex items-center gap-3 border border-ink-100 bg-white p-3" style={{ borderRadius: '2px' }}>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-ink-50 text-ink-600 border border-ink-100" style={{ borderRadius: '2px' }}>{index === 0 ? <CalendarCheck className="h-4 w-4" /> : index === 1 ? <MessageSquare className="h-4 w-4" /> : <Settings className="h-4 w-4" />}</span>
                          <span className="text-sm font-medium">{bullet}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PLATFORM ROLES */}
      <section id="roles" className="section" style={{ background: '#0d2342' }}>
        <div className="container-main">
          <div className="mb-8 max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: '#c9972e' }}>Built for every side of property</p>
            <h2 className="mt-2" style={{ color: '#ffffff' }}>The right workspace for every relationship</h2>
            <p className="mt-3 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.7)' }}>HighPark brings property discovery and day-to-day operations together. Each user gets the tools and information relevant to their role.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { title: 'Customer', icon: <Users className="h-5 w-5" />, desc: 'Find a property, save favourites, make enquiries, arrange viewings, manage bookings and keep up with tenancy matters.', cta: 'Create customer account', to: '/register' },
              { title: 'Property Owner', icon: <Building2 className="h-5 w-5" />, desc: 'Manage a complete portfolio across homes, commercial assets, land, mixed-use properties and short stays.', cta: 'Owner sign in', to: '/login' },
              { title: 'Administrator', icon: <ShieldCheck className="h-5 w-5" />, desc: 'Maintain verified inventory, oversee users and operations, monitor compliance and keep the platform running smoothly.', cta: 'Administrator sign in', to: '/login' },
            ].map((role) => (
              <div key={role.title} className="card" style={{ padding: '1rem', background: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.1)' }}>
                <div className="flex h-10 w-10 items-center justify-center bg-white/10 text-white" style={{ borderRadius: '2px' }}>{role.icon}</div>
                <h3 className="mt-4 font-bold" style={{ color: '#ffffff' }}>{role.title}</h3>
                <p className="mt-2 text-sm leading-6" style={{ color: 'rgba(255,255,255,0.7)' }}>{role.desc}</p>
                <Link to={role.to} className="mt-4 inline-flex items-center gap-2 text-sm font-bold" style={{ color: '#c9972e' }}>{role.cta} <ArrowRight className="h-4 w-4" /></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="section">
        <div className="container-main">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="section-kicker">How it works</p>
            <h2 className="mt-2">A straightforward property journey</h2>
            <p className="mt-3 text-sm text-ink-500">Search, enquire, transact and manage through one connected experience.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: <Search className="h-5 w-5" />, title: 'Search & Browse', desc: 'Explore verified homes, commercial spaces, land, development assets and short stays by location, asset type and purpose.' },
              { icon: <Wallet className="h-5 w-5" />, title: 'Enquire or Reserve', desc: 'Send an enquiry, request a viewing, reserve an available stay or take the next step toward a transaction.' },
              { icon: <FileText className="h-5 w-5" />, title: 'Sign Tenancy Agreement', desc: 'Where tenancy applies, complete registration and lease documentation through the customer journey.' },
              { icon: <HomeIcon className="h-5 w-5" />, title: 'Move In & Pay Rent', desc: 'Keep track of rent, invoices, maintenance requests, documents and ongoing tenancy services.' },
            ].map((step, i) => (
              <div key={i} className="card" style={{ padding: '1rem' }}>
                <div className="flex h-10 w-10 items-center justify-center bg-ink-50 text-brand-900 border border-ink-100" style={{ borderRadius: '2px' }}>{step.icon}</div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-ink-500 leading-6">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="section" style={{ background: '#f7f8fa', borderTop: '1px solid #eef0f4', borderBottom: '1px solid #eef0f4' }}>
        <div className="container-main">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {[
              { icon: <ShieldCheck className="h-5 w-5" />, title: 'Verified Properties Only', desc: 'Listings are presented through HighPark verification workflow so customers can make decisions using information available on the platform.' },
              { icon: <Zap className="h-5 w-5" />, title: 'Instant Online Reservation', desc: 'Where online reservation is enabled, customers can secure available opportunities through a streamlined digital process.' },
              { icon: <TrendingUp className="h-5 w-5" />, title: 'Full Tenancy Management', desc: 'Keep rent, invoices, maintenance, lease information and customer communications organised in one workspace.' },
            ].map((feature) => (
              <div key={feature.title} className="card" style={{ padding: '1rem' }}>
                <div className="flex h-10 w-10 items-center justify-center bg-white text-brand-900 border border-ink-100" style={{ borderRadius: '2px' }}>{feature.icon}</div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-ink-500 leading-6">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* POPULAR LOCATIONS */}
      <section className="section">
        <div className="container-main">
          <h2 className="text-center">Explore popular locations</h2>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[
              { name: 'Nairobi', count: '250+ properties' },
              { name: 'Mombasa', count: '80+ properties' },
              { name: 'Kisumu', count: '45+ properties' },
              { name: 'Nakuru', count: '40+ properties' },
              { name: 'Kiambu', count: '35+ properties' },
              { name: 'Eldoret', count: '30+ properties' },
            ].map((location) => (
              <Link key={location.name} to={`/properties?location=${encodeURIComponent(location.name)}`} className="card text-center group" style={{ padding: '1rem' }}>
                <div className="mx-auto flex h-10 w-10 items-center justify-center bg-ink-50 text-brand-900 border border-ink-100 group-hover:bg-brand-900 group-hover:text-white transition-colors" style={{ borderRadius: '2px' }}><MapPin className="h-5 w-5" /></div>
                <h3 className="mt-3 font-semibold text-sm">{location.name}</h3>
                <p className="mt-1 text-xs text-ink-400">{location.count}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* AI ASSISTANT */}
      <section id="ai-assistant" className="section" style={{ background: '#f7f8fa', borderTop: '1px solid #eef0f4' }}>
        <div className="container-main">
          <div className="card" style={{ padding: '1.5rem', background: '#0d2342', borderColor: '#0d2342' }}>
            <div className="grid gap-6 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
              <div>
                <div className="inline-flex items-center gap-2 border border-white/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wide" style={{ borderRadius: '2px', color: '#c9972e' }}><Bot className="h-4 w-4" /> HighPark AI Assistant</div>
                <h2 className="mt-4" style={{ color: '#ffffff' }}>Get answers while you search</h2>
                <p className="mt-3 max-w-2xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.7)' }}>Ask about available properties, land and plots, rental or sale opportunities, short stays, locations, pricing and the best way to make an enquiry.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {['Property search', 'Land & plots', 'Rent & sale', 'Short stays', 'Location', 'Enquiries'].map((topic) => <span key={topic} className="badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', borderColor: 'rgba(255,255,255,0.1)' }}>{topic}</span>)}
                </div>
              </div>
              <div className="bg-white p-4 border border-ink-100" style={{ borderRadius: '4px' }}>
                <div className="flex items-center gap-3 border-b border-ink-100 pb-3"><div className="flex h-10 w-10 items-center justify-center bg-ink-50 text-brand-900 border border-ink-100" style={{ borderRadius: '2px' }}><Bot className="h-5 w-5" /></div><div><p className="text-sm font-bold">Property-aware assistance</p><p className="text-xs text-ink-500">Ask from any public page</p></div></div>
                <div className="mt-4 space-y-2">
                  <div className="bg-ink-50 p-3 text-xs border border-ink-100" style={{ borderRadius: '2px' }}>“Show me available land in Kenya.”</div>
                  <div className="ml-6 bg-brand-900 text-white p-3 text-xs" style={{ borderRadius: '2px' }}>“I’ll show you the verified land and plot opportunities available on HighPark.”</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section">
        <div className="container-main">
          <div className="mx-auto mb-10 max-w-2xl text-center"><h2>Property should feel simpler, clearer and more dependable</h2></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { name: 'Wanjiru K.', role: 'Tenant, Kilimani', text: 'I found my apartment in two days and reserved it online. The whole process was smooth and transparent.' },
              { name: 'Mwangi O.', role: 'Property Owner, Westlands', text: 'Managing 12 units used to be a headache. Now I track rent, expenses, and taxes all in one dashboard.' },
              { name: 'Aisha N.', role: 'Tenant, Mombasa', text: "The M-Pesa rent payment feature is a game changer. No more queuing at the agent's office every month." },
            ].map((testimonial) => (
              <div key={testimonial.name} className="card" style={{ padding: '1rem' }}>
                <div className="flex gap-1 mb-3">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 text-accent-500 fill-accent-500" />)}</div>
                <p className="text-sm text-ink-600 leading-6">"{testimonial.text}"</p>
                <div className="mt-4"><p className="text-sm font-semibold">{testimonial.name}</p><p className="text-xs text-ink-400">{testimonial.role}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section" style={{ background: '#0d2342' }}>
        <div className="container-main">
          <div className="mx-auto max-w-3xl text-center">
            <h2 style={{ color: '#ffffff' }}>Your next property decision starts here.</h2>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-6" style={{ color: 'rgba(255,255,255,0.7)' }}>Explore verified opportunities, compare what matters, and connect with HighPark Consult when you are ready to take the next step.</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to="/properties" className="btn-accent">Browse Properties, Land & Stays <ArrowRight className="h-4 w-4" /></Link>
              <Link to="/register" className="btn-secondary" style={{ background: '#ffffff', color: '#0d2342', borderColor: '#ffffff' }}>Create Account</Link>
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
  const opportunity = property.min_monthly_rent ? `${formatKES(property.min_monthly_rent)}/mo` : property.sale_min_price ? `From ${formatKES(property.sale_min_price)}` : property.short_stay_min_rate ? `${formatKES(property.short_stay_min_rate)}/night` : 'Enquire for details';
  return (
    <Link to={`/property/${property.id}`} className="card group overflow-hidden" style={{ padding: 0 }}>
      <div className="relative overflow-hidden bg-ink-100" style={{ aspectRatio: '16 / 9' }}>
        <img src={image} alt={property.name} className="h-full w-full object-cover transition-transform duration-150 ease-out group-hover:scale-[1.02]" loading="lazy" decoding="async" />
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          <span className="badge badge-brand"><ShieldCheck className="h-3 w-3" /> Verified</span>
          {isSale && <span className="badge badge-accent">For sale</span>}
          {isStay && <span className="badge">Short stay</span>}
        </div>
      </div>
      <div style={{ padding: '1rem' }}>
        <h3 className="truncate font-semibold text-sm">{property.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-xs text-ink-500"><MapPin className="h-3.5 w-3.5" /> {property.estate ? `${property.estate}, ` : ''}{property.town}, {property.county}</p>
        <div className="mt-3 flex flex-wrap gap-1">
          <span className="badge">{view.label}</span>
          <span className="badge">{property.property_type}</span>
          {isLand && property.total_land_area && <span className="badge">{property.total_land_area} {property.land_area_unit || 'acres'}</span>}
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3">
          <div><p className="text-sm font-bold" style={{ color: '#0d2342' }}>{isLand ? 'Enquire for land price' : opportunity}</p>{isLand ? <p className="text-xs text-ink-400">{property.plot_count || 0} plots · {property.plot_dimensions || 'dimensions on enquiry'}</p> : property.available_units > 0 && <p className="text-xs text-ink-400">{property.available_units} {view.inventoryLabel.toLowerCase()} available</p>}</div>
          <span className="text-xs font-semibold" style={{ color: '#0d2342' }}>View →</span>
        </div>
      </div>
    </Link>
  );
}
