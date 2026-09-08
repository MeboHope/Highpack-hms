/* Phase 16 — repair Admin Settings writes.
   PostgREST needs explicit table privileges before RLS can authorize the request.
   RLS remains the authorization layer and allows writes only to admin profiles.
*/
GRANT INSERT, UPDATE, DELETE ON public.system_settings TO authenticated;

DROP POLICY IF EXISTS "settings_admin_write" ON public.system_settings;
CREATE POLICY "settings_admin_write" ON public.system_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
