-- Phase 49 — security hardening continuation.
-- Protects identity/privilege fields from browser-side role escalation and
-- prevents clients from forging audit-log ownership. Service-role workflows
-- used by trusted Edge Functions remain supported.

CREATE OR REPLACE FUNCTION public.guard_profile_security_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id THEN
      RAISE EXCEPTION 'Profile identity cannot be changed' USING ERRCODE = '42501';
    END IF;

    IF NEW.role IS DISTINCT FROM OLD.role
       OR COALESCE(NEW.is_super_admin, false) IS DISTINCT FROM COALESCE(OLD.is_super_admin, false) THEN
      IF auth.role() <> 'service_role'
         AND NOT (EXISTS (SELECT 1 FROM public.profiles actor WHERE actor.id = auth.uid() AND actor.role = 'admin' AND COALESCE(actor.is_super_admin, false) = true) AND public.staff_mfa_satisfied()) THEN
        RAISE EXCEPTION 'Staff privilege changes require authorized administration and MFA' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_profile_security_fields ON public.profiles;
CREATE TRIGGER trg_guard_profile_security_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_security_fields();

-- The legacy policy allowed any authenticated user to write an arbitrary
-- audit user_id. Keep application auditing available, but bind client writes
-- to the authenticated identity. Trusted service-role functions can still
-- write system-generated audit events.
DROP POLICY IF EXISTS "audit_insert" ON public.audit_logs;
DROP POLICY IF EXISTS audit_client_insert ON public.audit_logs;
CREATE POLICY audit_client_insert ON public.audit_logs
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND auth.role() = 'authenticated'
);

-- Defense-in-depth: clients cannot directly mutate an audit record after it
-- has been created. Administrative reporting remains read-only through RLS.
DROP POLICY IF EXISTS audit_client_update ON public.audit_logs;
DROP POLICY IF EXISTS audit_client_delete ON public.audit_logs;

REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated;
GRANT INSERT ON public.audit_logs TO authenticated;

-- Keep sensitive audit history available to the existing admin centre while
-- using the Phase 38 staff permission model where available.
DROP POLICY IF EXISTS "audit_admin_read" ON public.audit_logs;
CREATE POLICY audit_admin_read ON public.audit_logs
FOR SELECT TO authenticated
USING (
  public.staff_has_permission('audit.view')
  OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin' AND COALESCE(p.is_super_admin, false) = true
  )
);

CREATE INDEX IF NOT EXISTS idx_profiles_role_super_admin
  ON public.profiles(role, is_super_admin);

NOTIFY pgrst, 'reload schema';
