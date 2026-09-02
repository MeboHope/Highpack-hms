import { useState, useEffect, useRef } from 'react';
import {
  Search,
  MapPin,
  Home as HomeIcon,
  BedDouble,
  Bath,
  ArrowRight,
  Star,
  ShieldCheck,
  Zap,
  Wallet,
  FileText,
  TrendingUp,
} from 'lucide-react';

import { Link, useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import {
  formatKES,
  KENYAN_COUNTIES,
  PROPERTY_TYPES,
} from '@/lib/constants';
import { SkeletonCard } from '@/components/ui';
import { getPropertyImage } from '@/lib/images';
import highparkLogo from '@/assets/highpark-logo-clean.png';

interface PropertyWithUnits {
  id: string;
  name: string;
  county: string;
  town: string;
  estate: string | null;
  property_type: string;
  photos: string[];
  status: string;
  property_units: {
    monthly_rent: number;
    bedrooms: number;
    bathrooms: number;
    status: string;
  }[];
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
    { value: 0, suffix: '+', label: 'Available Homes' },
    { value: 0, suffix: '+', label: 'Counties Covered' },
    { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation Hold' },
  ]);

  const [search, setSearch] = useState({
    location: '',
    type: '',
    bedrooms: '',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ data: catalog, error: catalogError }, { data: siteStats, error: statsError }] = await Promise.all([
        supabase.rpc('get_public_property_catalog'),
        supabase.rpc('get_public_site_stats'),
      ]);

      if (catalogError) console.error('Home public catalog load error:', catalogError);
      if (statsError) console.error('Home public statistics load error:', statsError);

      const rows = (catalog || []) as Array<Record<string, unknown>>;
      const byProperty = new Map<string, PropertyWithUnits>();
      for (const row of rows) {
        const id = String(row.property_id);
        if (!byProperty.has(id)) {
          byProperty.set(id, {
            id,
            name: String(row.name ?? ''),
            county: String(row.county ?? ''),
            town: String(row.town ?? ''),
            estate: row.estate == null ? null : String(row.estate),
            property_type: String(row.property_type ?? ''),
            photos: Array.isArray(row.photos) ? row.photos.filter((photo): photo is string => typeof photo === 'string') : [],
            status: 'verified',
            property_units: [],
          });
        }
        if (row.unit_id) {
          byProperty.get(id)!.property_units.push({
            monthly_rent: Number(row.monthly_rent || 0),
            bedrooms: Number(row.bedrooms || 0),
            bathrooms: Number(row.bathrooms || 0),
            status: String(row.status || 'available'),
          });
        }
      }

      const props = Array.from(byProperty.values()).slice(0, 6);
      const fallbackVerified = byProperty.size;
      const fallbackAvailable = rows.filter((row) => row.unit_id && row.status === 'available').length;
      const fallbackCounties = new Set(rows.map((row) => row.county).filter((county) => typeof county === 'string' && county.trim())).size;
      const statRow = Array.isArray(siteStats) && siteStats.length ? siteStats[0] as Record<string, unknown> : null;

      const verifiedStat = Number(statRow?.verified_properties || 0);
      const availableStat = Number(statRow?.available_homes || 0);
      const countyStat = Number(statRow?.counties_covered || 0);
      const verifiedCount = statRow && (verifiedStat > 0 || fallbackVerified === 0) ? verifiedStat : fallbackVerified;
      const availableCount = statRow && (availableStat > 0 || fallbackAvailable === 0) ? availableStat : fallbackAvailable;
      const countyCount = statRow && (countyStat > 0 || fallbackCounties === 0) ? countyStat : fallbackCounties;

      setStats([
        { value: verifiedCount, suffix: '+', label: 'Verified Properties' },
        { value: availableCount, suffix: '+', label: 'Available Homes' },
        { value: countyCount, suffix: '+', label: 'Counties Covered' },
        { value: 24, prefix: '< ', suffix: 'h', label: 'Reservation Hold' },
      ]);

      if (!cancelled) {
        setProperties(props);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();

    if (search.location) {
      params.set('location', search.location);
    }

    if (search.type) {
      params.set('type', search.type);
    }

    if (search.bedrooms) {
      params.set('bedrooms', search.bedrooms);
    }

    navigate(
      `/properties?${params.toString()}`
    );
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
            <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-100 backdrop-blur"><ShieldCheck className="h-4 w-4" /> Verified homes · Kenya</div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-4 leading-tight">
              Find Your Next Home in Kenya
            </h1>

            <p className="text-lg text-brand-100 max-w-2xl mx-auto">
              Browse verified houses, reserve online for KSh 2,000,
              and manage your tenancy — all in one place.
            </p>

          </div>

          {/* ==================================================
              SEARCH CARD
              ================================================== */}

          <div className="bg-white/95 backdrop-blur rounded-3xl shadow-soft-lg ring-1 ring-white/40 p-4 sm:p-6 max-w-5xl mx-auto">

            <form
              onSubmit={handleSearch}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >

              {/* Location */}
              <div>
                <label className="label">
                  Location
                </label>

                <select
                  className="input"
                  value={search.location}
                  onChange={(e) =>
                    setSearch({
                      ...search,
                      location: e.target.value,
                    })
                  }
                >
                  <option value="">
                    All locations
                  </option>

                  {KENYAN_COUNTIES.map((county) => (
                    <option
                      key={county}
                      value={county}
                    >
                      {county}
                    </option>
                  ))}
                </select>
              </div>

              {/* Property Type */}
              <div>
                <label className="label">
                  Property Type
                </label>

                <select
                  className="input"
                  value={search.type}
                  onChange={(e) =>
                    setSearch({
                      ...search,
                      type: e.target.value,
                    })
                  }
                >
                  <option value="">
                    Any type
                  </option>

                  {PROPERTY_TYPES.map((type) => (
                    <option
                      key={type}
                      value={type}
                    >
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bedrooms */}
              <div>
                <label className="label">
                  Bedrooms
                </label>

                <select
                  className="input"
                  value={search.bedrooms}
                  onChange={(e) =>
                    setSearch({
                      ...search,
                      bedrooms: e.target.value,
                    })
                  }
                >
                  <option value="">
                    Any
                  </option>

                  <option value="0">
                    Bedsitter
                  </option>

                  <option value="1">
                    1+
                  </option>

                  <option value="2">
                    2+
                  </option>

                  <option value="3">
                    3+
                  </option>

                  <option value="4">
                    4+
                  </option>
                </select>
              </div>

              {/* Search button */}
              <div className="flex items-end">

                <button
                  type="submit"
                  className="btn-primary w-full"
                >
                  <Search className="w-4 h-4" />
                  Search Houses
                </button>

              </div>

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
              Featured Properties
            </h2>

            <p className="text-ink-500 mt-1">
              Handpicked homes ready for you to move in
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
                No verified properties are available right now.
                Once an administrator verifies a listing, it will appear here automatically.
              </p>
            </div>
          )}

        <div className="text-center mt-8 sm:hidden">

          <Link
            to="/properties"
            className="btn-primary"
          >
            View All Properties
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
              From search to keys in four simple steps
            </p>

          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">

            {[
              {
                icon: <Search className="w-6 h-6" />,
                title: 'Search & Browse',
                desc: 'Filter verified properties by location, type, price, and amenities.',
              },
              {
                icon: <Wallet className="w-6 h-6" />,
                title: 'Reserve for KSh 2,000',
                desc: 'Secure your chosen house online with a small reservation fee.',
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
            Ready to Find Your Home?
          </h2>

          <p className="text-brand-100 mb-8 max-w-xl mx-auto">
            Join thousands of Kenyans who found their next
            home with HighPark Consult. Browse verified
            properties and reserve online today.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">

            <Link
              to="/properties"
              className="btn-accent"
            >
              Browse Properties
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

function FeaturedPropertyCard({
  property,
}: {
  property: PropertyWithUnits;
}) {
  const units = property.property_units || [];

  const availableUnits = units.filter(
    (unit) => unit.status === 'available'
  );

  const minRent =
    units.length > 0
      ? Math.min(
          ...units.map(
            (unit) => unit.monthly_rent
          )
        )
      : 0;

  const firstUnit = units[0];

  const image =
    property.photos?.[0] ||
    getPropertyImage(
      property.property_type
    );

  return (
    <Link
      to={`/property/${property.id}`}
      className="card overflow-hidden hover:shadow-lg transition-all group"
    >

      {/* Image */}
      <div className="relative h-48 overflow-hidden bg-ink-100">

        <img
          src={image}
          alt={property.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />

        {/* Verified badge */}
        <div className="absolute top-3 left-3">

          <span className="badge bg-brand-600 text-white">
            <ShieldCheck className="w-3 h-3" />
            Verified
          </span>

        </div>

        {/* Available badge */}
        {availableUnits.length > 0 && (
          <div className="absolute top-3 right-3">

            <span className="badge bg-white/90 text-brand-700">
              {availableUnits.length} available
            </span>

          </div>
        )}

      </div>

      {/* Content */}
      <div className="p-4">

        <h3 className="font-semibold text-ink-900 mb-1 truncate">
          {property.name}
        </h3>

        <p className="text-sm text-ink-500 flex items-center gap-1 mb-3">

          <MapPin className="w-3.5 h-3.5" />

          {property.estate
            ? `${property.estate}, `
            : ''}

          {property.town}, {property.county}

        </p>

        <div className="flex items-center gap-3 text-sm text-ink-600 mb-3">

          {firstUnit && (
            <>
              <span className="flex items-center gap-1">
                <BedDouble className="w-4 h-4" />
                {firstUnit.bedrooms || 'Studio'}
              </span>

              <span className="flex items-center gap-1">
                <Bath className="w-4 h-4" />
                {firstUnit.bathrooms}
              </span>

              <span className="text-ink-400">
                ·
              </span>

              <span className="text-ink-500">
                {property.property_type}
              </span>
            </>
          )}

        </div>

        <div className="flex items-center justify-between pt-3 border-t border-ink-100">

          <div>

            {minRent > 0 && (
              <p className="text-lg font-bold text-brand-700">

                {formatKES(minRent)}

                <span className="text-sm font-normal text-ink-400">
                  /mo
                </span>

              </p>
            )}

          </div>

          <span className="text-sm font-medium text-brand-600 group-hover:underline">
            View Details →
          </span>

        </div>

      </div>
    </Link>
  );
}