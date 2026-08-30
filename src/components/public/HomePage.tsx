import { useState, useEffect } from 'react';
import { Search, MapPin, Home as HomeIcon, Bed, Bath, ArrowRight, TrendingUp, Shield, Users, Building2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Property, PropertyImage, SystemSettings } from '@/lib/types';
import { PROPERTY_TYPES, KENYAN_COUNTIES, formatKES } from '@/lib/utils';
import { PropertyCard } from '@/components/public/PropertyCard';

interface HomePageProps {
  navigate: (path: string) => void;
}

export function HomePage({ navigate }: HomePageProps) {
  const [featured, setFeatured] = useState<Property[]>([]);
  const [images, setImages] = useState<Record<string, PropertyImage[]>>({});
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState({ location: '', type: '', minPrice: '', maxPrice: '', bedrooms: '' });

  useEffect(() => {
    async function load() {
      const [featRes, settingsRes] = await Promise.all([
        supabase.from('properties').select('*').eq('is_published', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(6),
        supabase.from('system_settings').select('*').eq('id', 1).maybeSingle(),
      ]);
      const featuredProps = (featRes.data ?? []) as Property[];
      setFeatured(featuredProps);
      setSettings(settingsRes.data as SystemSettings | null);

      if (featuredProps.length > 0) {
        const { data: imgData } = await supabase
          .from('property_images')
          .select('*')
          .in('property_id', featuredProps.map((p) => p.id))
          .order('sort_order', { ascending: true });
        const imgMap: Record<string, PropertyImage[]> = {};
        (imgData ?? []).forEach((img) => {
          if (!imgMap[img.property_id]) imgMap[img.property_id] = [];
          imgMap[img.property_id].push(img);
        });
        setImages(imgMap);
      }
      setLoading(false);
    }
    load();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search.location) params.set('location', search.location);
    if (search.type) params.set('type', search.type);
    if (search.minPrice) params.set('minPrice', search.minPrice);
    if (search.maxPrice) params.set('maxPrice', search.maxPrice);
    if (search.bedrooms) params.set('bedrooms', search.bedrooms);
    navigate(`/properties?${params.toString()}`);
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-900">
        <div className="absolute inset-0">
          <img
            src="https://images.pexels.com/photos/8135492/pexels-photo-8135492.jpeg?auto=compress&cs=tinysrgb&w=1600"
            alt="Luxury property"
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-slate-900/70 via-slate-900/50 to-slate-900/80" />
        </div>
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Find Your Perfect Home in Kenya
            </h1>
            <p className="mt-4 text-lg text-slate-300 sm:text-xl">
              Browse thousands of properties across Nairobi, Mombasa, Kisumu, and beyond. Reserve your dream home in minutes.
            </p>
          </div>

          {/* Search Bar */}
          <div className="mx-auto mt-10 max-w-5xl rounded-2xl bg-white/95 p-4 shadow-2xl backdrop-blur-md sm:p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Location</label>
                <select
                  value={search.location}
                  onChange={(e) => setSearch({ ...search, location: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">All Locations</option>
                  {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Property Type</label>
                <select
                  value={search.type}
                  onChange={(e) => setSearch({ ...search, type: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Any Type</option>
                  {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Min Price (KSh)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={search.minPrice}
                  onChange={(e) => setSearch({ ...search, minPrice: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Bedrooms</label>
                <select
                  value={search.bedrooms}
                  onChange={(e) => setSearch({ ...search, bedrooms: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="">Any</option>
                  <option value="1">1+</option>
                  <option value="2">2+</option>
                  <option value="3">3+</option>
                  <option value="4">4+</option>
                  <option value="5">5+</option>
                </select>
              </div>
            </div>
            <button
              onClick={handleSearch}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-6 py-3 text-base font-semibold text-white transition-colors hover:bg-teal-800"
            >
              <Search className="h-5 w-5" />
              Search Properties
            </button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {[
              { icon: Building2, label: 'Properties Listed', value: '12,000+' },
              { icon: Users, label: 'Happy Tenants', value: '8,500+' },
              { icon: MapPin, label: 'Counties Covered', value: '14' },
              { icon: Shield, label: 'Secure Bookings', value: '100%' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                  <stat.icon className="h-6 w-6" />
                </div>
                <p className="mt-3 text-2xl font-bold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Properties */}
      <section className="bg-slate-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Featured Properties</h2>
              <p className="mt-1 text-slate-500">Discover our handpicked premium listings</p>
            </div>
            <button onClick={() => navigate('/properties')} className="hidden items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800 sm:flex">
              View All <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {loading ? (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((prop) => (
                <PropertyCard key={prop.id} property={prop} images={images[prop.id]} onClick={(id) => navigate(`/properties/${id}`)} />
              ))}
            </div>
          )}
          <div className="mt-8 text-center sm:hidden">
            <button onClick={() => navigate('/properties')} className="inline-flex items-center gap-1 text-sm font-semibold text-teal-700">
              View All Properties <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">How It Works</h2>
          <p className="mt-2 text-center text-slate-500">Reserve your dream property in 3 simple steps</p>
          <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-3">
            {[
              { icon: Search, title: 'Search & Discover', desc: 'Browse thousands of properties and filter by location, price, and amenities.' },
              { icon: HomeIcon, title: 'Reserve Your Home', desc: `Pay a reservation fee of ${settings ? formatKES(settings.reservation_fee) : 'KSh 2,000'} to secure your chosen property.` },
              { icon: TrendingUp, title: 'Move In', desc: 'Complete your booking, schedule a viewing, and move into your new home.' },
            ].map((step, i) => (
              <div key={i} className="relative text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                  <step.icon className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-2 text-sm text-slate-500">{step.desc}</p>
                {i < 2 && (
                  <div className="absolute top-8 -right-4 hidden text-slate-300 md:block">
                    <ArrowRight className="h-6 w-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-teal-700 py-16">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-white">Ready to Find Your Next Home?</h2>
          <p className="mt-3 text-teal-100">Join thousands of Kenyans who found their perfect property with Nyumba254.</p>
          <button
            onClick={() => navigate('/properties')}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-8 py-3 text-base font-semibold text-teal-700 transition-colors hover:bg-teal-50"
          >
            Browse Properties <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>
    </div>
  );
}
