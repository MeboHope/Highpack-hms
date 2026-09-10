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
import highparkLogo from '@/assets/highpark-logo-clean.png';

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

/* ============================================================
   ANIMATED STATISTICS
   ============================================================ */

function AnimatedStat({
  value,
  suffix = '',
  prefix = '',
  label,
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
    <div
      ref={statRef}
      className="text-center"
    >
      <p className="text-2xl sm:text-3xl font-bold text-white tabular-nums">
        {prefix}
        {count.toLocaleString()}
        {suffix}
      </p>

      <p className="text-sm text-brand-200">
        {label}
      </p>
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
    { value: 0, suffix: '+', label: 'Verified Properties' },
    { value: 0, suffix: '+', label: 'Available Properties' },
    { value: 0, suffix: '+', label: 'Counties Covered' },
    { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation Hold' },
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
        { value: verifiedCount, suffix: '+', label: 'Verified Assets' },
        { value: Number(statRow?.available_homes || availableCount), suffix: '+', label: 'Available Opportunities' },
        { value: Number(statRow?.counties_covered || countyCount), suffix: '+', label: 'Counties Covered' },
        { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation / Enquiry Hold' },
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

      <section className="hero-premium relative overflow-hidden rounded-b-[2.5rem] shadow-[0_24px_80px_rgba(13,35,66,.18)]">

        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-accent-400/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
        <img src={highparkLogo} alt="" aria-hidden="true" className="absolute right-[4%] top-1/2 hidden w-[28rem] -translate-y-1/2 opacity-[0.055] grayscale invert lg:block" />

        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">

          {/* Hero heading */}
          <div className="mx-auto mb-10 max-w-4xl text-center">
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-100 backdrop-blur"><ShieldCheck className="h-4 w-4" /> Verified property opportunities · Kenya</div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              Find Your Next Property Opportunity in Kenya
            </h1>

            <p className="text-lg text-brand-100 max-w-2xl mx-auto">
              Browse verified homes, land, commercial spaces and short-stay properties — with reservations, sales and management tools in one place.
            </p>

          </div>

          {/* ==================================================
              SEARCH CARD
              ================================================== */}

          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-soft-lg ring-1 ring-white/40 p-4 sm:p-6 max-w-5xl mx-auto">

            <form onSubmit={handleSearch} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div><label className="label">Location</label><select className="input" value={search.location} onChange={(e) => setSearch({ ...search, location: e.target.value })}><option value="">All locations</option>{KENYAN_COUNTIES.map((county) => <option key={county}>{county}</option>)}</select></div>
              <div><label className="label">Asset Class</label><select className="input" value={search.assetClass} onChange={(e) => setSearch({ ...search, assetClass: e.target.value })}><option value="">All assets</option>{ASSET_CLASS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div><label className="label">Opportunity</label><select className="input" value={search.operation} onChange={(e) => setSearch({ ...search, operation: e.target.value })}><option value="">Any opportunity</option>{OPERATION_MODEL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              <div className="flex items-end"><button type="submit" className="btn-primary w-full"><Search className="h-4 w-4" /> Search Opportunities</button></div>
            </form>
          </div>

          {/* ==================================================
              ANIMATED STATISTICS
              ================================================== */}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 max-w-4xl mx-auto">

            {stats.map((stat) => (
              <AnimatedStat
                key={stat.label}
                value={stat.value}
                suffix={stat.suffix}
                prefix={stat.prefix}
                label={stat.label}
              />
            ))}

          </div>

        </div>
      </section>

      {/* ======================================================
          FEATURED PROPERTIES
          ====================================================== */}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="flex items-center justify-between mb-8">

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">
              Featured Property Opportunities
            </h2>

            <p className="text-ink-500 mt-1">
              Handpicked property, land & stay opportunities
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

          {loading
            ? Array.from({ length: 6 }).map(
                (_, i) => (
                  <SkeletonCard key={i} />
                )
              )
            : properties.map((property) => (
                <FeaturedPropertyCard
                  key={property.id}
                  property={property}
                />
              ))}

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
          HOW IT WORKS
          ====================================================== */}

      <section className="bg-white py-16">

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          <div className="text-center mb-12">

            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">
              How It Works
            </h2>

            <p className="text-ink-500 mt-2">
              From discovery to management in four simple steps
            </p>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {[
              {
                icon: <Search className="w-6 h-6" />,
                title: 'Search & Browse',
                desc: 'Explore verified property, land, development and hospitality opportunities by location and use.',
              },
              {
                icon: <Wallet className="w-6 h-6" />,
                title: 'Enquire or Reserve',
                desc: 'Enquire, reserve a stay, submit an offer or start a property transaction.',
              },
              {
                icon: <FileText className="w-6 h-6" />,
                title: 'Sign Tenancy Agreement',
                desc: 'Complete your registration and sign your lease electronically.',
              },
              {
                icon: <HomeIcon className="w-6 h-6" />,
                title: 'Move In & Pay Rent',
                desc: 'Pay your rent online, track invoices, and manage maintenance.',
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
              desc: 'Every property is verified by our team before listing. No fake listings, no surprises.',
            },
            {
              icon: <Zap className="w-6 h-6" />,
              title: 'Instant Online Reservation',
              desc: 'Reserve any available unit in minutes with M-Pesa or card. No more rushing to view properties.',
            },
            {
              icon: <TrendingUp className="w-6 h-6" />,
              title: 'Full Tenancy Management',
              desc: 'Pay rent, track invoices, submit maintenance, and manage your lease — all from your phone.',
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
            Popular Locations
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
          TESTIMONIALS
          ====================================================== */}

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="text-center mb-12">

          <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">
            What Our Users Say
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

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        <div className="bg-gradient-to-br from-brand-700 to-brand-800 rounded-3xl p-8 sm:p-12 text-center">

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Ready to Find Your Next Property Opportunity?
          </h2>

          <p className="text-brand-100 mb-8 max-w-xl mx-auto">
            Explore verified property, land and hospitality opportunities with HighPark Consult. Browse, enquire, reserve or pursue a sale opportunity online.
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
  const isSale = property.sale_listing_count > 0 || ['sale','land_sale'].includes(property.operation_model);
  const isStay = property.short_stay_listing_count > 0 || property.operation_model === 'short_stay';
  const opportunity = property.min_monthly_rent ? `${formatKES(property.min_monthly_rent)}/mo` : property.sale_min_price ? `From ${formatKES(property.sale_min_price)}` : property.short_stay_min_rate ? `${formatKES(property.short_stay_min_rate)}/night` : 'Enquire for details';
  return <Link to={`/property/${property.id}`} className="card group overflow-hidden transition-all hover:-translate-y-1 hover:shadow-soft-lg">
    <div className="relative h-48 overflow-hidden bg-ink-100"><img src={image} alt={property.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /><div className="absolute left-3 top-3 flex flex-wrap gap-1.5"><span className="badge bg-brand-600 text-white"><ShieldCheck className="h-3 w-3" /> Verified</span>{isSale&&<span className="badge bg-accent-100 text-accent-800">For sale</span>}{isStay&&<span className="badge bg-white/95 text-brand-700">Short stay</span>}</div></div>
    <div className="p-4"><h3 className="truncate font-semibold text-ink-900">{property.name}</h3><p className="mt-1 flex items-center gap-1 text-sm text-ink-500"><MapPin className="h-3.5 w-3.5" /> {property.estate ? `${property.estate}, ` : ''}{property.town}, {property.county}</p><div className="mt-3 flex flex-wrap gap-1.5"><span className="badge bg-ink-100 text-ink-600">{view.label}</span><span className="badge bg-brand-50 text-brand-700">{property.property_type}</span>{isLand&&property.total_land_area&&<span className="badge bg-accent-50 text-accent-700">{property.total_land_area} {property.land_area_unit || 'acres'}</span>}</div><div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3"><div><p className="text-lg font-bold text-brand-700">{isLand ? 'Enquire for land price' : opportunity}</p>{isLand ? <p className="text-xs text-ink-400">{property.plot_count || 0} plots · {property.plot_dimensions || 'dimensions on enquiry'}</p> : property.available_units>0&&<p className="text-xs text-ink-400">{property.available_units} {view.inventoryLabel.toLowerCase()} available</p>}</div><span className="text-sm font-medium text-brand-600 group-hover:underline">View Details →</span></div></div>
  </Link>;
}
