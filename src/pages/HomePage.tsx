import { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Home as HomeIcon,
  ArrowRight,
  Star,
  ShieldCheck,
  Zap,
  Wallet,
  FileText,
  TrendingUp,
  Users,
  Settings,
  HelpCircle,
  Bot,
  ClipboardList,
  BarChart3,
  MessageSquare,
  CalendarCheck,
  Building,
  Map,
  Building2,
  BedDouble,
  BadgeDollarSign,
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
const heroImage = '/highpark-hero.webp';
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
  to: string;
  cta: string;
}

/* ============================================================
   ANIMATED STATISTICS
   ============================================================ */

function AnimatedStat({
  value,
  suffix = '',
  prefix = '',
  label,
  to,
  cta,
}: Stat) {
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
      {
        threshold: 0.5,
      }
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted) return;

    const duration = 1800;
    const startTime = performance.now();

    let animationFrame: number;

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;

      const progress = Math.min(elapsed / duration, 1);

      /*
       * Ease-out animation.
       * Starts quickly and slows down naturally near the target.
       */
      const easedProgress =
        1 - Math.pow(1 - progress, 3);

      const currentValue = Math.floor(
        easedProgress * value
      );

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
    <div ref={statRef}>
      <Link
        to={to}
        aria-label={`${label}: ${cta}`}
        className="home-stat-card group block border border-ink-100 bg-white p-4 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
      >
        <p className="text-2xl font-bold text-brand-900 tabular-nums sm:text-3xl">
          {prefix}
          {count.toLocaleString()}
          {suffix}
        </p>
        <p className="mt-1 text-sm text-ink-600">{label}</p>
        <span className="mt-2 inline-flex min-h-11 items-center gap-1 text-[11px] font-semibold text-accent-700">
          {cta} <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </div>
  );
}

/* ============================================================
   HOME PAGE
   ============================================================ */

export function HomePage() {
  const { navigate } = useRouter();

  const [properties, setProperties] = useState<
    PropertyWithUnits[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stat[]>([
    { value: 0, suffix: '+', label: 'Verified Assets', to: '/properties', cta: 'Explore listings' },
    { value: 0, suffix: '+', label: 'Available Opportunities', to: '/properties', cta: 'View opportunities' },
    { value: 0, suffix: '+', label: 'Counties Covered', to: '/properties', cta: 'Explore by location' },
    { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation / Enquiry Hold', to: '/contact', cta: 'Talk to HighPark' },
  ]);

  const [search, setSearch] = useState({
    location: '',
    assetClass: '',
    operation: '',
  });

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
        { value: verifiedCount, suffix: '+', label: 'Verified Assets', to: '/properties', cta: 'Explore listings' },
        { value: Number(statRow?.available_homes || availableCount), suffix: '+', label: 'Available Opportunities', to: '/properties', cta: 'View opportunities' },
        { value: Number(statRow?.counties_covered || countyCount), suffix: '+', label: 'Counties Covered', to: '/properties', cta: 'Explore by location' },
        { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation / Enquiry Hold', to: '/contact', cta: 'Talk to HighPark' },
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
          HERO SECTION
          ====================================================== */}
      <section className="hero-premium relative isolate min-h-[50vh] overflow-hidden sm:min-h-[60vh] lg:min-h-[70vh]">
        <picture>
          <source media="(max-width: 767px)" srcSet="/highpark-hero-mobile.webp" />
          <img
            src={heroImage}
            alt="Contemporary property representing HighPark Consult's property and investment marketplace"
            className="absolute inset-0 h-full w-full object-cover"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-black/60" aria-hidden="true" />

        <div className="relative z-10 mx-auto flex min-h-[50vh] max-w-4xl items-center justify-center px-4 py-20 text-center sm:min-h-[60vh] sm:px-6 lg:min-h-[70vh] lg:px-8">
          <div className="max-w-3xl">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.2em] text-accent-300 sm:text-sm">Property • Land • Investment • Management</p>
            <h1 className="text-4xl font-bold leading-tight tracking-[-0.02em] text-white sm:text-5xl lg:text-6xl">
              Find the right property opportunity. Move forward with confidence.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/90 sm:text-lg sm:leading-8">
              Discover verified homes, land, commercial spaces, mixed-use assets and short stays across Kenya — with clearer information, professional guidance and a connected journey from discovery to management.
            </p>
            <div className="mt-8">
              <Link to="/properties" className="btn-accent min-h-11 px-6 py-3">Explore Verified Opportunities <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </section>

      {/* Search remains a practical marketplace tool directly below the hero. */}
      <section className="border-b border-ink-100 bg-white py-8 sm:py-10">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div><label className="label">Location</label><select className="input" value={search.location} onChange={(e) => setSearch({ ...search, location: e.target.value })}><option value="">All locations</option>{KENYAN_COUNTIES.map((county) => <option key={county}>{county}</option>)}</select></div>
            <div><label className="label">Asset Class</label><select className="input" value={search.assetClass} onChange={(e) => setSearch({ ...search, assetClass: e.target.value })}><option value="">All assets</option>{ASSET_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div><label className="label">Opportunity</label><select className="input" value={search.operation} onChange={(e) => setSearch({ ...search, operation: e.target.value })}><option value="">Any opportunity</option>{OPERATION_MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
            <div className="flex items-end"><button type="submit" className="btn-primary min-h-11 w-full"><Search className="h-4 w-4" /> Search Opportunities</button></div>
          </form>
        </div>
      </section>

      {/* ======================================================
          ANIMATED STATISTICS
          ====================================================== */}
      <section className="bg-white py-12 sm:py-16">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {stats.map((stat) => (
            <AnimatedStat key={stat.label} value={stat.value} suffix={stat.suffix} prefix={stat.prefix} label={stat.label} to={stat.to} cta={stat.cta} />
          ))}
        </div>
      </section>

      {/* ======================================================
          FEATURED PROPERTIES
          ====================================================== */}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="flex items-center justify-between mb-8">

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">
              Opportunities worth exploring
            </h2>

            <p className="text-ink-500 mt-1">
              Explore a carefully presented selection of verified homes, land, commercial spaces, development opportunities and short stays available through HighPark Consult.
            </p>
          </div>

          <Link
            to="/properties"
            className="hidden sm:flex btn-secondary"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>

        </div>

        <div className="relative overflow-hidden rounded-[2rem] border border-ink-100 bg-ink-50 p-3 sm:p-4">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16" />
          {loading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 p-2">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : properties.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {properties.map((property, index) => (
                <div key={`${property.id}-${index}`} className="min-w-0">
                  <FeaturedPropertyCard property={property} />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {!loading &&
          properties.length === 0 && (
            <div className="text-center py-16">
              <p className="text-ink-500">
                No verified opportunities are available right now.
                Once an administrator verifies a listing, it will appear here automatically.
              </p>
            </div>
          )}

        <div className="text-center mt-8 sm:hidden">

          <Link
            to="/properties"
            className="btn-primary"
          >
            View All Opportunities
          </Link>

        </div>

      </section>

      {/* ======================================================
          HOMEPAGE JOURNEY / SITE MAP
          ====================================================== */}

      <section id="platform" className="border-y border-ink-100 bg-ink-50/70 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="section-kicker">From discovery to management</p>
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">One trusted platform for the complete property journey</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">
                From the first search to the next stage of ownership, tenancy, investment or hospitality, HighPark Consult brings discovery, communication, transactions and property management into one connected experience.
              </p>
            </div>
            <Link to="/properties" className="btn-secondary shrink-0">Open full marketplace <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { icon: <Search className="h-5 w-5" />, number: '01', title: 'Discover', desc: 'Search verified homes, commercial spaces, land, plots, mixed-use assets and short-stay opportunities by location and purpose.', links: [['Marketplace', '/properties'], ['Property details', '/properties']], tone: 'brand' },
              { icon: <Users className="h-5 w-5" />, number: '02', title: 'Engage & transact', desc: 'Save opportunities, request a viewing, send an enquiry, reserve a stay or begin the next step with the HighPark team.', links: [['Create account', '/register'], ['Sign in', '/login']], tone: 'accent' },
              { icon: <Building2 className="h-5 w-5" />, number: '03', title: 'Operate & manage', desc: 'Customers, owners and administrators move into dedicated workspaces for leases, payments, maintenance, documents, messages and reporting.', links: [['Customer workspace', '/login'], ['Owner workspace', '/login']], tone: 'dark' },
            ].map((item) => (
              <div key={item.number} className="group rounded-3xl border border-ink-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between gap-4">
                  <div className={`grid h-11 w-11 place-items-center rounded-2xl ${item.tone === 'accent' ? 'bg-accent-50 text-accent-700' : item.tone === 'dark' ? 'bg-brand-950 text-white' : 'bg-brand-50 text-brand-700'}`}>
                    {item.icon}
                  </div>
                  <span className="text-4xl font-black tracking-tight text-ink-100">{item.number}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold text-ink-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-ink-500">{item.desc}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.links.map(([label, to]) => (
                    <Link key={label} to={to} className="inline-flex items-center gap-1.5 rounded-full border border-ink-200 bg-ink-50 px-3 py-1.5 text-xs font-semibold text-ink-700 transition hover:border-brand-200 hover:bg-brand-50 hover:text-brand-800">
                      {label} <ArrowRight className="h-3 w-3" />
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          PREMIUM PROPERTY CATEGORIES
          ====================================================== */}

      <section className="hp-navy-readable relative overflow-hidden bg-brand-950 py-16 text-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px from-transparent via-accent-400/80 to-transparent" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-accent-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-brand-500/20 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-300">Property, land & hospitality</p>
              <h2 className="mt-2 !text-white text-2xl font-bold sm:text-3xl">Choose an opportunity that fits your objective</h2>
              <p className="mt-2 max-w-2xl !text-white/80 text-sm leading-6">Whether your goal is to find a home, secure business space, acquire land, explore a development opportunity or book a short stay, start with the category that matches your objective.</p>
            </div>
            <Link to="/properties" className="btn-accent shrink-0">Explore all opportunities <ArrowRight className="h-4 w-4" /></Link>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ['Homes', 'Residential properties', <HomeIcon className="h-6 w-6" />, ''],
              ['Commercial', 'Offices & business spaces', <Building className="h-6 w-6" />, 'commercial'],
              ['Land & Plots', 'Development & investment land', <Map className="h-6 w-6" />, 'land'],
              ['Mixed Use', 'Multi-purpose assets', <Building2 className="h-6 w-6" />, 'mixed_use'],
              ['Short Stays', 'Flexible hospitality stays', <BedDouble className="h-6 w-6" />, 'short_stay'],
              ['For Sale', 'Ownership opportunities', <BadgeDollarSign className="h-6 w-6" />, 'sale'],
            ] as Array<[string, string, JSX.Element, string]>).map(([title, desc, icon, filter]) => (
              <Link key={title} to={filter === 'sale' ? '/properties?category=buy' : filter === 'land' ? '/properties?category=land' : filter === 'short_stay' ? '/properties?category=short_stay' : filter ? `/properties?asset_class=${filter}` : '/properties'} className="group rounded-2xl border border-white/10 bg-white/[0.06] p-4 transition-all hover:-translate-y-1 hover:bg-white/10 hover:shadow-2xl">
                <div className="text-accent-300">{icon}</div>
                <h3 className="mt-4 text-sm font-bold text-white">{title}</h3>
                <p className="mt-1 text-xs leading-5 text-brand-200">{desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent-300">Explore <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          PAGE-BY-PAGE EXPERIENCE PREVIEWS
          ====================================================== */}

      <section id="experiences" className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-12 max-w-3xl text-center">
            <p className="section-kicker">Explore the platform</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">From the first search to the next step, we stay with you</h2>
            <p className="mt-3 text-sm leading-6 text-ink-500">
              HighPark Consult is designed to make property decisions clearer and property relationships easier to manage — whether you are searching, renting, buying, investing, hosting or managing a portfolio.
            </p>
          </div>

          <div className="space-y-5">
            {[
              {
                eyebrow: 'Marketplace',
                title: 'Properties, land, plots & stays',
                desc: 'Search the marketplace by location, asset type and purpose. Compare verified opportunities and open a full listing for the information you need before making contact.',
                icon: <Building2 className="h-6 w-6" />,
                links: [['Browse properties', '/properties'], ['Explore land & plots', '/properties?asset_class=land'], ['Explore short stays', '/properties?operation=short_stay']],
                bullets: ['Verified inventory', 'Map/location information', 'Asset-aware property presentation'],
                side: 'left',
              },
              {
                eyebrow: 'Property details',
                title: 'Inspect an opportunity before you enquire',
                desc: 'Review photos, location, pricing, availability and asset-specific information on a dedicated listing page, then enquire, request a viewing or reserve where available.',
                icon: <MapPin className="h-6 w-6" />,
                links: [['Open marketplace', '/properties'], ['Ask HighPark AI', '/properties']],
                bullets: ['Location & map context', 'Land-specific information', 'Enquiry and reservation pathways'],
                side: 'right',
              },
              {
                eyebrow: 'Customer workspace',
                title: 'Your saved properties, bookings & tenancy journey',
                desc: 'Your customer workspace keeps reservations, viewings, rent, leases, maintenance, documents and messages together, so important property matters are easy to follow.',
                icon: <ClipboardList className="h-6 w-6" />,
                links: [['Create account', '/register'], ['Sign in', '/login']],
                bullets: ['Reservations & viewings', 'Rent, lease & maintenance', 'Messages & documents'],
                side: 'left',
              },
              {
                eyebrow: 'Owner workspace',
                title: 'Run the property portfolio from one command centre',
                desc: 'Owners can manage properties and units alongside reservations, expenses, tax, maintenance, tenants, payments, reports, documents, sales and short-stay operations.',
                icon: <BarChart3 className="h-6 w-6" />,
                links: [['Owner dashboard', '/login'], ['Owner properties', '/login']],
                bullets: ['Universal asset portfolio', 'Financial & operational controls', 'Customer enquiries & messaging'],
                side: 'right',
              },
              {
                eyebrow: 'Support & trust',
                title: 'About, FAQs and direct contact',
                desc: 'Learn about HighPark Consult, find answers to common questions and contact the team directly when you need assistance with a property or service.',
                icon: <HelpCircle className="h-6 w-6" />,
                links: [['About HighPark', '/about'], ['FAQs', '/faqs'], ['Contact us', '/contact']],
                bullets: ['Company information', 'Frequently asked questions', 'Direct contact options'],
                side: 'left',
              },
            ].map((item) => (
              <div key={item.title} className={`grid overflow-hidden rounded-[2rem] border border-ink-100 ${item.side === 'right' ? 'from-brand-50/80 via-white to-accent-50/50' : 'from-white via-ink-50/70 to-brand-50/70'} shadow-sm lg:grid-cols-[1fr_.95fr]`}>
                <div className={`p-7 sm:p-9 ${item.side === 'right' ? 'lg:order-2' : ''}`}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-950 text-white shadow-lg">{item.icon}</div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-600">{item.eyebrow}</span>
                  </div>
                  <h3 className="mt-5 text-2xl font-bold tracking-tight text-ink-950">{item.title}</h3>
                  <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-600">{item.desc}</p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {item.links.map(([label, to]) => (
                      <Link key={label} to={to} className="btn-secondary text-xs">{label} <ArrowRight className="h-3.5 w-3.5" /></Link>
                    ))}
                  </div>
                </div>
                <div className={`flex items-center p-7 sm:p-9 ${item.side === 'right' ? 'lg:order-1' : ''}`}>
                  <div className="w-full rounded-3xl border border-white/80 bg-white/80 p-5 shadow-inner backdrop-blur">
                    <div className="mb-4 flex items-center justify-between border-b border-ink-100 pb-3">
                      <span className="text-xs font-bold uppercase tracking-[0.16em] text-ink-400">HighPark experience</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-bold text-brand-700"><ShieldCheck className="h-3 w-3" /> Connected</span>
                    </div>
                    <div className="space-y-3">
                      {item.bullets.map((bullet, index) => (
                        <div key={bullet} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3.5">
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-accent-50 text-accent-700">{index === 0 ? <CalendarCheck className="h-4 w-4" /> : index === 1 ? <MessageSquare className="h-4 w-4" /> : <Settings className="h-4 w-4" />}</span>
                          <span className="text-sm font-semibold text-ink-700">{bullet}</span>
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

      {/* ======================================================
          PLATFORM ROLES
          ====================================================== */}

      <section id="roles" className="hp-navy-readable hp-premium-glow bg-brand-950 py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 max-w-3xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-accent-300">Built for every side of property</p>
            <h2 className="mt-2 !text-white text-2xl font-bold sm:text-3xl">The right workspace for every relationship</h2>
            <p className="mt-3 !text-brand-100 text-sm leading-6">HighPark brings property discovery and day-to-day operations together. Each user gets the tools and information relevant to their role, with secure access to their own workspace.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { title: 'Customer', icon: <Users className="h-5 w-5" />, desc: 'Find a property, save favourites, make enquiries, arrange viewings, manage bookings and keep up with tenancy matters.', cta: 'Create customer account', to: '/register' },
              { title: 'Property Owner', icon: <Building2 className="h-5 w-5" />, desc: 'Manage a complete portfolio across homes, commercial assets, land, mixed-use properties and short stays.', cta: 'Owner sign in', to: '/login' },
              { title: 'Administrator', icon: <ShieldCheck className="h-5 w-5" />, desc: 'Maintain verified inventory, oversee users and operations, monitor compliance and keep the platform running smoothly.', cta: 'Administrator sign in', to: '/login' },
            ].map((role) => (
              <div key={role.title} className="hp-role-card rounded-3xl border border-white/10 bg-white/[0.06] p-6 transition hover:-translate-y-1 hover:bg-white/[0.09]">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-white/10 text-accent-300">{role.icon}</div>
                <h3 className="mt-5 !text-white text-lg font-bold">{role.title}</h3>
                <p className="mt-2 !text-brand-100 text-sm leading-6">{role.desc}</p>
                <Link to={role.to} className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-accent-300 hover:text-accent-200">{role.cta} <ArrowRight className="h-4 w-4" /></Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======================================================
          HOW IT WORKS
          ====================================================== */}

      <section className="bg-white py-16">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-12">

            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">
              A straightforward property journey
            </h2>

            <p className="text-ink-500 mt-2">
              Search, enquire, transact and manage through one connected experience.
            </p>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {[
              {
                icon: <Search className="w-6 h-6" />,
                title: 'Search & Browse',
                desc: 'Explore verified homes, commercial spaces, land, development assets and short stays by location, asset type and purpose.',
              },
              {
                icon: <Wallet className="w-6 h-6" />,
                title: 'Enquire or Reserve',
                desc: 'Send an enquiry, request a viewing, reserve an available stay or take the next step toward a property transaction.',
              },
              {
                icon: <FileText className="w-6 h-6" />,
                title: 'Sign Tenancy Agreement',
                desc: 'Where a tenancy applies, complete the required registration and lease documentation through the customer journey.',
              },
              {
                icon: <HomeIcon className="w-6 h-6" />,
                title: 'Move In & Pay Rent',
                desc: 'Keep track of rent, invoices, maintenance requests, documents and other ongoing tenancy services.',
              },
            ].map((step, i) => (
              <div
                key={i}
                className="relative card p-6"
              >

                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mb-4">
                  {step.icon}
                </div>

                <div className="absolute top-6 right-6 text-4xl font-bold text-ink-100">
                  0{i + 1}
                </div>

                <h3 className="font-semibold text-ink-900 mb-2">
                  {step.title}
                </h3>

                <p className="text-sm text-ink-500">
                  {step.desc}
                </p>

              </div>
            ))}

          </div>
        </div>
      </section>

      {/* ======================================================
          FEATURES
          ====================================================== */}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {[
            {
              icon: <ShieldCheck className="w-6 h-6" />,
              title: 'Verified Properties Only',
              desc: 'Listings are presented through HighPark’s verification workflow so customers can make decisions using the information available on the platform.',
            },
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Instant Online Reservation',
              desc: 'Where online reservation is enabled, customers can secure available opportunities through a streamlined digital process.',
            },
            {
              icon: <TrendingUp className="w-6 h-6" />,
              title: 'Full Tenancy Management',
              desc: 'Keep rent, invoices, maintenance, lease information and customer communications organised in one workspace.',
            },
          ].map((feature) => (
            <div
              key={feature.title}
              className="card p-6"
            >

              <div className="w-12 h-12 rounded-xl bg-accent-50 text-accent-600 flex items-center justify-center mb-4">
                {feature.icon}
              </div>

              <h3 className="font-semibold text-ink-900 mb-2">
                {feature.title}
              </h3>

              <p className="text-sm text-ink-500">
                {feature.desc}
              </p>

            </div>
          ))}

        </div>
      </section>

      {/* ======================================================
          POPULAR LOCATIONS
          ====================================================== */}

      <section className="bg-white py-16">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <h2 className="text-2xl sm:text-3xl font-bold text-ink-900 mb-8 text-center">
            Explore popular locations
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">

            {[
              {
                name: 'Nairobi',
                count: '250+ properties',
              },
              {
                name: 'Mombasa',
                count: '80+ properties',
              },
              {
                name: 'Kisumu',
                count: '45+ properties',
              },
              {
                name: 'Nakuru',
                count: '40+ properties',
              },
              {
                name: 'Kiambu',
                count: '35+ properties',
              },
              {
                name: 'Eldoret',
                count: '30+ properties',
              },
            ].map((location) => (
              <Link
                key={location.name}
                to={`/properties?location=${encodeURIComponent(
                  location.name
                )}`}
                className="card p-5 text-center hover:border-brand-300 hover:shadow-md transition-all"
              >

                <div className="w-12 h-12 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-6 h-6" />
                </div>

                <h3 className="font-semibold text-ink-900">
                  {location.name}
                </h3>

                <p className="text-xs text-ink-400 mt-1">
                  {location.count}
                </p>

              </Link>
            ))}

          </div>
        </div>
      </section>

      {/* ======================================================
          AI ASSISTANT
          ====================================================== */}

      <section id="ai-assistant" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="overflow-hidden rounded-[2rem] border border-brand-200 bg-brand-950 p-7 text-white shadow-xl sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-accent-200"><Bot className="h-3.5 w-3.5" /> HighPark AI Assistant</div>
              <h2 className="mt-4 !text-white text-2xl font-bold sm:text-3xl">Get answers while you search</h2>
              <p className="mt-3 max-w-2xl !text-brand-100 text-sm leading-7">Ask about available properties, land and plots, rental or sale opportunities, short stays, locations, pricing and the best way to make an enquiry.</p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
                {['Property search', 'Land & plots', 'Rent & sale', 'Short stays', 'Location', 'Enquiries'].map((topic) => <span key={topic} className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-brand-100">{topic}</span>)}
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/[0.08] p-5">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4"><div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/10"><Bot className="h-5 w-5 text-accent-300" /></div><div><p className="text-sm font-bold">Property-aware assistance</p><p className="!text-brand-200 text-[11px]">Ask from any public page</p></div></div>
              <div className="mt-4 space-y-2">
                <div className="rounded-2xl bg-white/10 p-3 !text-brand-100 text-xs">“Show me available land in Kenya.”</div>
                <div className="ml-8 rounded-2xl bg-accent-400/15 p-3 !text-accent-100 text-xs">“I’ll show you the verified land and plot opportunities available on HighPark.”</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================
          TESTIMONIALS
          ====================================================== */}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="text-center mb-12">

          <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">
            Property should feel simpler, clearer and more dependable
          </h2>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {[
            {
              name: 'Wanjiru K.',
              role: 'Tenant, Kilimani',
              text: 'I found my apartment in two days and reserved it online. The whole process was smooth and transparent.',
            },
            {
              name: 'Mwangi O.',
              role: 'Property Owner, Westlands',
              text: 'Managing 12 units used to be a headache. Now I track rent, expenses, and taxes all in one dashboard.',
            },
            {
              name: 'Aisha N.',
              role: 'Tenant, Mombasa',
              text: "The M-Pesa rent payment feature is a game changer. No more queuing at the agent's office every month.",
            },
          ].map((testimonial) => (
            <div
              key={testimonial.name}
              className="card p-6"
            >

              <div className="flex gap-1 mb-4">

                {Array.from({ length: 5 }).map(
                  (_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 text-accent-400 fill-accent-400"
                    />
                  )
                )}

              </div>

              <p className="text-ink-600 text-sm mb-4">
                "{testimonial.text}"
              </p>

              <div>

                <p className="font-semibold text-ink-900">
                  {testimonial.name}
                </p>

                <p className="text-xs text-ink-400">
                  {testimonial.role}
                </p>

              </div>

            </div>
          ))}

        </div>
      </section>

      {/* ======================================================
          CTA
          ====================================================== */}

      <section className="home-final-cta max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        <div className="bg-brand-900 rounded-3xl p-8 sm:p-12 text-center">

          <h2 className="!text-white text-2xl sm:text-3xl font-bold mb-4">
            Your next property decision starts here.
          </h2>

          <p className="text-brand-100 mb-8 max-w-xl mx-auto">
            Explore verified opportunities, compare what matters, and connect with HighPark Consult when you are ready to take the next step. We bring the marketplace and the management journey together so you can move forward with greater confidence.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">

            <Link
              to="/properties"
              className="btn-accent"
            >
              Browse Properties, Land & Stays
            </Link>

            <Link
              to="/register"
              className="btn-secondary bg-white text-brand-700 border-white hover:bg-brand-50"
            >
              Create Account
            </Link>

          </div>

        </div>
      </section>

    </div>
  );
}

/* ============================================================
   FEATURED PROPERTY CARD
   ============================================================ */

function FeaturedPropertyCard({ property }: { property: PropertyWithUnits }) {
  const image = property.photos?.[0] || getPropertyImage(property.property_type);
  const view = getPropertyPresentation(property.asset_class, property.operation_model, property.property_type);
  const isLand = view.kind === 'land';
  const opportunity = property.min_monthly_rent ? `${formatKES(property.min_monthly_rent)}/mo` : property.sale_min_price ? `From ${formatKES(property.sale_min_price)}` : property.short_stay_min_rate ? `${formatKES(property.short_stay_min_rate)}/night` : 'Enquire for details';

  return (
    <Link
      to={`/property/${property.id}`}
      aria-label={`View full details for ${property.name}`}
      className="card group block h-full overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30"
    >
      <div className="relative h-48 overflow-hidden bg-ink-100">
        <img src={image} alt={property.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]" loading="lazy" />
      </div>
      <div className="p-4">
        <h3 className="truncate font-semibold text-ink-900">{property.name}</h3>
        <p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-3.5 w-3.5" /> {property.estate ? `${property.estate}, ` : ''}{property.town}, {property.county}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="badge bg-ink-100 text-ink-600">{view.label}</span>
          <span className="badge bg-brand-50 text-brand-700">{property.property_type}</span>
          {isLand && property.total_land_area && <span className="badge bg-accent-50 text-accent-700">{property.total_land_area} {property.land_area_unit || 'acres'}</span>}
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-ink-100 pt-3">
          <div className="min-w-0">
            <p className="text-lg font-bold text-brand-700">{isLand ? 'Enquire for land price' : opportunity}</p>
            {isLand ? <p className="text-xs text-ink-400">{property.plot_count || 0} plots · {property.plot_dimensions || 'dimensions on enquiry'}</p> : property.available_units > 0 && <p className="text-xs text-ink-400">{property.available_units} {view.inventoryLabel.toLowerCase()} available</p>}
          </div>
          <span className="shrink-0 text-sm font-semibold text-brand-600 group-hover:text-accent-700">View Details <ArrowRight className="ml-1 inline h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></span>
        </div>
      </div>
    </Link>
  );
}

