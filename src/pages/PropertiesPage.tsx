import { useState, useEffect, useMemo } from 'react';
import { MapPin, BedDouble, Bath, SlidersHorizontal,  Grid3x3, Map as MapIcon, ShieldCheck, Search } from 'lucide-react';
import { Link, useRouter } from '@/context/RouterContext';
import { supabase } from '@/lib/supabase';
import { formatKES, KENYAN_COUNTIES, PROPERTY_TYPES } from '@/lib/constants';
import { SkeletonCard, EmptyState } from '@/components/ui';
import { getPropertyImage } from '@/lib/images';
import type { Property, PropertyUnit } from '@/lib/supabase';

interface PropertyRow extends Property {
  property_units: PropertyUnit[];
}

export function PropertiesPage() {
  const { path } = useRouter();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState<'list' | 'map'>('list');

  const params = useMemo(() => new URLSearchParams(path.split('?')[1] || ''), [path]);

  const [filters, setFilters] = useState({
    location: params.get('location') || '',
    type: params.get('type') || '',
    bedrooms: params.get('bedrooms') || '',
    minRent: '',
    maxRent: '',
    furnishing: '',
    parking: false,
    water: false,
    internet: false,
    pets: false,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      // Use the same controlled public catalogue as the Home page.
      // Direct table reads can be affected by existing/stale RLS policies in
      // an already-deployed Supabase project, while this RPC deliberately
      // exposes only verified public properties and their units.
      const { data: catalog, error: catalogError } = await supabase.rpc('get_public_property_catalog');
      if (catalogError) {
        console.error('Property marketplace catalog load error:', catalogError);
        if (!cancelled) { setProperties([]); setLoading(false); }
        return;
      }

      type CatalogRow = {
        property_id: string; name: string; description: string | null; property_type: string;
        county: string; sub_county: string | null; town: string; estate: string | null;
        address: string | null; number_of_units: number; number_of_floors: number;
        amenities: string[]; parking: boolean; water_availability: boolean; electricity: boolean;
        photos: string[]; created_at: string; unit_id: string | null; unit_number: string | null;
        floor: number | null; house_type: string | null; bedrooms: number | null;
        bathrooms: number | null; monthly_rent: number | null; reservation_fee: number | null;
        status: string | null; furnishing: string | null;
        unit_photos: string[] | null; unit_videos: string[] | null;
      };

      const byProperty = new Map<string, PropertyRow>();
      for (const row of (catalog || []) as CatalogRow[]) {
        if (!byProperty.has(row.property_id)) {
          byProperty.set(row.property_id, {
            id: row.property_id, owner_id: null, name: row.name, description: row.description,
            property_type: row.property_type, county: row.county, sub_county: row.sub_county,
            town: row.town, estate: row.estate, street: null, address: row.address,
            latitude: null, longitude: null, map_url: null, number_of_units: row.number_of_units || 0,
            number_of_floors: row.number_of_floors || 0, amenities: row.amenities || [],
            parking: !!row.parking, security_info: null, water_availability: !!row.water_availability,
            electricity: !!row.electricity, internet: false, pets_allowed: false,
            photos: row.photos || [], videos: [], audio: [], status: 'verified',
            created_at: row.created_at, updated_at: row.created_at, property_units: [],
          });
        }
        if (row.unit_id) {
          byProperty.get(row.property_id)!.property_units.push({
            id: row.unit_id, property_id: row.property_id, unit_number: row.unit_number || '',
            floor: row.floor, house_type: row.house_type, bedrooms: Number(row.bedrooms || 0),
            bathrooms: Number(row.bathrooms || 0), monthly_rent: Number(row.monthly_rent || 0),
            security_deposit: 0, reservation_fee: Number(row.reservation_fee || 0),
            service_charge: 0, water_charge: 0, parking_fee: 0, other_charges: 0,
            status: (row.status || 'unavailable') as PropertyUnit['status'],
            furnishing: (row.furnishing || 'unfurnished') as PropertyUnit['furnishing'],
            amenities: [], photos: row.unit_photos || [], videos: row.unit_videos || [],
            description: null, created_at: row.created_at, updated_at: row.created_at,
          });
        }
      }

      let results = Array.from(byProperty.values());
      const hasUnitFilters = filters.bedrooms !== '' || filters.minRent !== '' || filters.maxRent !== '' || filters.furnishing !== '';
      if (hasUnitFilters) results = results.filter((p) => p.property_units.some((u) => (filters.bedrooms === '' || u.bedrooms >= parseInt(filters.bedrooms)) && (!filters.minRent || u.monthly_rent >= parseInt(filters.minRent)) && (!filters.maxRent || u.monthly_rent <= parseInt(filters.maxRent)) && (!filters.furnishing || u.furnishing === filters.furnishing)));
      if (filters.parking) results = results.filter((p) => p.parking);
      if (filters.water) results = results.filter((p) => p.water_availability);
      if (filters.internet) results = results.filter((p) => p.internet);
      if (filters.pets) results = results.filter((p) => p.pets_allowed);
      results = results.filter((p) => p.property_units.some((u) => u.status === 'available') || !hasUnitFilters);
      if (!cancelled) { setProperties(results); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [filters]);

  const hasActiveFilters = Object.entries(filters).some(([k, v]) => k !== 'parking' && k !== 'water' && k !== 'internet' && k !== 'pets' ? v : v === true);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900">Browse Properties</h1>
          <p className="text-ink-500 mt-1">
            {loading ? 'Loading...' : `${properties.length} ${properties.length === 1 ? 'property' : 'properties'} found`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn-secondary ${showFilters ? 'bg-brand-50 border-brand-300 text-brand-700' : ''}`}
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
          <div className="flex rounded-xl border border-ink-200 overflow-hidden">
            <button
              className={`px-3 py-2 ${view === 'list' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'}`}
              onClick={() => setView('list')}
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
            <button
              className={`px-3 py-2 ${view === 'map' ? 'bg-brand-600 text-white' : 'bg-white text-ink-600'}`}
              onClick={() => setView('map')}
            >
              <MapIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="card p-5 mb-6 animate-slide-up">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-900">Filter Properties</h3>
            <button
              onClick={() => setFilters({ location: '', type: '', bedrooms: '', minRent: '', maxRent: '', furnishing: '', parking: false, water: false, internet: false, pets: false })}
              className="text-sm text-brand-600 hover:underline"
            >
              Clear all
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label">Location (County)</label>
              <select className="input" value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })}>
                <option value="">All</option>
                {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Property Type</label>
              <select className="input" value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })}>
                <option value="">All</option>
                {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Min Bedrooms</label>
              <select className="input" value={filters.bedrooms} onChange={(e) => setFilters({ ...filters, bedrooms: e.target.value })}>
                <option value="">Any</option>
                <option value="0">Bedsitter</option>
                <option value="1">1+</option>
                <option value="2">2+</option>
                <option value="3">3+</option>
                <option value="4">4+</option>
              </select>
            </div>
            <div>
              <label className="label">Furnishing</label>
              <select className="input" value={filters.furnishing} onChange={(e) => setFilters({ ...filters, furnishing: e.target.value })}>
                <option value="">Any</option>
                <option value="furnished">Furnished</option>
                <option value="semi_furnished">Semi-Furnished</option>
                <option value="unfurnished">Unfurnished</option>
              </select>
            </div>
            <div>
              <label className="label">Min Rent (KSh)</label>
              <input type="number" className="input" placeholder="0" value={filters.minRent} onChange={(e) => setFilters({ ...filters, minRent: e.target.value })} />
            </div>
            <div>
              <label className="label">Max Rent (KSh)</label>
              <input type="number" className="input" placeholder="Any" value={filters.maxRent} onChange={(e) => setFilters({ ...filters, maxRent: e.target.value })} />
            </div>
            <div className="sm:col-span-2 flex flex-wrap gap-4 items-end">
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={filters.parking} onChange={(e) => setFilters({ ...filters, parking: e.target.checked })} />
                Parking
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={filters.water} onChange={(e) => setFilters({ ...filters, water: e.target.checked })} />
                Water Available
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={filters.internet} onChange={(e) => setFilters({ ...filters, internet: e.target.checked })} />
                Internet
              </label>
              <label className="flex items-center gap-2 text-sm text-ink-700">
                <input type="checkbox" className="w-4 h-4 rounded text-brand-600" checked={filters.pets} onChange={(e) => setFilters({ ...filters, pets: e.target.checked })} />
                Pets Allowed
              </label>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : properties.length === 0 ? (
        <EmptyState
          icon={<Search className="w-8 h-8" />}
          title="No properties found"
          description={hasActiveFilters ? "Try adjusting your filters to see more results." : "Check back soon — new properties are added regularly."}
        />
      ) : view === 'map' ? (
        <MapView properties={properties} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p) => <PropertyCard key={p.id} property={p} />)}
        </div>
      )}
    </div>
  );
}

function PropertyCard({ property }: { property: PropertyRow }) {
  const units = property.property_units || [];
  const availableUnits = units.filter((u) => u.status === 'available');
  const minRent = units.length > 0 ? Math.min(...units.map((u) => u.monthly_rent)) : 0;
  const maxRent = units.length > 0 ? Math.max(...units.map((u) => u.monthly_rent)) : 0;
  const firstUnit = units[0];
  const image = property.photos?.[0] || getPropertyImage(property.property_type);

  return (
    <Link to={`/property/${property.id}`} className="card overflow-hidden hover:shadow-lg transition-all group">
      <div className="relative h-52 overflow-hidden bg-ink-100">
        <img src={image} alt={property.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        <div className="absolute top-3 left-3 flex gap-2">
          <span className="badge bg-brand-600 text-white"><ShieldCheck className="w-3 h-3" /> Verified</span>
        </div>
        {availableUnits.length > 0 && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-white/90 text-brand-700">{availableUnits.length} available</span>
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-ink-900 mb-1 truncate">{property.name}</h3>
        <p className="text-sm text-ink-500 flex items-center gap-1 mb-3">
          <MapPin className="w-3.5 h-3.5 shrink-0" />
          {property.estate ? `${property.estate}, ` : ''}{property.town}, {property.county}
        </p>
        {firstUnit && (
          <div className="flex items-center gap-3 text-sm text-ink-600 mb-3">
            <span className="flex items-center gap-1"><BedDouble className="w-4 h-4" /> {firstUnit.bedrooms || 'Studio'}</span>
            <span className="flex items-center gap-1"><Bath className="w-4 h-4" /> {firstUnit.bathrooms}</span>
            <span className="text-ink-400">·</span>
            <span className="text-ink-500">{property.property_type}</span>
          </div>
        )}
        <div className="flex items-center justify-between pt-3 border-t border-ink-100">
          <div>
            {minRent > 0 && (
              <p className="text-lg font-bold text-brand-700">
                {formatKES(minRent)}
                {maxRent !== minRent && ` – ${formatKES(maxRent)}`}
                <span className="text-sm font-normal text-ink-400">/mo</span>
              </p>
            )}
          </div>
          <span className="text-sm font-medium text-brand-600 group-hover:underline">View →</span>
        </div>
      </div>
    </Link>
  );
}

function MapView({ properties }: { properties: PropertyRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="relative h-[600px] bg-brand-50 bg-gradient-to-br from-brand-50 to-brand-100">
        {/* Simplified map placeholder with property pins */}
        <div className="absolute inset-0 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 h-full overflow-y-auto">
            {properties.map((p, i) => {
              const units = p.property_units || [];
              const minRent = units.length > 0 ? Math.min(...units.map((u) => u.monthly_rent)) : 0;
              const image = p.photos?.[0] || getPropertyImage(p.property_type);
              return (
                <div key={p.id} className="relative">
                  <Link to={`/property/${p.id}`} className="card overflow-hidden hover:shadow-md transition-all block">
                    <div className="h-32 overflow-hidden bg-ink-100">
                      <img src={image} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    </div>
                    <div className="p-3">
                      <p className="font-medium text-sm text-ink-900 truncate">{p.name}</p>
                      <p className="text-xs text-ink-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.town}, {p.county}</p>
                      {minRent > 0 && <p className="text-sm font-bold text-brand-700 mt-1">{formatKES(minRent)}/mo</p>}
                    </div>
                  </Link>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-600 text-white text-xs font-bold flex items-center justify-center shadow-md">
                    {i + 1}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur rounded-xl px-4 py-2 text-sm text-ink-600 shadow-md">
          <p className="flex items-center gap-2"><MapIcon className="w-4 h-4 text-brand-600" /> Map view — {properties.length} properties</p>
        </div>
      </div>
    </div>
  );
}
