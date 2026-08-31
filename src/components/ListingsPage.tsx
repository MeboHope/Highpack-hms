import { useState, useEffect, useCallback } from 'react';
import { Search, SlidersHorizontal, Grid, List, MapPin, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Property, PropertyImage, Favorite } from '@/lib/types';
import { PROPERTY_TYPES, KENYAN_COUNTIES, propertyTypeLabel } from '@/lib/utils';
import { LoadingScreen, EmptyState } from '@/components/ui';
import { PropertyCard } from '@/components/public/PropertyCard';
import { useAuth } from '@/lib/auth';

interface ListingsPageProps {
  navigate: (path: string) => void;
  query: URLSearchParams;
}

export function ListingsPage({ navigate, query }: ListingsPageProps) {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [images, setImages] = useState<Record<string, PropertyImage[]>>({});
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('newest');

  const [filters, setFilters] = useState({
    location: query.get('location') ?? '',
    type: query.get('type') ?? '',
    minPrice: query.get('minPrice') ?? '',
    maxPrice: query.get('maxPrice') ?? '',
    bedrooms: query.get('bedrooms') ?? '',
    bathrooms: '',
    furnished: '',
    availability: '',
  });

  const loadProperties = useCallback(async () => {
    setLoading(true);
    let q = supabase.from('properties').select('*').eq('is_published', true);

    if (filters.location) q = q.or(`county.ilike.%${filters.location}%,town.ilike.%${filters.location}%,estate.ilike.%${filters.location}%`);
    if (filters.type) q = q.eq('property_type', filters.type);
    if (filters.minPrice) q = q.gte('monthly_rent', filters.minPrice);
    if (filters.maxPrice) q = q.lte('monthly_rent', filters.maxPrice);
    if (filters.bedrooms) q = q.gte('bedrooms', parseInt(filters.bedrooms));
    if (filters.bathrooms) q = q.gte('bathrooms', parseInt(filters.bathrooms));
    if (filters.furnished) q = q.eq('furnished', filters.furnished === 'yes');
    if (filters.availability) q = q.eq('availability_status', filters.availability);

    switch (sortBy) {
      case 'price_low': q = q.order('monthly_rent', { ascending: true }); break;
      case 'price_high': q = q.order('monthly_rent', { ascending: false }); break;
      case 'featured': q = q.order('is_featured', { ascending: false }).order('created_at', { ascending: false }); break;
      default: q = q.order('created_at', { ascending: false });
    }

    const { data } = await q;
    const props = (data ?? []) as Property[];
    setProperties(props);

    if (props.length > 0) {
      const { data: imgData } = await supabase
        .from('property_images')
        .select('*')
        .in('property_id', props.map((p) => p.id))
        .order('sort_order', { ascending: true });
      const imgMap: Record<string, PropertyImage[]> = {};
      (imgData ?? []).forEach((img) => {
        if (!imgMap[img.property_id]) imgMap[img.property_id] = [];
        imgMap[img.property_id].push(img);
      });
      setImages(imgMap);
    }
    setLoading(false);
  }, [filters, sortBy]);

  useEffect(() => { loadProperties(); }, [loadProperties]);

  useEffect(() => {
    if (!user) return;
    supabase.from('favorites').select('property_id').eq('customer_id', user.id).then(({ data }) => {
      if (data) setFavorites(new Set((data as Favorite[]).map((f) => f.property_id)));
    });
  }, [user]);

  const toggleFavorite = async (propertyId: string) => {
    if (!user) { navigate('/signin'); return; }
    if (favorites.has(propertyId)) {
      await supabase.from('favorites').delete().eq('property_id', propertyId).eq('customer_id', user.id);
      setFavorites(new Set([...favorites].filter((id) => id !== propertyId)));
    } else {
      await supabase.from('favorites').insert({ property_id: propertyId, customer_id: user.id });
      setFavorites(new Set([...favorites, propertyId]));
    }
  };

  const updateFilter = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    setFilters({ location: '', type: '', minPrice: '', maxPrice: '', bedrooms: '', bathrooms: '', furnished: '', availability: '' });
  };

  const hasActiveFilters = Object.values(filters).some((v) => v !== '');

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Browse Properties</h1>
              <p className="text-sm text-slate-500">{properties.length} properties found</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
              >
                <option value="newest">Newest First</option>
                <option value="price_low">Price: Low to High</option>
                <option value="price_high">Price: High to Low</option>
                <option value="featured">Featured</option>
              </select>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </button>
              <div className="hidden items-center rounded-lg border border-slate-300 bg-white sm:flex">
                <button onClick={() => setView('grid')} className={`p-2 ${view === 'grid' ? 'text-teal-700' : 'text-slate-400'}`}><Grid className="h-4 w-4" /></button>
                <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'text-teal-700' : 'text-slate-400'}`}><List className="h-4 w-4" /></button>
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Location</label>
                  <select value={filters.location} onChange={(e) => updateFilter('location', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">All Locations</option>
                    {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Property Type</label>
                  <select value={filters.type} onChange={(e) => updateFilter('type', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">All Types</option>
                    {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Min Price</label>
                  <input type="number" placeholder="0" value={filters.minPrice} onChange={(e) => updateFilter('minPrice', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Max Price</label>
                  <input type="number" placeholder="Any" value={filters.maxPrice} onChange={(e) => updateFilter('maxPrice', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Bedrooms</label>
                  <select value={filters.bedrooms} onChange={(e) => updateFilter('bedrooms', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Bathrooms</label>
                  <select value={filters.bathrooms} onChange={(e) => updateFilter('bathrooms', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Any</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Furnished</label>
                  <select value={filters.furnished} onChange={(e) => updateFilter('furnished', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Any</option>
                    <option value="yes">Furnished</option>
                    <option value="no">Unfurnished</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Availability</label>
                  <select value={filters.availability} onChange={(e) => updateFilter('availability', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="">Any</option>
                    <option value="available">Available</option>
                    <option value="reserved">Reserved</option>
                    <option value="occupied">Occupied</option>
                  </select>
                </div>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="mt-3 flex items-center gap-1 text-sm text-red-600 hover:text-red-700">
                  <X className="h-4 w-4" /> Clear all filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {loading ? (
          <LoadingScreen message="Loading properties..." />
        ) : properties.length === 0 ? (
          <EmptyState
            icon={<Search className="h-12 w-12" />}
            title="No properties found"
            message="Try adjusting your filters or search criteria"
            action={hasActiveFilters ? <button onClick={clearFilters} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800">Clear Filters</button> : undefined}
          />
        ) : (
          <div className={view === 'grid' ? "grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" : "flex flex-col gap-4"}>
            {properties.map((prop) => (
              <div key={prop.id} className={view === 'list' ? '' : ''}>
                <PropertyCard
                  property={prop}
                  images={images[prop.id]}
                  isFavorite={favorites.has(prop.id)}
                  onFavorite={toggleFavorite}
                  onClick={(id) => navigate(`/properties/${id}`)}
                />
                {view === 'list' && (
                  <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {prop.county}, {prop.town}</span>
                    <span>{propertyTypeLabel(prop.property_type)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
