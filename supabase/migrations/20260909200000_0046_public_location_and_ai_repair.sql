-- Phase 46: Public exact-location fields and catalog repair.
-- The owner workspace stores map_url/latitude/longitude on properties. Expose
-- those public-safe fields through the marketplace RPCs so customer pages can
-- render the owner-provided exact map location.

DROP FUNCTION IF EXISTS public.get_public_property_catalog();
DROP FUNCTION IF EXISTS public.get_public_universal_catalog();

CREATE FUNCTION public.get_public_property_catalog()
RETURNS TABLE (
  property_id uuid,
  name text,
  description text,
  property_type text,
  county text,
  sub_county text,
  town text,
  estate text,
  street text,
  address text,
  latitude numeric,
  longitude numeric,
  map_url text,
  number_of_units integer,
  number_of_floors integer,
  amenities text[],
  parking boolean,
  water_availability boolean,
  electricity boolean,
  photos text[],
  audio text[],
  created_at timestamptz,
  unit_id uuid,
  unit_number text,
  floor integer,
  house_type text,
  bedrooms integer,
  bathrooms integer,
  monthly_rent numeric,
  reservation_fee numeric,
  status text,
  furnishing text,
  unit_photos text[],
  unit_videos text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.name, p.description, p.property_type,
    p.county, p.sub_county, p.town, p.estate, p.street, p.address,
    p.latitude, p.longitude, p.map_url,
    p.number_of_units, p.number_of_floors, p.amenities,
    p.parking, p.water_availability, p.electricity, p.photos, p.audio, p.created_at,
    u.id, u.unit_number, u.floor, u.house_type, u.bedrooms,
    u.bathrooms, u.monthly_rent, u.reservation_fee, u.status,
    u.furnishing, u.photos, u.videos
  FROM public.properties p
  LEFT JOIN public.property_units u ON u.property_id = p.id
  WHERE p.status = 'verified'
  ORDER BY p.created_at DESC, u.unit_number ASC;
$$;

REVOKE ALL ON FUNCTION public.get_public_property_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_property_catalog() TO anon, authenticated;

CREATE FUNCTION public.get_public_universal_catalog()
RETURNS TABLE (
  property_id uuid,
  name text,
  description text,
  property_type text,
  asset_class text,
  operation_model text,
  ownership_type text,
  title_number text,
  parcel_number text,
  total_land_area numeric,
  land_area_unit text,
  zoning text,
  year_built integer,
  county text,
  sub_county text,
  town text,
  estate text,
  street text,
  address text,
  latitude numeric,
  longitude numeric,
  map_url text,
  number_of_units integer,
  number_of_floors integer,
  amenities text[],
  parking boolean,
  water_availability boolean,
  electricity boolean,
  internet boolean,
  pets_allowed boolean,
  photos text[],
  created_at timestamptz,
  available_units integer,
  min_monthly_rent numeric,
  sale_listing_count integer,
  sale_min_price numeric,
  short_stay_listing_count integer,
  short_stay_min_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id, p.name, p.description, p.property_type,
    p.asset_class, p.operation_model, p.ownership_type,
    p.title_number, p.parcel_number, p.total_land_area, p.land_area_unit,
    p.zoning, p.year_built, p.county, p.sub_county, p.town, p.estate,
    p.street, p.address, p.latitude, p.longitude, p.map_url,
    COALESCE(p.number_of_units,0), COALESCE(p.number_of_floors,0),
    COALESCE(p.amenities,ARRAY[]::text[]), COALESCE(p.parking,false),
    COALESCE(p.water_availability,false), COALESCE(p.electricity,false),
    COALESCE(p.internet,false), COALESCE(p.pets_allowed,false),
    COALESCE(p.photos,ARRAY[]::text[]), p.created_at,
    COALESCE((SELECT count(*)::integer FROM public.property_units u WHERE u.property_id=p.id AND u.status='available'),0),
    (SELECT min(u.monthly_rent) FROM public.property_units u WHERE u.property_id=p.id AND u.status='available'),
    COALESCE((SELECT count(*)::integer FROM public.sale_listings s WHERE s.property_id=p.id AND s.listing_status='active'),0),
    (SELECT min(s.asking_price) FROM public.sale_listings s WHERE s.property_id=p.id AND s.listing_status='active'),
    COALESCE((SELECT count(*)::integer FROM public.short_stay_listings ss WHERE ss.property_id=p.id AND ss.listing_status='active'),0),
    (SELECT min(ss.nightly_rate) FROM public.short_stay_listings ss WHERE ss.property_id=p.id AND ss.listing_status='active')
  FROM public.properties p
  WHERE p.status='verified'
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_universal_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_universal_catalog() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
