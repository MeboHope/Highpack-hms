-- Phase 37: Staff RBAC table grants repair.
-- RLS policies control row visibility, but authenticated clients also need
-- table-level privileges before those policies can be evaluated.

GRANT SELECT ON TABLE public.staff_roles TO authenticated;
GRANT SELECT ON TABLE public.staff_members TO authenticated;
GRANT SELECT ON TABLE public.staff_property_assignments TO authenticated;

-- Staff mutations are performed by the trusted staff-admin Edge Function
-- using the service role. Keep direct client writes restricted to the
-- Super Admin RLS policy rather than granting INSERT/UPDATE/DELETE here.

NOTIFY pgrst, 'reload schema';
