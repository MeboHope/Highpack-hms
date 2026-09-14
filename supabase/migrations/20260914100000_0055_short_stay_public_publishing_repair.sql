-- Phase 34: Short-stay publishing control + public marketplace visibility repair.
-- Draft/paused/archived short-stay listings must not surface on the public website.
-- The underlying property may remain verified and fully managed internally.

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
    AND (
      COALESCE(p.operation_model, '') <> 'short_stay'
      OR EXISTS (
        SELECT 1
        FROM public.short_stay_listings ss
        WHERE ss.property_id = p.id
          AND ss.listing_status = 'active'
      )
    )
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_public_universal_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_universal_catalog() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
