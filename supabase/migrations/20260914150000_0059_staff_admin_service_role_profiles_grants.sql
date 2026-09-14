-- Phase 37 V6: Staff administration service-role privilege repair.
-- The staff-admin Edge Function uses the trusted service-role client for
-- Super Admin identity checks and staff mutations. RLS bypass alone does not
-- replace table-level privileges, so explicitly grant only the operations the
-- function needs.

GRANT USAGE ON SCHEMA public TO service_role;

-- Super Admin caller lookup and invited-profile promotion/update.
GRANT SELECT, UPDATE ON TABLE public.profiles TO service_role;

-- Staff role lookup and staff membership lifecycle.
GRANT SELECT ON TABLE public.staff_roles TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE public.staff_members TO service_role;

-- Staff property assignments are read by the RBAC layer and may be managed
-- by future server-side staff workflows.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.staff_property_assignments TO service_role;

-- Sensitive staff-management actions are audited server-side.
GRANT INSERT ON TABLE public.audit_logs TO service_role;

NOTIFY pgrst, 'reload schema';
