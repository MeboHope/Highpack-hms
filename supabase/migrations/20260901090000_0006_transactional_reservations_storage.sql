/*
  HighPark Consult — transactional reservation creation + storage hardening

  Run after migrations 0001-0005.
*/

-- Keep the media bucket usable for normal property photos and walkthrough videos.
UPDATE storage.buckets
SET public = true,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp',
      'video/mp4','video/webm','video/quicktime'
    ]
WHERE id = 'property-media';

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-media', 'property-media', true, 104857600,
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm','video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "property_media_public_read" ON storage.objects;
CREATE POLICY "property_media_public_read"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'property-media');

DROP POLICY IF EXISTS "property_media_insert_owner" ON storage.objects;
CREATE POLICY "property_media_insert_owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role IN ('owner','agent','admin')
  )
);

DROP POLICY IF EXISTS "property_media_select_owner" ON storage.objects;
CREATE POLICY "property_media_select_owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
);

DROP POLICY IF EXISTS "property_media_delete_owner" ON storage.objects;
CREATE POLICY "property_media_delete_owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'property-media'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
);

-- Ensure a settings row exists even if the seed migration was not applied.
INSERT INTO public.system_settings (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- Reservation creation is atomic and locks the unit to prevent race conditions.
CREATE OR REPLACE FUNCTION public.create_reservation(
  p_unit_id uuid,
  p_duration_hours integer DEFAULT 48
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
BEGIN
  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to reserve a property';
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

  UPDATE public.property_units SET status = 'reserved', updated_at = now() WHERE id = v_unit.id;

  INSERT INTO public.reservations (
    unit_id, property_id, customer_id, reservation_fee, status, expires_at
  )
  VALUES (
    v_unit.id,
    v_unit.property_id,
    v_customer,
    v_fee,
    'pending',
    now() + make_interval(hours => v_hours)
  )
  RETURNING * INTO v_res;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, integer) TO authenticated;
