-- Phase 7: Universal Asset & Portfolio Foundation
-- Expands the PMS from house-only management to land, buildings, mixed-use assets and short-stay/Airbnb-style operations.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS asset_class text NOT NULL DEFAULT 'built_property',
  ADD COLUMN IF NOT EXISTS operation_model text NOT NULL DEFAULT 'long_term_rental',
  ADD COLUMN IF NOT EXISTS ownership_type text DEFAULT 'freehold',
  ADD COLUMN IF NOT EXISTS title_number text,
  ADD COLUMN IF NOT EXISTS parcel_number text,
  ADD COLUMN IF NOT EXISTS total_land_area numeric,
  ADD COLUMN IF NOT EXISTS land_area_unit text DEFAULT 'acres',
  ADD COLUMN IF NOT EXISTS zoning text,
  ADD COLUMN IF NOT EXISTS year_built integer;

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_asset_class_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_asset_class_check
  CHECK (asset_class IN ('built_property','land','mixed_use','development_project','other'));

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_operation_model_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_operation_model_check
  CHECK (operation_model IN ('long_term_rental','short_stay','sale','lease','land_sale','mixed'));

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_land_area_unit_check;
ALTER TABLE public.properties
  ADD CONSTRAINT properties_land_area_unit_check
  CHECK (land_area_unit IN ('acres','hectares','square_metres','square_feet'));

CREATE INDEX IF NOT EXISTS idx_properties_asset_class ON public.properties(asset_class);
CREATE INDEX IF NOT EXISTS idx_properties_operation_model ON public.properties(operation_model);
CREATE INDEX IF NOT EXISTS idx_properties_parcel_number ON public.properties(parcel_number);
CREATE INDEX IF NOT EXISTS idx_properties_title_number ON public.properties(title_number);

-- Land-specific register. A property can represent a parent development while this table records individual parcels.
CREATE TABLE IF NOT EXISTS public.land_parcels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  parcel_number text,
  title_number text,
  land_use text NOT NULL DEFAULT 'residential',
  tenure text DEFAULT 'freehold',
  acreage numeric,
  area_unit text NOT NULL DEFAULT 'acres' CHECK (area_unit IN ('acres','hectares','square_metres','square_feet')),
  zoning text,
  asking_price numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  sale_status text NOT NULL DEFAULT 'available' CHECK (sale_status IN ('available','reserved','under_offer','sold','withdrawn')),
  boundaries text,
  utilities text,
  access_description text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.land_parcels ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_land_parcels_property ON public.land_parcels(property_id);
CREATE INDEX IF NOT EXISTS idx_land_parcels_status ON public.land_parcels(sale_status);
CREATE INDEX IF NOT EXISTS idx_land_parcels_title ON public.land_parcels(title_number);

DROP POLICY IF EXISTS "land_parcels_public_read" ON public.land_parcels;
CREATE POLICY "land_parcels_public_read" ON public.land_parcels FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "land_parcels_owner_insert" ON public.land_parcels;
CREATE POLICY "land_parcels_owner_insert" ON public.land_parcels FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "land_parcels_owner_update" ON public.land_parcels;
CREATE POLICY "land_parcels_owner_update" ON public.land_parcels FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "land_parcels_owner_delete" ON public.land_parcels;
CREATE POLICY "land_parcels_owner_delete" ON public.land_parcels FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- Short-stay/Airbnb-style listing settings. This deliberately supports multiple channels without tying the system to one marketplace.
CREATE TABLE IF NOT EXISTS public.short_stay_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES public.property_units(id) ON DELETE SET NULL,
  listing_name text NOT NULL,
  channel text NOT NULL DEFAULT 'direct' CHECK (channel IN ('direct','airbnb','booking_com','expedia','vrbo','other')),
  external_listing_id text,
  external_listing_url text,
  listing_status text NOT NULL DEFAULT 'draft' CHECK (listing_status IN ('draft','active','paused','archived')),
  nightly_rate numeric NOT NULL DEFAULT 0,
  weekend_rate numeric,
  cleaning_fee numeric NOT NULL DEFAULT 0,
  security_deposit numeric NOT NULL DEFAULT 0,
  minimum_nights integer NOT NULL DEFAULT 1,
  maximum_nights integer NOT NULL DEFAULT 365,
  max_guests integer NOT NULL DEFAULT 1,
  check_in_time time NOT NULL DEFAULT '14:00',
  check_out_time time NOT NULL DEFAULT '10:00',
  instant_booking boolean NOT NULL DEFAULT false,
  house_rules text,
  cancellation_policy text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT short_stay_nights_check CHECK (minimum_nights >= 1 AND maximum_nights >= minimum_nights),
  CONSTRAINT short_stay_guests_check CHECK (max_guests >= 1)
);
ALTER TABLE public.short_stay_listings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_short_stay_property ON public.short_stay_listings(property_id);
CREATE INDEX IF NOT EXISTS idx_short_stay_unit ON public.short_stay_listings(unit_id);
CREATE INDEX IF NOT EXISTS idx_short_stay_status ON public.short_stay_listings(listing_status);
CREATE INDEX IF NOT EXISTS idx_short_stay_channel ON public.short_stay_listings(channel);

DROP POLICY IF EXISTS "short_stay_public_read" ON public.short_stay_listings;
CREATE POLICY "short_stay_public_read" ON public.short_stay_listings FOR SELECT TO anon, authenticated
  USING (listing_status = 'active' OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))));
DROP POLICY IF EXISTS "short_stay_owner_insert" ON public.short_stay_listings;
CREATE POLICY "short_stay_owner_insert" ON public.short_stay_listings FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid()) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
DROP POLICY IF EXISTS "short_stay_owner_update" ON public.short_stay_listings;
CREATE POLICY "short_stay_owner_update" ON public.short_stay_listings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))));
DROP POLICY IF EXISTS "short_stay_owner_delete" ON public.short_stay_listings;
CREATE POLICY "short_stay_owner_delete" ON public.short_stay_listings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))));

-- Booking ledger for short stays. It is separate from long-term reservation/lease records so nightly stays can have check-in/out dates.
CREATE TABLE IF NOT EXISTS public.short_stay_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.short_stay_listings(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_phone text,
  guest_email text,
  check_in date NOT NULL,
  check_out date NOT NULL,
  guests integer NOT NULL DEFAULT 1,
  nightly_rate numeric NOT NULL DEFAULT 0,
  nights integer GENERATED ALWAYS AS (GREATEST(check_out - check_in, 0)) STORED,
  cleaning_fee numeric NOT NULL DEFAULT 0,
  taxes numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'KES',
  channel text NOT NULL DEFAULT 'direct',
  external_booking_ref text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','checked_in','checked_out','cancelled','no_show')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid','refunded')),
  special_requests text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT short_stay_dates_check CHECK (check_out > check_in),
  CONSTRAINT short_stay_guest_count_check CHECK (guests >= 1)
);
ALTER TABLE public.short_stay_bookings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_short_stay_bookings_listing_dates ON public.short_stay_bookings(listing_id, check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_short_stay_bookings_guest ON public.short_stay_bookings(guest_id);
CREATE INDEX IF NOT EXISTS idx_short_stay_bookings_status ON public.short_stay_bookings(status);

DROP POLICY IF EXISTS "short_stay_bookings_read" ON public.short_stay_bookings;
CREATE POLICY "short_stay_bookings_read" ON public.short_stay_bookings FOR SELECT TO authenticated
  USING (guest_id = auth.uid() OR EXISTS (SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id WHERE l.id = listing_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))));
DROP POLICY IF EXISTS "short_stay_bookings_guest_insert" ON public.short_stay_bookings;
CREATE POLICY "short_stay_bookings_guest_insert" ON public.short_stay_bookings FOR INSERT TO authenticated
  WITH CHECK (guest_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'));
DROP POLICY IF EXISTS "short_stay_bookings_manage" ON public.short_stay_bookings;
CREATE POLICY "short_stay_bookings_manage" ON public.short_stay_bookings FOR UPDATE TO authenticated
  USING (guest_id = auth.uid() OR EXISTS (SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id WHERE l.id = listing_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))))
  WITH CHECK (guest_id = auth.uid() OR EXISTS (SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id WHERE l.id = listing_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))));
DROP POLICY IF EXISTS "short_stay_bookings_delete" ON public.short_stay_bookings;
CREATE POLICY "short_stay_bookings_delete" ON public.short_stay_bookings FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id WHERE l.id = listing_id AND (p.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.role = 'admin'))));

-- Explicit table privileges: RLS remains the authorization layer.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.land_parcels TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.short_stay_listings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.short_stay_bookings TO authenticated;

-- Reuse the existing audit trigger created by Phase 5 when available.
DO $$
BEGIN
  IF to_regprocedure('public.capture_audit_log()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS audit_land_parcels ON public.land_parcels;
    CREATE TRIGGER audit_land_parcels AFTER INSERT OR UPDATE OR DELETE ON public.land_parcels FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();
    DROP TRIGGER IF EXISTS audit_short_stay_listings ON public.short_stay_listings;
    CREATE TRIGGER audit_short_stay_listings AFTER INSERT OR UPDATE OR DELETE ON public.short_stay_listings FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();
    DROP TRIGGER IF EXISTS audit_short_stay_bookings ON public.short_stay_bookings;
    CREATE TRIGGER audit_short_stay_bookings AFTER INSERT OR UPDATE OR DELETE ON public.short_stay_bookings FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log();
  END IF;
END $$;

-- Keep updated_at consistent with the existing project trigger helper.
DO $$
BEGIN
  IF to_regprocedure('public.set_updated_at()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS set_land_parcels_updated_at ON public.land_parcels;
    CREATE TRIGGER set_land_parcels_updated_at BEFORE UPDATE ON public.land_parcels FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    DROP TRIGGER IF EXISTS set_short_stay_listings_updated_at ON public.short_stay_listings;
    CREATE TRIGGER set_short_stay_listings_updated_at BEFORE UPDATE ON public.short_stay_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    DROP TRIGGER IF EXISTS set_short_stay_bookings_updated_at ON public.short_stay_bookings;
    CREATE TRIGGER set_short_stay_bookings_updated_at BEFORE UPDATE ON public.short_stay_bookings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
