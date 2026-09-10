import { useState, useEffect } from 'react';
import { MapPin, BedDouble, Bath, ShieldCheck, Heart, Share2, Phone, Calendar, Users, Wallet, Tag, ChevronLeft, ChevronRight, Car, Wifi, Droplets, Zap, PawPrint, CheckCircle, X, MessageSquare, Music2, Layers3, Ruler, FileText } from 'lucide-react';
import { Link } from '@/context/RouterContext';
import { useRouter } from '@/context/hooks';
import { supabase } from '@/lib/supabase';
import { formatKES, titleCase } from '@/lib/constants';
import { Badge, Spinner, EmptyState } from '@/components/ui';
import { Modal } from '@/components/Modal';
import { useAuth } from '@/context/hooks';
import { useToast } from '@/context/hooks';
import { getPropertyImages } from '@/lib/images';
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsEmbedUrl, extractCoordinatesFromMapUrl, resolveMapUrlCoordinates } from '@/lib/map';
import { getPropertyPresentation } from '@/lib/propertyPresentation';
import type { Property, PropertyUnit, Profile } from '@/lib/supabase';

interface PropertyWithOwner extends Property {
  profiles: Pick<Profile, 'full_name' | 'phone'> | null;
}

export function PropertyDetailsPage({ propertyId }: { propertyId: string }) {
  const { navigate } = useRouter();
  const { profile } = useAuth();
  const { toast } = useToast();
  const [property, setProperty] = useState<PropertyWithOwner | null>(null);
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [gallery, setGallery] = useState<string[]>([]);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showReserve, setShowReserve] = useState<string | null>(null);
  const [showViewing, setShowViewing] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [landParcel, setLandParcel] = useState<Record<string, unknown> | null>(null);
  const [saleListing, setSaleListing] = useState<Record<string, unknown> | null>(null);
  const [shortStayListing, setShortStayListing] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    (async () => {
      // Load the public catalog through the SECURITY DEFINER RPC so verified
      // listings remain visible regardless of stale client-side RLS state.
      const [{ data: catalog, error: catalogError }, { data: universal, error: universalError }] = await Promise.all([
        supabase.rpc('get_public_property_catalog'),
        supabase.rpc('get_public_universal_catalog'),
      ]);
      if (catalogError) console.error('Property detail catalogue error:', catalogError);
      if (universalError) console.error('Property detail universal catalogue error:', universalError);
      const rows = (catalog || []) as Array<Record<string, unknown>>;
      const matching = rows.filter((row) => String(row.property_id) === propertyId);
      const universalRow = ((universal || []) as Array<Record<string, unknown>>).find((row) => String(row.property_id) === propertyId);
      const first = matching[0] || universalRow;
      let ownerInfo: { owner_id: string | null; full_name: string | null; phone: string | null } | null = null;
      if (first) {
        const ownerRpc = supabase.rpc('get_public_property_owner', { p_property_id: propertyId }) as unknown as Promise<{
          data: Array<{ owner_id: string | null; full_name: string | null; phone: string | null }> | null;
          error: { message: string; details?: string; hint?: string; code?: string } | null;
        }>;
        const { data: ownerRows, error: ownerError } = await ownerRpc;
        if (ownerError) console.error('Property owner lookup error:', ownerError);
        ownerInfo = ownerRows?.[0] ?? null;
      }
      const data = first ? {
        id: first.property_id, owner_id: ownerInfo?.owner_id || null, name: first.name, description: first.description,
        property_type: first.property_type, asset_class: universalRow?.asset_class || 'built_property', operation_model: universalRow?.operation_model || 'long_term_rental',
        ownership_type: universalRow?.ownership_type || null, title_number: universalRow?.title_number || null, parcel_number: universalRow?.parcel_number || null,
        total_land_area: universalRow?.total_land_area == null ? null : Number(universalRow.total_land_area), land_area_unit: universalRow?.land_area_unit || null,
        plot_count: universalRow?.plot_count == null ? null : Number(universalRow.plot_count), plot_dimensions: universalRow?.plot_dimensions || null,
        zoning: universalRow?.zoning || null, year_built: universalRow?.year_built == null ? null : Number(universalRow.year_built),
        county: first.county, sub_county: first.sub_county, town: first.town, estate: first.estate, street: first.street || null, address: first.address,
        latitude: first.latitude == null ? null : Number(first.latitude), longitude: first.longitude == null ? null : Number(first.longitude), map_url: first.map_url || null,
        number_of_units: first.number_of_units || 0, number_of_floors: first.number_of_floors || 0, amenities: first.amenities || [], parking: first.parking,
        security_info: first.security_info || null, water_availability: first.water_availability, electricity: first.electricity, internet: first.internet || false,
        pets_allowed: first.pets_allowed || false, photos: universalRow?.photos || first.photos || [], videos: [], audio: first.audio || [], status: 'verified',
        created_at: first.created_at, updated_at: first.created_at, profiles: ownerInfo ? { full_name: ownerInfo.full_name, phone: ownerInfo.phone } : null,
      } : null;
      let resolvedData = data as PropertyWithOwner | null;
      if (resolvedData?.map_url && resolvedData.latitude == null && resolvedData.longitude == null) {
        const resolved = await resolveMapUrlCoordinates(resolvedData.map_url);
        if (resolved) resolvedData = { ...resolvedData, latitude: resolved.latitude, longitude: resolved.longitude };
      }
      setProperty(resolvedData);

      const [{ data: landRows }, { data: saleRows }, { data: stayRows }] = await Promise.all([
        supabase.from('land_parcels').select('*').eq('property_id', propertyId).order('created_at', { ascending: false }).limit(1),
        supabase.from('sale_listings').select('*').eq('property_id', propertyId).eq('listing_status', 'active').order('created_at', { ascending: false }).limit(1),
        supabase.from('short_stay_listings').select('*').eq('property_id', propertyId).eq('listing_status', 'active').order('created_at', { ascending: false }).limit(1),
      ]);
      setLandParcel((landRows?.[0] as Record<string, unknown> | undefined) || null);
      setSaleListing((saleRows?.[0] as Record<string, unknown> | undefined) || null);
      setShortStayListing((stayRows?.[0] as Record<string, unknown> | undefined) || null);

      const mappedUnits = matching.filter((row) => row.unit_id).map((row) => ({
        id: row.unit_id, property_id: row.property_id, unit_number: row.unit_number, floor: row.floor,
        house_type: row.house_type, bedrooms: Number(row.bedrooms || 0), bathrooms: Number(row.bathrooms || 0),
        monthly_rent: Number(row.monthly_rent || 0), reservation_fee: Number(row.reservation_fee || 0),
        status: row.status, furnishing: row.furnishing, photos: row.unit_photos || [], videos: row.unit_videos || [],
      }));
      setUnits(mappedUnits as PropertyUnit[]);

      // Build gallery
      const prop = resolvedData;
      if (prop) {
        const photos = prop.photos?.length > 0 ? prop.photos : getPropertyImages(prop.property_type);
        setGallery(photos);
      }

      // Check favorite
      if (profile) {
        const { data: fav } = await supabase
          .from('favorites')
          .select('id')
          .eq('property_id', propertyId)
          .eq('user_id', profile.id)
          .maybeSingle();
        setIsFavorite(!!fav);
      }

      setLoading(false);
    })();
  }, [propertyId, profile]);

  const toggleFavorite = async () => {
    if (!profile) {
      toast('Please sign in to save properties', 'info');
      navigate('/login');
      return;
    }
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('property_id', propertyId).eq('user_id', profile.id);
      setIsFavorite(false);
      toast('Removed from saved properties', 'info');
    } else {
      await supabase.from('favorites').insert({ property_id: propertyId, user_id: profile.id });
      setIsFavorite(true);
      toast('Property saved to your favorites', 'success');
    }
  };

  const shareProperty = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: property?.name, url }); } catch { /* user cancelled sharing */ }
    } else {
      await navigator.clipboard.writeText(url);
      toast('Property link copied to clipboard', 'success');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]"><Spinner className="w-8 h-8 text-brand-500" /></div>
  );

  if (!property) return (
    <div className="max-w-7xl mx-auto px-4 py-16">
      <EmptyState icon={<X className="w-8 h-8" />} title="Opportunity not found" description="This opportunity may have been removed or is no longer available." action={<Link to="/properties" className="btn-primary">Browse Properties</Link>} />
    </div>
  );

  const availableUnits = units.filter((u) => u.status === 'available');
  const minRent = units.length > 0 ? Math.min(...units.map((u) => u.monthly_rent)) : 0;
  const view = getPropertyPresentation(property.asset_class, property.operation_model, property.property_type);
  const isLand = view.kind === 'land';
  // Prefer explicit property/parcel metadata. Photo count is only a legacy fallback.
  const landPlotCount = isLand ? (Number(landParcel?.plot_count || property.plot_count || 0) > 0 ? Number(landParcel?.plot_count || property.plot_count) : Math.max(property.photos?.length || 0, 1)) : 0;
  const landAreaValue = landParcel?.acreage != null ? Number(landParcel.acreage) : property.total_land_area;
  const landAreaUnit = landParcel?.area_unit ? String(landParcel.area_unit) : property.land_area_unit || 'acres';
  const landArea = landAreaValue != null ? `${landAreaValue} ${landAreaUnit}` : 'On enquiry';
  const landDimensions = String(landParcel?.plot_dimensions || property.plot_dimensions || 'On enquiry');
  const isSale = ['sale', 'land_sale'].includes(property.operation_model);
  const isStay = property.operation_model === 'short_stay';
  const stayRate = shortStayListing?.nightly_rate != null ? Number(shortStayListing.nightly_rate) : 0;
  const salePrice = saleListing?.asking_price != null ? Number(saleListing.asking_price) : 0;
  const mapCoordinates = property.latitude != null && property.longitude != null
    ? { latitude: property.latitude, longitude: property.longitude }
    : extractCoordinatesFromMapUrl(property.map_url);
  const mapEmbedUrl = mapCoordinates ? buildGoogleMapsEmbedUrl(mapCoordinates) : null;
  const exactLocationUrl = property.map_url || (mapCoordinates ? buildGoogleMapsDirectionsUrl(mapCoordinates) : null);
  const headline = isLand ? (salePrice > 0 ? formatKES(salePrice) : 'Land sale — enquire') : isSale ? (salePrice > 0 ? formatKES(salePrice) : 'Sale opportunity — enquire') : isStay ? (stayRate > 0 ? `${formatKES(stayRate)}/night` : 'Short-stay opportunity — enquire') : minRent > 0 ? `${formatKES(minRent)}/month` : 'Price on enquiry';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <button onClick={() => navigate('/properties')} className="flex items-center gap-1 text-sm text-ink-500 hover:text-ink-800 mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Opportunities
      </button>

      {/* Title Row */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="badge bg-brand-100 text-brand-700"><ShieldCheck className="w-3 h-3" /> Verified Opportunity</span>
            <span className="badge bg-ink-100 text-ink-600">{property.property_type}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-ink-900">{property.name}</h1>
          <p className="text-ink-500 flex items-center gap-1 mt-1">
            <MapPin className="w-4 h-4" />
            {property.estate ? `${property.estate}, ` : ''}{property.town}, {property.county}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={toggleFavorite} className={`btn-secondary ${isFavorite ? 'text-red-500 border-red-200 bg-red-50' : ''}`}>
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-red-500' : ''}`} />
            {isFavorite ? 'Saved' : 'Save'}
          </button>
          <button onClick={shareProperty} className="btn-secondary">
            <Share2 className="w-4 h-4" /> Share
          </button>
        </div>
      </div>

      {/* Gallery */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-8">
        <div className="lg:col-span-3 relative h-64 sm:h-96 rounded-2xl overflow-hidden bg-ink-100 group cursor-pointer" onClick={() => setShowLightbox(true)}>
          <img src={gallery[activeImage]} alt={property.name} className="w-full h-full object-cover" />
          {gallery.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage - 1 + gallery.length) % gallery.length); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage + 1) % gallery.length); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/80 hover:bg-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-ink-950/60 text-white text-xs px-3 py-1 rounded-full">
                {activeImage + 1} / {gallery.length}
              </div>
            </>
          )}
        </div>
        <div className="hidden lg:grid grid-rows-2 gap-3">
          {gallery.slice(1, 3).map((img, i) => (
            <div key={i} className="relative h-44 rounded-2xl overflow-hidden bg-ink-100 cursor-pointer hover:opacity-90" onClick={() => setActiveImage(i + 1)}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {property.videos?.length > 0 && (
        <div className="mb-8 rounded-2xl border border-ink-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-semibold text-ink-900">Property walkthroughs</h3><p className="text-sm text-ink-500">Watch owner-uploaded videos before booking a viewing or reservation.</p></div><span className="badge bg-brand-50 text-brand-700">{property.videos.length} video{property.videos.length === 1 ? '' : 's'}</span></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {property.videos.map((video) => <video key={video} src={video} controls preload="metadata" className="w-full rounded-xl bg-ink-950" />)}
          </div>
        </div>
      )}

      {property.audio?.length > 0 && (
        <div className="mb-8 rounded-2xl border border-accent-200 bg-accent-50/50 p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-100 text-accent-700"><Music2 className="h-5 w-5" /></div><div><h3 className="font-semibold text-ink-900">Audio property tour</h3><p className="text-sm text-ink-500">Listen to owner-provided information about the property.</p></div></div>
          <div className="space-y-3">{property.audio.map((track) => <audio key={track} src={track} controls className="w-full" />)}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {(isLand ? [
              { icon: <Layers3 className="w-5 h-5" />, label: 'Plots available', value: landPlotCount },
              { icon: <Ruler className="w-5 h-5" />, label: 'Land size', value: landArea },
              { icon: <Ruler className="w-5 h-5" />, label: 'Plot dimensions', value: landDimensions },
              { icon: <ShieldCheck className="w-5 h-5" />, label: 'Tenure', value: String(landParcel?.tenure || property.ownership_type ? titleCase(String(landParcel?.tenure || property.ownership_type)) : 'On enquiry') },
            ] : isStay ? [
              { icon: <Calendar className="w-5 h-5" />, label: 'Active listings', value: shortStayListing ? 1 : 0 },
              { icon: <Wallet className="w-5 h-5" />, label: 'From / night', value: stayRate > 0 ? formatKES(stayRate) : 'On enquiry' },
              { icon: <Users className="w-5 h-5" />, label: 'Maximum guests', value: shortStayListing?.max_guests ?? '—' },
              { icon: <Car className="w-5 h-5" />, label: 'Parking', value: property.parking ? 'Yes' : 'No' },
            ] : isSale || view.kind === 'development' ? [
              { icon: <Tag className="w-5 h-5" />, label: isSale ? 'Asking price' : 'Project type', value: isSale ? (salePrice > 0 ? formatKES(salePrice) : 'On enquiry') : property.property_type },
              { icon: <Ruler className="w-5 h-5" />, label: 'Land area', value: property.total_land_area != null ? `${property.total_land_area} ${property.land_area_unit || 'acres'}` : '—' },
              { icon: <ShieldCheck className="w-5 h-5" />, label: 'Ownership', value: property.ownership_type ? titleCase(property.ownership_type) : 'On enquiry' },
              { icon: <MapPin className="w-5 h-5" />, label: 'Location', value: property.town || '—' },
            ] : [
              { icon: <BedDouble className="w-5 h-5" />, label: 'Bedrooms', value: units[0]?.bedrooms ?? '—' },
              { icon: <Bath className="w-5 h-5" />, label: 'Bathrooms', value: units[0]?.bathrooms ?? '—' },
              { icon: <Car className="w-5 h-5" />, label: 'Parking', value: property.parking ? 'Yes' : 'No' },
              { icon: <Calendar className="w-5 h-5" />, label: 'Available', value: `${availableUnits.length} spaces` },
            ]).map((s) => (
              <div key={s.label} className="card p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center mx-auto mb-2">{s.icon}</div>
                <p className="text-xs text-ink-500">{s.label}</p>
                <p className="font-semibold text-ink-900">{String(s.value)}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {property.description && (
            <div className="card p-6">
              <h3 className="font-semibold text-ink-900 mb-3">About this opportunity</h3>
              <p className="text-ink-600 leading-relaxed">{property.description}</p>
            </div>
          )}

          <div className="card p-6 bg-gradient-to-br from-brand-50 to-white">
            <div className="mb-4"><h3 className="font-semibold text-ink-900">{isLand ? 'Land / plot information' : 'Asset information'}</h3><p className="text-sm text-ink-500">{isLand ? 'Land-specific information captured by the owner.' : 'Core ownership, land and operating information for this opportunity.'}</p></div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {isLand ? <>
                <div><p className="text-xs text-ink-400">Plots available</p><p className="mt-1 font-semibold">{landPlotCount}</p></div>
                <div><p className="text-xs text-ink-400">Land size</p><p className="mt-1 font-semibold">{landArea}</p></div>
                <div><p className="text-xs text-ink-400">Exact dimensions</p><p className="mt-1 font-semibold">{landDimensions}</p></div>
                <div><p className="text-xs text-ink-400">Land use</p><p className="mt-1 font-semibold capitalize">{String(landParcel?.land_use || property.zoning || property.property_type || 'On enquiry')}</p></div>
                <div><p className="text-xs text-ink-400">Title number</p><p className="mt-1 font-semibold">{String(landParcel?.title_number || property.title_number || 'On enquiry')}</p></div>
                <div><p className="text-xs text-ink-400">Parcel / plot</p><p className="mt-1 font-semibold">{String(landParcel?.parcel_number || property.parcel_number || 'On enquiry')}</p></div>
                <div><p className="text-xs text-ink-400">Tenure</p><p className="mt-1 font-semibold">{landParcel?.tenure ? titleCase(String(landParcel.tenure)) : property.ownership_type ? titleCase(property.ownership_type) : 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Zoning</p><p className="mt-1 font-semibold">{String(landParcel?.zoning || property.zoning || 'On enquiry')}</p></div>
              </> : isStay ? <>
                <div><p className="text-xs text-ink-400">Listing</p><p className="mt-1 font-semibold">{String(shortStayListing?.listing_name || 'Hospitality listing')}</p></div>
                <div><p className="text-xs text-ink-400">Nightly rate</p><p className="mt-1 font-semibold">{stayRate > 0 ? formatKES(stayRate) : 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Guest capacity</p><p className="mt-1 font-semibold">{String(shortStayListing?.max_guests ?? '—')}</p></div>
                <div><p className="text-xs text-ink-400">Minimum nights</p><p className="mt-1 font-semibold">{String(shortStayListing?.minimum_nights ?? '—')}</p></div>
                <div><p className="text-xs text-ink-400">Check-in</p><p className="mt-1 font-semibold">{String(shortStayListing?.check_in_time || 'On enquiry')}</p></div>
                <div><p className="text-xs text-ink-400">Check-out</p><p className="mt-1 font-semibold">{String(shortStayListing?.check_out_time || 'On enquiry')}</p></div>
              </> : isSale || view.kind === 'development' ? <>
                <div><p className="text-xs text-ink-400">Asset type</p><p className="mt-1 font-semibold">{property.property_type}</p></div>
                <div><p className="text-xs text-ink-400">Asking price</p><p className="mt-1 font-semibold">{salePrice > 0 ? formatKES(salePrice) : 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Ownership / tenure</p><p className="mt-1 font-semibold">{property.ownership_type ? titleCase(property.ownership_type) : 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Land area</p><p className="mt-1 font-semibold">{property.total_land_area ? `${property.total_land_area} ${property.land_area_unit || 'acres'}` : '—'}</p></div>
                <div><p className="text-xs text-ink-400">Zoning</p><p className="mt-1 font-semibold">{property.zoning || 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Year built / completion</p><p className="mt-1 font-semibold">{property.year_built || '—'}</p></div>
              </> : <>
                <div><p className="text-xs text-ink-400">Asset class</p><p className="mt-1 font-semibold capitalize">{property.asset_class.replace(/_/g, ' ')}</p></div>
                <div><p className="text-xs text-ink-400">Operating model</p><p className="mt-1 font-semibold capitalize">{property.operation_model.replace(/_/g, ' ')}</p></div>
                <div><p className="text-xs text-ink-400">Ownership / tenure</p><p className="mt-1 font-semibold">{property.ownership_type ? titleCase(property.ownership_type) : 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Title number</p><p className="mt-1 font-semibold">{property.title_number || 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Parcel / plot</p><p className="mt-1 font-semibold">{property.parcel_number || 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Land area</p><p className="mt-1 font-semibold">{property.total_land_area ? `${property.total_land_area} ${property.land_area_unit || 'acres'}` : '—'}</p></div>
                <div><p className="text-xs text-ink-400">Zoning</p><p className="mt-1 font-semibold">{property.zoning || 'On enquiry'}</p></div>
                <div><p className="text-xs text-ink-400">Year built / completion</p><p className="mt-1 font-semibold">{property.year_built || '—'}</p></div>
              </>}
            </div>
          </div>

          {/* Features */}
          <div className="card p-6">
            <h3 className="font-semibold text-ink-900 mb-4">{isLand ? 'Land Features' : 'Asset Features'}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {(isLand ? [
                { icon: <Droplets className="w-4 h-4" />, label: 'Water available', value: property.water_availability },
                { icon: <Zap className="w-4 h-4" />, label: 'Electricity available', value: property.electricity },
                { icon: <MapPin className="w-4 h-4" />, label: 'Exact location', value: !!(property.map_url || (property.latitude != null && property.longitude != null)) },
                { icon: <ShieldCheck className="w-4 h-4" />, label: 'Security information', value: !!property.security_info },
                { icon: <Layers3 className="w-4 h-4" />, label: 'Plot information', value: landPlotCount > 0 },
                { icon: <Ruler className="w-4 h-4" />, label: 'Dimensions captured', value: !!property.plot_dimensions },
              ] : isStay ? [
                { icon: <Droplets className="w-4 h-4" />, label: 'Water', value: property.water_availability },
                { icon: <Zap className="w-4 h-4" />, label: 'Electricity', value: property.electricity },
                { icon: <Wifi className="w-4 h-4" />, label: 'Internet', value: property.internet },
                { icon: <Car className="w-4 h-4" />, label: 'Parking', value: property.parking },
                { icon: <ShieldCheck className="w-4 h-4" />, label: 'Security', value: !!property.security_info },
                { icon: <Calendar className="w-4 h-4" />, label: 'Direct booking', value: !!shortStayListing?.direct_booking_enabled },
              ] : isSale || view.kind === 'development' ? [
                { icon: <Droplets className="w-4 h-4" />, label: 'Water / utilities', value: property.water_availability },
                { icon: <Zap className="w-4 h-4" />, label: 'Electricity', value: property.electricity },
                { icon: <MapPin className="w-4 h-4" />, label: 'Exact location', value: !!(property.map_url || (property.latitude != null && property.longitude != null)) },
                { icon: <ShieldCheck className="w-4 h-4" />, label: 'Ownership information', value: !!property.ownership_type },
                { icon: <FileText className="w-4 h-4" />, label: 'Title / reference', value: !!(property.title_number || property.parcel_number) },
                { icon: <ShieldCheck className="w-4 h-4" />, label: 'Security / site information', value: !!property.security_info },
              ] : [
                { icon: <Droplets className="w-4 h-4" />, label: 'Water', value: property.water_availability },
                { icon: <Zap className="w-4 h-4" />, label: 'Electricity', value: property.electricity },
                { icon: <Wifi className="w-4 h-4" />, label: 'Internet', value: property.internet },
                { icon: <Car className="w-4 h-4" />, label: 'Parking', value: property.parking },
                { icon: <PawPrint className="w-4 h-4" />, label: 'Pets Allowed', value: property.pets_allowed },
                { icon: <ShieldCheck className="w-4 h-4" />, label: 'Security', value: !!property.security_info },
              ]).map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-sm">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${f.value ? 'bg-brand-50 text-brand-600' : 'bg-ink-100 text-ink-400'}`}>
                    {f.icon}
                  </span>
                  <span className={f.value ? 'text-ink-700' : 'text-ink-400'}>{f.label}</span>
                  {f.value ? <CheckCircle className="w-4 h-4 text-brand-500" /> : <X className="w-4 h-4 text-ink-300" />}
                </div>
              ))}
            </div>
            {property.amenities && property.amenities.length > 0 && (
              <>
                <h4 className="text-sm font-medium text-ink-700 mt-6 mb-3">{isLand ? 'Additional land information' : 'Amenities'}</h4>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span key={a} className="badge bg-ink-100 text-ink-600">{a}</span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Units / rentable spaces */}
          {['residential_rental','commercial_rental','mixed_use'].includes(view.kind) && <div>
            <h3 className="font-semibold text-ink-900 mb-4">Available Spaces ({availableUnits.length})</h3>
            {units.length === 0 ? (
              <p className="text-ink-500 text-sm">No rentable spaces are listed for this asset yet.</p>
            ) : (
              <div className="space-y-3">
                {units.map((unit) => (
                  <div key={unit.id} className="card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-ink-900">Unit {unit.unit_number}</h4>
                        <Badge status={unit.status} />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-500">
                        <span className="flex items-center gap-1"><BedDouble className="w-3.5 h-3.5" /> {unit.bedrooms || 'Studio'}</span>
                        <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {unit.bathrooms}</span>
                        {unit.floor && <span>Floor {unit.floor}</span>}
                        <span>{titleCase(unit.furnishing)}</span>
                      </div>
                      {unit.description && <p className="text-sm text-ink-500 mt-1">{unit.description}</p>}
                    </div>
                    <div className="flex flex-col sm:items-end gap-2">
                      <p className="text-xl font-bold text-brand-700">{formatKES(unit.monthly_rent)}<span className="text-sm font-normal text-ink-400">/mo</span></p>
                      <p className="text-xs text-ink-400">Deposit: {formatKES(unit.security_deposit)}</p>
                      {unit.status === 'available' ? (
                        <button onClick={() => { if (!profile) { toast('Please sign in to enquire', 'info'); navigate('/login'); return; } setShowContact(true); }} className="btn-secondary text-sm">
                          Enquire about this space
                        </button>
                      ) : (
                        <span className="badge bg-ink-100 text-ink-500">{titleCase(unit.status)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {isLand && (
            <div className="card border-accent-200 bg-accent-50/50 p-6">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent-700">Land opportunity</p>
              <h3 className="mt-1 text-lg font-bold text-ink-900">View, enquire and proceed through due diligence</h3>
              <p className="mt-2 text-sm leading-6 text-ink-600">This land listing is enquiry-led. Clients are not asked to pay a reservation fee online. Use the enquiry or contact options to request viewing, title information, survey details, access information and next steps.</p>
              <button onClick={() => setShowContact(true)} className="btn-primary mt-4 w-full"><MessageSquare className="h-4 w-4" /> Send land enquiry</button>
            </div>
          )}

          {/* Location */}
          <div className="card overflow-hidden p-0">
            <div className="flex flex-col gap-3 border-b border-ink-100 p-6 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-semibold text-ink-900">Exact property location</h3>
                <p className="mt-1 text-sm text-ink-500">{property.address || `${property.estate || ''} ${property.town}, ${property.county}`}</p>
                {mapCoordinates && <p className="mt-1 text-xs text-ink-400">Coordinates: {mapCoordinates.latitude.toFixed(6)}, {mapCoordinates.longitude.toFixed(6)}</p>}
              </div>
              {exactLocationUrl && <a href={exactLocationUrl} target="_blank" rel="noreferrer" className="btn-secondary shrink-0"><MapPin className="h-4 w-4" /> Open in Google Maps</a>}
            </div>
            {mapEmbedUrl ? (
              <div className="relative h-[360px] w-full bg-ink-100">
                <iframe
                  title={`Exact map location for ${property.name}`}
                  src={mapEmbedUrl}
                  className="h-full w-full border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
                <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-ink-700 shadow-md">
                  <MapPin className="mr-1 inline h-3.5 w-3.5 text-brand-600" /> Exact owner-provided coordinates
                </div>
              </div>
            ) : property.map_url ? (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 bg-brand-50 p-8 text-center">
                <MapPin className="h-10 w-10 text-brand-600" />
                <p className="font-semibold text-ink-900">Owner-provided map location</p>
                <p className="max-w-lg text-sm text-ink-500">The owner supplied a map link, but its shared URL does not contain readable coordinates for an embedded map. Open the original link to view the exact pin.</p>
                <a href={property.map_url} target="_blank" rel="noreferrer" className="btn-primary">Open exact location</a>
              </div>
            ) : (
              <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 bg-brand-50 p-8 text-center">
                <MapPin className="h-10 w-10 text-brand-400" />
                <p className="font-semibold text-ink-900">Location map not supplied</p>
                <p className="text-sm text-ink-500">The listing address is shown above. The owner can add a Google Maps link or exact coordinates from the owner workspace.</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Price Card */}
          <div className="card p-6 sticky top-20">
            <p className="text-sm text-ink-500">Opportunity pricing</p>
            <p className="text-2xl font-bold text-brand-700 mb-1">{headline}</p>
            <p className="text-sm text-ink-500 mb-6">{isSale ? 'Verified sale opportunity.' : isStay ? 'Hospitality availability and rates on enquiry.' : `${availableUnits.length} rentable spaces available`}</p>

            <div className="space-y-3">
              <button
                onClick={() => {
                  if (!profile) { toast('Please sign in to enquire', 'info'); navigate('/login'); return; }
                  if (!isLand && !isSale && !isStay) {
                    const firstAvailable = availableUnits[0];
                    if (firstAvailable) setShowReserve(firstAvailable.id);
                    else setShowContact(true);
                  } else {
                    setShowContact(true);
                  }
                }}
                className="btn-primary w-full"
                disabled={!isLand && !isSale && !isStay ? availableUnits.length === 0 : false}
              >
                {isLand ? 'Enquire About This Land' : isSale ? 'Enquire About Purchase' : isStay ? 'Enquire About Stay' : 'Reserve This Property'}
              </button>
              {!isLand && <button onClick={() => setShowViewing(true)} className="btn-secondary w-full">
                <Calendar className="w-4 h-4" /> Schedule Viewing
              </button>}
              <button onClick={() => setShowContact(true)} className="btn-secondary w-full">
                <Phone className="w-4 h-4" /> Contact Agent
              </button>
            </div>

            <div className="mt-6 pt-6 border-t border-ink-100">
              <p className="text-sm text-ink-500 mb-2">Listing reference</p>
              <p className="text-sm font-semibold text-ink-800">{property.title_number || property.parcel_number || 'Verified opportunity'}</p>
              <p className="text-xs text-ink-400 mt-1">{property.ownership_type ? titleCase(property.ownership_type) : 'Ownership details available on enquiry'}</p>
            </div>
          </div>

          {/* Agent Info */}
          {property.profiles && (
            <div className="card p-6">
              <h3 className="font-semibold text-ink-900 mb-3">Property Owner</h3>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-semibold text-lg">
                  {property.profiles.full_name?.[0]?.toUpperCase() || 'O'}
                </div>
                <div>
                  <p className="font-medium text-ink-900">{property.profiles.full_name || 'Property Owner'}</p>
                  <p className="text-sm text-ink-500">Property Owner</p>
                </div>
              </div>
              <button onClick={() => setShowContact(true)} className="btn-secondary w-full mt-4">
                <MessageSquare className="w-4 h-4" /> Message Owner
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {showLightbox && (
        <div className="fixed inset-0 z-[100] bg-ink-950/90 flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <button className="absolute top-4 right-4 text-white p-2 hover:bg-white/10 rounded-lg"><X className="w-6 h-6" /></button>
          <img src={gallery[activeImage]} alt="" className="max-w-full max-h-[90vh] object-contain" />
          {gallery.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage - 1 + gallery.length) % gallery.length); }} className="absolute left-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"><ChevronLeft className="w-8 h-8" /></button>
              <button onClick={(e) => { e.stopPropagation(); setActiveImage((activeImage + 1) % gallery.length); }} className="absolute right-4 top-1/2 -translate-y-1/2 text-white p-2 hover:bg-white/10 rounded-full"><ChevronRight className="w-8 h-8" /></button>
            </>
          )}
        </div>
      )}

      {/* Reservation Modal */}
      {showReserve && (
        <ReservationModal unitId={showReserve} onClose={() => setShowReserve(null)} />
      )}

      {/* Viewing Modal */}
      {showViewing && (
        <ViewingModal propertyId={propertyId} units={units} onClose={() => setShowViewing(false)} />
      )}

      {/* Contact Modal */}
      {showContact && (
        <ContactModal propertyId={property.id} ownerId={property.owner_id} ownerName={property.profiles?.full_name} ownerPhone={property.profiles?.phone} onClose={() => setShowContact(false)} />
      )}
    </div>
  );
}

function ReservationModal({ unitId, onClose }: { unitId: string; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();
  const [step, setStep] = useState<'summary' | 'pay' | 'processing' | 'success'>('summary');
  const [paymentMethod, setPaymentMethod] = useState<'mpesa' | 'card' | 'bank_transfer'>('mpesa');
  const [phone, setPhone] = useState('');
  const [reservationFee, setReservationFee] = useState(2000);
  const [durationHours, setDurationHours] = useState(48);

  useEffect(() => {
    (async () => {
      const [{ data: unit }, { data: settings }] = await Promise.all([
        supabase.from('property_units').select('reservation_fee').eq('id', unitId).maybeSingle(),
        supabase.from('system_settings').select('reservation_fee,reservation_duration_hours').eq('id', 1).maybeSingle(),
      ]);
      setReservationFee(Number(unit?.reservation_fee ?? settings?.reservation_fee ?? 2000));
      setDurationHours(Number(settings?.reservation_duration_hours ?? 48));
    })();
  }, [unitId]);

  const handleReserve = async () => {
    if (!profile) return;
    setStep('processing');

    const { data: resData, error: resError } = await supabase.rpc('create_reservation', {
      p_unit_id: unitId,
      p_duration_hours: durationHours,
      p_payment_method: paymentMethod,
    });

    if (resError || !resData) {
      const message = resError?.message || 'Could not create reservation. Please try again.';
      toast(message.includes('already') || message.includes('reserved') ? 'This unit is no longer available.' : message, 'error');
      setStep('summary');
      return;
    }

    setStep('success');

  };

  return (
    <Modal open onClose={onClose} title="Reserve This Property" size="md">
      {step === 'summary' && (
        <div>
          <div className="bg-brand-50 rounded-xl p-4 mb-4">
            <h4 className="font-semibold text-ink-900 mb-2">Reservation Summary</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-500">Reservation Fee</span> <span className="font-semibold">{formatKES(reservationFee)}</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Policy</span> <span>Non-refundable</span></div>
              <div className="flex justify-between"><span className="text-ink-500">Valid For</span> <span>{durationHours} hours</span></div>
            </div>
          </div>
          <div className="mb-4">
            <label className="label">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'mpesa', label: 'M-Pesa' },
                { value: 'card', label: 'Card' },
                { value: 'bank_transfer', label: 'Bank' },
              ].map((m) => (
                <button
                  key={m.value}
                  onClick={() => setPaymentMethod(m.value as typeof paymentMethod)}
                  className={`p-3 rounded-xl border text-sm font-medium transition-all ${
                    paymentMethod === m.value ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-ink-200 text-ink-600 hover:border-ink-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          {paymentMethod === 'mpesa' && (
            <div className="mb-4">
              <label className="label">M-Pesa Phone Number</label>
              <input className="input" placeholder="07XX XXX XXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <p className="text-xs text-ink-400 mt-1">You'll receive an STK push prompt to confirm payment.</p>
            </div>
          )}
          <div className="bg-yellow-50 rounded-xl p-3 mb-4">
            <p className="text-xs text-yellow-700">
              By proceeding, you agree to the configured reservation fee. The exact fee and holding period are shown above.
            </p>
          </div>
          <button onClick={handleReserve} className="btn-primary w-full">
            Continue with {formatKES(reservationFee)} Reservation
          </button>
        </div>
      )}

      {step === 'processing' && (
        <div className="text-center py-8">
          <Spinner className="w-12 h-12 text-brand-500 mx-auto mb-4" />
          <h4 className="font-semibold text-ink-900 mb-1">Processing Payment</h4>
          <p className="text-sm text-ink-500">Creating your reservation and a secure pending payment record...</p>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8" />
          </div>
          <h4 className="font-bold text-ink-900 text-lg mb-1">Reservation Request Received!</h4>
          <p className="text-sm text-ink-500 mb-6">Your reservation hold is active for {durationHours} hours. Payment confirmation is still pending and will only be marked successful by the payment provider.</p>
          <div className="flex gap-3">
            <button onClick={() => navigate('/tenant')} className="btn-primary flex-1">Complete Tenancy</button>
            <button onClick={onClose} className="btn-secondary flex-1">Close</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ViewingModal({ propertyId, units, onClose }: { propertyId: string; units: PropertyUnit[]; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [unitId, setUnitId] = useState(units[0]?.id || '');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) { toast('Please sign in first', 'info'); navigate('/login'); return; }
    const { error } = await supabase.from('viewing_appointments').insert({
      property_id: propertyId,
      unit_id: unitId || null,
      customer_id: profile.id,
      appointment_date: date,
      appointment_time: time,
      status: 'requested',
      notes,
    });
    if (error) { toast('Could not schedule viewing. Try again.', 'error'); return; }
    toast('Viewing request sent! The owner will confirm shortly.', 'success');
    onClose();
  };

  return (
    <Modal open onClose={onClose} title="Schedule a Viewing" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Select Unit</label>
          <select className="input" value={unitId} onChange={(e) => setUnitId(e.target.value)}>
            {units.map((u) => <option key={u.id} value={u.id}>Unit {u.unit_number} — {formatKES(u.monthly_rent)}/mo</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" required value={date} onChange={(e) => setDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          </div>
          <div>
            <label className="label">Time</label>
            <input type="time" className="input" required value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="label">Notes (optional)</label>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any questions or special requests?" />
        </div>
        <button type="submit" className="btn-primary w-full">Request Viewing</button>
      </form>
    </Modal>
  );
}

function ContactModal({ propertyId, ownerId, ownerName, ownerPhone, onClose }: { propertyId: string; ownerId?: string | null; ownerName?: string | null; ownerPhone?: string | null; onClose: () => void }) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { navigate } = useRouter();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!profile) { toast('Please sign in to send an enquiry.', 'info'); navigate('/login'); return; }
    if (!ownerId) { toast('This property does not have an owner assigned yet.', 'error'); return; }
    if (!body.trim()) { toast('Please enter your message.', 'info'); return; }
    if (profile.id === ownerId) { toast('You cannot send an enquiry to your own property.', 'info'); return; }
    setSending(true);
    const enquiryRpc = supabase.rpc('send_property_enquiry', {
      p_property_id: propertyId,
      p_body: body.trim(),
    }) as unknown as Promise<{
      data: string | null;
      error: { message: string; details?: string; hint?: string; code?: string } | null;
    }>;
    const { data: messageId, error } = await enquiryRpc;
    setSending(false);
    if (error || !messageId) {
      console.error('Property enquiry error:', error);
      toast(error?.message || 'Unable to send your enquiry. Please try again.', 'error');
      return;
    }
    toast('Enquiry sent! The property owner will respond through Messages & Enquiries.', 'success');
    onClose();
  };

  return <Modal open onClose={onClose} title="Contact Owner" size="sm">
    <div className="space-y-4">
      <div className="flex items-center gap-3"><div className="grid h-14 w-14 place-items-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">{ownerName?.[0]?.toUpperCase() || 'O'}</div><div><p className="font-semibold text-ink-900">{ownerName || 'Property Owner'}</p><p className="text-sm text-ink-500">Your enquiry will be linked to this property.</p></div></div>
      {ownerPhone && <a href={`tel:${ownerPhone}`} className="btn-secondary w-full"><Phone className="h-4 w-4" /> Call {ownerPhone}</a>}
      <div><label className="label">Your message</label><textarea className="input" rows={5} value={body} onChange={e => setBody(e.target.value)} placeholder="Hi, I'm interested in this property. Please share availability, pricing and viewing details..." /></div>
      <button className="btn-primary w-full" disabled={sending} onClick={handleSend}><MessageSquare className="h-4 w-4" /> {sending ? 'Sending...' : 'Send Enquiry'}</button>
      {!profile && <p className="text-center text-xs text-ink-400">Sign in or create an account so the owner can reply to you securely.</p>}
    </div>
  </Modal>;
}
