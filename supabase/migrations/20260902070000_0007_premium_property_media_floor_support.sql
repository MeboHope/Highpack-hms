/* HighPark Consult — property structure + audio media support
   Run after migrations 0001-0006. */

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS number_of_floors integer NOT NULL DEFAULT 1;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS audio text[] NOT NULL DEFAULT '{}';

UPDATE public.properties
SET number_of_floors = GREATEST(COALESCE(number_of_floors, 1), 1)
WHERE number_of_floors IS NULL OR number_of_floors < 1;

UPDATE storage.buckets
SET public = true,
    file_size_limit = 104857600,
    allowed_mime_types = ARRAY[
      'image/jpeg','image/png','image/webp',
      'video/mp4','video/webm','video/quicktime',
      'audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/x-m4a'
    ]
WHERE id = 'property-media';

DROP POLICY IF EXISTS "property_media_insert_owner" ON storage.objects;
CREATE POLICY "property_media_insert_owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('owner','agent','admin'))
);

DROP POLICY IF EXISTS "property_media_public_read" ON storage.objects;
CREATE POLICY "property_media_public_read"
ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'property-media');

DROP POLICY IF EXISTS "property_media_delete_owner" ON storage.objects;
CREATE POLICY "property_media_delete_owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'property-media'
  AND ((storage.foldername(name))[1] = auth.uid()::text
       OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
);

-- Allow a tenant/customer with an active reservation to submit a pre-move-in service request.
DROP POLICY IF EXISTS "maintenance_insert" ON public.maintenance_requests;
CREATE POLICY "maintenance_insert" ON public.maintenance_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = tenant_id
  AND (
    EXISTS (SELECT 1 FROM public.leases l WHERE l.tenant_id = auth.uid() AND l.unit_id = public.maintenance_requests.unit_id AND l.status = 'active')
    OR EXISTS (SELECT 1 FROM public.reservations r WHERE r.customer_id = auth.uid() AND r.unit_id = public.maintenance_requests.unit_id AND r.status IN ('pending','confirmed'))
  )
);
