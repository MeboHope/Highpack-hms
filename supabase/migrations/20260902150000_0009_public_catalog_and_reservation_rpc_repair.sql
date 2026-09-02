/* HighPark Consult — production repair
   1) Guarantees the 3-argument reservation RPC exists for PostgREST.
   2) Repairs public catalog access for verified properties/units.
   3) Provides a safe SECURITY DEFINER catalog RPC as a fallback where an
      existing Supabase project has stale/overlapping RLS policies.
*/

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.properties TO anon, authenticated;
GRANT SELECT ON public.property_units TO anon, authenticated;
GRANT SELECT ON public.system_settings TO anon, authenticated;

DROP POLICY IF EXISTS "properties_public_verified_read" ON public.properties;
CREATE POLICY "properties_public_verified_read"
ON public.properties FOR SELECT TO anon, authenticated
USING (status = 'verified');

DROP POLICY IF EXISTS "units_public_verified_read" ON public.property_units;
CREATE POLICY "units_public_verified_read"
ON public.property_units FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_units.property_id
      AND p.status = 'verified'
  )
);

-- The transactional reservation RPC. SECURITY DEFINER allows the transaction
-- to update the reserved unit and create the pending payment atomically while
-- the function itself validates the signed-in customer and verified property.
CREATE OR REPLACE FUNCTION public.create_reservation(
  p_unit_id uuid,
  p_duration_hours integer DEFAULT 48,
  p_payment_method text DEFAULT 'mpesa'
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit public.property_units%ROWTYPE;
  v_existing public.reservations%ROWTYPE;
  v_res public.reservations%ROWTYPE;
  v_customer uuid := auth.uid();
  v_fee numeric;
  v_hours integer := GREATEST(1, LEAST(COALESCE(p_duration_hours, 48), 168));
  v_method text := lower(COALESCE(p_payment_method, 'mpesa'));
BEGIN
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to reserve a property';
  END IF;

  IF v_method NOT IN ('mpesa','card','bank_transfer') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT * INTO v_unit
  FROM public.property_units
  WHERE id = p_unit_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected unit could not be found';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = v_unit.property_id AND status = 'verified'
  ) THEN
    RAISE EXCEPTION 'This property is not currently available for reservation';
  END IF;

  IF v_unit.status <> 'available' THEN
    RAISE EXCEPTION 'This unit is no longer available';
  END IF;

  SELECT * INTO v_existing
  FROM public.reservations
  WHERE unit_id = p_unit_id
    AND status IN ('pending','confirmed')
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    RAISE EXCEPTION 'This unit has already been reserved';
  END IF;

  SELECT reservation_fee INTO v_fee
  FROM public.system_settings
  WHERE id = 1;

  v_fee := COALESCE(v_unit.reservation_fee, v_fee, 2000);

  UPDATE public.property_units
  SET status = 'reserved', updated_at = now()
  WHERE id = v_unit.id;

  INSERT INTO public.reservations (
    unit_id, property_id, customer_id, reservation_fee, status, expires_at
  )
  VALUES (
    v_unit.id, v_unit.property_id, v_customer, v_fee, 'pending',
    now() + make_interval(hours => v_hours)
  )
  RETURNING * INTO v_res;

  INSERT INTO public.payments (
    user_id, reservation_id, property_id, unit_id, amount,
    payment_type, payment_method, status, verified
  )
  VALUES (
    v_customer, v_res.id, v_unit.property_id, v_unit.id, v_fee,
    'reservation', v_method, 'pending', false
  );

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reservation(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, integer, text) TO authenticated;

-- Safe public catalog: no owner identity, financial information or private
-- records are returned. Only verified properties are exposed.
CREATE OR REPLACE FUNCTION public.get_public_property_catalog()
RETURNS TABLE (
  property_id uuid,
  name text,
  description text,
  property_type text,
  county text,
  sub_county text,
  town text,
  estate text,
  address text,
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
    p.id, p.name, p.description, p.property_type, p.county,
    p.sub_county, p.town, p.estate, p.address, p.number_of_units,
    p.number_of_floors, p.amenities, p.parking, p.water_availability,
    p.electricity, p.photos, p.audio, p.created_at,
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

-- Ask PostgREST to refresh its function/schema cache immediately.
NOTIFY pgrst, 'reload schema';
