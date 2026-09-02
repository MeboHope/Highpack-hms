/*
  HighPark Consult — media storage + reporting hardening

  Run this migration in Supabase SQL Editor after migrations 0001-0004.
*/

-- Public bucket: URLs can be displayed on the public property portal.
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-media', 'property-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "property_media_insert_owner" ON storage.objects;
CREATE POLICY "property_media_insert_owner"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "property_media_select_owner" ON storage.objects;
CREATE POLICY "property_media_select_owner"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "property_media_delete_owner" ON storage.objects;
CREATE POLICY "property_media_delete_owner"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'property-media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);


-- Only verified listings are public. Owners/admins retain access to records they manage.
DROP POLICY IF EXISTS "properties_public_read" ON public.properties;
CREATE POLICY "properties_public_read" ON public.properties
FOR SELECT TO anon, authenticated
USING (
  status = 'verified'
  OR auth.uid() = owner_id
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

DROP POLICY IF EXISTS "units_public_read" ON public.property_units;
CREATE POLICY "units_public_read" ON public.property_units
FOR SELECT TO anon, authenticated
USING (
  EXISTS (SELECT 1 FROM public.properties WHERE id = property_id AND (status = 'verified' OR owner_id = auth.uid()))
  OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Helpful indexes for portfolio dashboards and tax/reporting queries.
CREATE INDEX IF NOT EXISTS idx_payments_property_type_status
ON public.payments(property_id, payment_type, status, verified, created_at);

CREATE INDEX IF NOT EXISTS idx_expenses_property_date
ON public.expenses(property_id, expense_date);

CREATE INDEX IF NOT EXISTS idx_tax_property_period
ON public.tax_records(property_id, period);
