-- Phase 48: Land/plot presentation and AI catalogue completeness.
-- Adds explicit plot counts and exact dimensions while preserving a safe fallback
-- for older land records based on the number of owner-uploaded photos.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS plot_count integer,
  ADD COLUMN IF NOT EXISTS plot_dimensions text;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_plot_count_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_plot_count_check
  CHECK (plot_count IS NULL OR plot_count >= 1);

ALTER TABLE public.land_parcels
  ADD COLUMN IF NOT EXISTS plot_count integer,
  ADD COLUMN IF NOT EXISTS plot_dimensions text;

ALTER TABLE public.land_parcels
  DROP CONSTRAINT IF EXISTS land_parcels_plot_count_check;
ALTER TABLE public.land_parcels
  ADD CONSTRAINT land_parcels_plot_count_check
  CHECK (plot_count IS NULL OR plot_count >= 1);

-- Backfill legacy land records. The photo count is only a fallback; owners can
-- subsequently correct the explicit plot count from the owner workspace.
UPDATE public.properties
SET plot_count = GREATEST(COALESCE(cardinality(photos), 0), 1)
WHERE plot_count IS NULL
  AND (asset_class = 'land' OR lower(property_type) LIKE '%plot%' OR lower(property_type) LIKE '%land%');

UPDATE public.land_parcels lp
SET plot_count = p.plot_count,
    plot_dimensions = p.plot_dimensions
FROM public.properties p
WHERE lp.property_id = p.id
  AND lp.plot_count IS NULL
  AND p.plot_count IS NOT NULL;

DROP FUNCTION IF EXISTS public.get_public_universal_catalog();

CREATE FUNCTION public.get_public_universal_catalog()
RETURNS TABLE (
  property_id uuid, name text, description text, property_type text, asset_class text,
  operation_model text, ownership_type text, title_number text, parcel_number text,
  total_land_area numeric, land_area_unit text, plot_count integer, plot_dimensions text,
  zoning text, year_built integer, county text, sub_county text, town text, estate text,
  street text, address text, latitude numeric, longitude numeric, map_url text,
  number_of_units integer, number_of_floors integer, amenities text[], parking boolean,
  water_availability boolean, electricity boolean, internet boolean, pets_allowed boolean,
  photos text[], created_at timestamptz, available_units integer, min_monthly_rent numeric,
  sale_listing_count integer, sale_min_price numeric, short_stay_listing_count integer,
  short_stay_min_rate numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id, p.name, p.description, p.property_type, p.asset_class, p.operation_model,
    p.ownership_type, p.title_number, p.parcel_number, p.total_land_area, p.land_area_unit,
    CASE WHEN p.asset_class = 'land' OR lower(p.property_type) LIKE '%plot%' OR lower(p.property_type) LIKE '%land%'
      THEN GREATEST(COALESCE(p.plot_count, cardinality(COALESCE(p.photos, ARRAY[]::text[]))), 1)
      ELSE NULL END,
    p.plot_dimensions, p.zoning, p.year_built, p.county, p.sub_county, p.town, p.estate,
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
GRANT EXECUTE ON FUNCTION public.get_public_universal_catalog() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
