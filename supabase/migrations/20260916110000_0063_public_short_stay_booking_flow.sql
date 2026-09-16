-- Phase 48: customer-facing short-stay booking flow.
-- Public discovery is read-only through a SECURITY DEFINER RPC. Booking creation
-- is transactional and validates ownership of the listing, dates, capacity and overlap.

CREATE OR REPLACE FUNCTION public.get_public_short_stay_listing(p_property_id uuid)
RETURNS TABLE (
  id uuid, property_id uuid, unit_id uuid, listing_name text, listing_status text,
  booking_mode text, nightly_rate numeric, weekend_rate numeric, cleaning_fee numeric,
  security_deposit numeric, service_fee_percent numeric, minimum_nights integer,
  maximum_nights integer, max_guests integer, check_in_time time, check_out_time time,
  house_rules text, cancellation_policy text, direct_booking_enabled boolean
)
LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
  SELECT l.id,l.property_id,l.unit_id,l.listing_name,l.listing_status,l.booking_mode,
         l.nightly_rate,l.weekend_rate,l.cleaning_fee,l.security_deposit,l.service_fee_percent,
         l.minimum_nights,l.maximum_nights,l.max_guests,l.check_in_time,l.check_out_time,
         l.house_rules,l.cancellation_policy,l.direct_booking_enabled
  FROM public.short_stay_listings l
  JOIN public.properties p ON p.id=l.property_id
  WHERE l.property_id=p_property_id AND l.listing_status='active' AND p.status='verified'
  ORDER BY l.created_at DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_public_short_stay_listing(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_short_stay_listing(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_short_stay_booking(
  p_listing_id uuid,
  p_check_in date,
  p_check_out date,
  p_guests integer DEFAULT 1,
  p_special_requests text DEFAULT NULL
)
RETURNS public.short_stay_bookings
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_guest uuid := auth.uid();
  v_listing public.short_stay_listings%ROWTYPE;
  v_property public.properties%ROWTYPE;
  v_booking public.short_stay_bookings%ROWTYPE;
  v_nights integer;
  v_nightly numeric;
  v_cleaning numeric;
  v_service numeric;
  v_total numeric;
  v_name text;
  v_phone text;
BEGIN
  IF v_guest IS NULL THEN RAISE EXCEPTION 'You must be signed in to book a short stay'; END IF;
  SELECT * INTO v_listing FROM public.short_stay_listings WHERE id=p_listing_id FOR SHARE;
  IF NOT FOUND OR v_listing.listing_status <> 'active' OR NOT v_listing.direct_booking_enabled THEN
    RAISE EXCEPTION 'This short-stay listing is not currently available for direct booking';
  END IF;
  SELECT * INTO v_property FROM public.properties WHERE id=v_listing.property_id;
  IF NOT FOUND OR v_property.status <> 'verified' THEN RAISE EXCEPTION 'This property is not currently available'; END IF;
  IF p_check_in IS NULL OR p_check_out IS NULL OR p_check_out <= p_check_in THEN RAISE EXCEPTION 'Please select valid check-in and check-out dates'; END IF;
  v_nights := p_check_out - p_check_in;
  IF v_nights < v_listing.minimum_nights OR v_nights > v_listing.maximum_nights THEN
    RAISE EXCEPTION 'This listing requires between % and % nights', v_listing.minimum_nights, v_listing.maximum_nights;
  END IF;
  IF p_guests < 1 OR p_guests > v_listing.max_guests THEN RAISE EXCEPTION 'This listing allows up to % guests', v_listing.max_guests; END IF;

  -- Serialize booking decisions per listing to prevent two concurrent requests
  -- from both passing the overlap check.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_listing_id::text, 0));
  IF EXISTS (
    SELECT 1 FROM public.short_stay_bookings b
    WHERE b.listing_id=p_listing_id AND b.status IN ('pending','confirmed','checked_in')
      AND b.check_in < p_check_out AND b.check_out > p_check_in
  ) THEN RAISE EXCEPTION 'Those dates are no longer available. Please choose different dates'; END IF;

  SELECT COALESCE(NULLIF(trim(full_name),''),'Guest'), phone INTO v_name,v_phone FROM public.profiles WHERE id=v_guest;
  v_nightly := v_listing.nightly_rate;
  v_cleaning := COALESCE(v_listing.cleaning_fee,0);
  v_service := round((v_nightly * v_nights) * COALESCE(v_listing.service_fee_percent,0) / 100, 2);
  v_total := round((v_nightly * v_nights) + v_cleaning + v_service, 2);

  INSERT INTO public.short_stay_bookings (
    listing_id,property_id,unit_id,guest_id,guest_name,guest_phone,guest_email,channel,
    check_in,check_out,guests,nightly_rate,cleaning_fee,service_fee,total_amount,
    status,payment_status,special_requests,created_by
  ) VALUES (
    v_listing.id,v_listing.property_id,v_listing.unit_id,v_guest,v_name,v_phone,NULL,'direct',
    p_check_in,p_check_out,p_guests,v_nightly,v_cleaning,v_service,v_total,
    'pending','unpaid',NULLIF(trim(p_special_requests),''),v_guest
  ) RETURNING * INTO v_booking;
  RETURN v_booking;
END;
$$;
REVOKE ALL ON FUNCTION public.create_short_stay_booking(uuid,date,date,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_short_stay_booking(uuid,date,date,integer,text) TO authenticated;
