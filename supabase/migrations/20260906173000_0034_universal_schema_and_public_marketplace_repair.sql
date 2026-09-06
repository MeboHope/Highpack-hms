-- Phase 9 repair: make universal asset, short-stay and sales schemas compatible
-- with partially-applied earlier migrations, then expose one safe public marketplace RPC.

-- -----------------------------------------------------------------------------
-- UNIVERSAL PROPERTY FOUNDATION
-- -----------------------------------------------------------------------------
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS asset_class text NOT NULL DEFAULT 'built_property';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS operation_model text NOT NULL DEFAULT 'long_term_rental';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS ownership_type text DEFAULT 'freehold';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS title_number text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS parcel_number text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS total_land_area numeric;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS land_area_unit text DEFAULT 'acres';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS zoning text;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS year_built integer;

-- -----------------------------------------------------------------------------
-- SHORT-STAY COMPATIBILITY REPAIR
-- Handles databases where the table was created by an earlier Phase 7 schema.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.short_stay_listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS unit_id uuid;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS listing_name text;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS listing_code text;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'entire_place';
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS nightly_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS weekend_rate numeric;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS cleaning_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS security_deposit numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS service_fee_percent numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS minimum_nights integer NOT NULL DEFAULT 1;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS maximum_nights integer NOT NULL DEFAULT 365;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS max_guests integer NOT NULL DEFAULT 1;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS check_in_time time NOT NULL DEFAULT '14:00';
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS check_out_time time NOT NULL DEFAULT '10:00';
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS house_rules text;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS cancellation_policy text;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS direct_booking_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS channel_airbnb boolean NOT NULL DEFAULT false;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS channel_booking_com boolean NOT NULL DEFAULT false;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS channel_expedia boolean NOT NULL DEFAULT false;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS channel_vrbo boolean NOT NULL DEFAULT false;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS external_listing_ref text;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.short_stay_listings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.short_stay_listings SET listing_name = COALESCE(NULLIF(listing_name,''),'Short-stay listing') WHERE listing_name IS NULL OR listing_name='';
UPDATE public.short_stay_listings SET listing_code = 'ST-' || upper(substr(replace(id::text,'-',''),1,8)) WHERE listing_code IS NULL OR listing_code='';
ALTER TABLE public.short_stay_listings ALTER COLUMN listing_name SET DEFAULT 'Short-stay listing';
CREATE UNIQUE INDEX IF NOT EXISTS short_stay_listing_code_uidx ON public.short_stay_listings(listing_code) WHERE listing_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS short_stay_listing_property_idx ON public.short_stay_listings(property_id, listing_status);

CREATE TABLE IF NOT EXISTS public.short_stay_bookings (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS listing_id uuid;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS unit_id uuid;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS guest_id uuid;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS guest_name text NOT NULL DEFAULT 'Guest';
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS guest_phone text;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS guest_email text;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS check_in date;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS check_out date;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS guests integer NOT NULL DEFAULT 1;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS nightly_rate numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS nights integer;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS cleaning_fee numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS taxes numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS total_amount numeric NOT NULL DEFAULT 0;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'KES';
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'direct';
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS external_booking_ref text;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid';
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS special_requests text;
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.short_stay_bookings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.short_stay_bookings SET property_id = l.property_id FROM public.short_stay_listings l WHERE short_stay_bookings.listing_id = l.id AND short_stay_bookings.property_id IS NULL;
-- `nights` may already be a GENERATED ALWAYS column on installations created by the earlier short-stay migrations.
-- PostgreSQL does not allow UPDATE against a generated column. Generated columns calculate
-- automatically from check_in/check_out, so no backfill is required. For legacy installations
-- where nights is a normal column, safely backfill it only when the column is not generated.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'short_stay_bookings'
      and column_name = 'nights'
      and is_generated = 'NEVER'
  ) then
    update public.short_stay_bookings
       set nights = greatest(1, check_out - check_in)
     where nights is null
       and check_in is not null
       and check_out is not null;
  end if;
end $$;
CREATE INDEX IF NOT EXISTS short_stay_booking_property_idx ON public.short_stay_bookings(property_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS short_stay_booking_listing_idx ON public.short_stay_bookings(listing_id, check_in, check_out);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.short_stay_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.short_stay_bookings TO authenticated;

-- -----------------------------------------------------------------------------
-- SALES COMPATIBILITY REPAIR
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_listings (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS property_id uuid;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS listing_code text;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS sale_type text NOT NULL DEFAULT 'property';
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'draft';
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS asking_price numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS negotiable boolean NOT NULL DEFAULT true;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS reservation_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS title_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS survey_verified boolean NOT NULL DEFAULT false;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS due_diligence_notes text;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS marketing_summary text;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.sale_listings ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.sale_listings SET listing_code='SALE-' || upper(substr(replace(id::text,'-',''),1,8)) WHERE listing_code IS NULL OR listing_code='';
CREATE UNIQUE INDEX IF NOT EXISTS sale_listing_code_uidx ON public.sale_listings(listing_code) WHERE listing_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS sale_listing_property_idx ON public.sale_listings(property_id, listing_status);
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sale_listings TO authenticated;

CREATE TABLE IF NOT EXISTS public.sale_offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS sale_listing_id uuid;
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS buyer_id uuid;
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS buyer_name text;
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS buyer_phone text;
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS offer_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS offer_status text NOT NULL DEFAULT 'submitted';
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.sale_offers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sale_offers TO authenticated;

CREATE TABLE IF NOT EXISTS public.sale_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS sale_listing_id uuid;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS buyer_id uuid;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS buyer_name text;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS buyer_phone text;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS agreed_price numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS deposit_amount numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS transaction_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS completion_date date;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS transfer_reference text;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.sale_transactions ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sale_transactions TO authenticated;

-- RLS compatibility: enable without assuming policies from a particular earlier phase.
ALTER TABLE public.sale_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sale_listings_select ON public.sale_listings;
CREATE POLICY sale_listings_select ON public.sale_listings FOR SELECT TO authenticated USING (
  listing_status='active' OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=sale_listings.property_id AND p.owner_id=auth.uid())
);
DROP POLICY IF EXISTS sale_listings_manage ON public.sale_listings;
CREATE POLICY sale_listings_manage ON public.sale_listings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=sale_listings.property_id AND p.owner_id=auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role='admin') OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id=sale_listings.property_id AND p.owner_id=auth.uid())
);

-- -----------------------------------------------------------------------------
-- SAFE PUBLIC UNIVERSAL MARKETPLACE CATALOG
-- One property row can carry rental, sale and short-stay availability metadata.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_universal_catalog()
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
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public
AS $$
  SELECT
    p.id, p.name, p.description, p.property_type,
    p.asset_class, p.operation_model, p.ownership_type,
    p.title_number, p.parcel_number, p.total_land_area, p.land_area_unit,
    p.zoning, p.year_built, p.county, p.sub_county, p.town, p.estate,
    p.street, p.address, COALESCE(p.number_of_units,0), COALESCE(p.number_of_floors,0),
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
