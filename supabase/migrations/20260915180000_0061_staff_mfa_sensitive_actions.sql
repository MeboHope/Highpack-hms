-- Phase 46: require an AAL2 session for staff write/sensitive operations.
-- Read-only staff browsing remains available, but mutations and sensitive workflows
-- require a verified MFA factor. The JWT AAL claim is checked server-side in RLS/RPCs.

CREATE OR REPLACE FUNCTION public.staff_mfa_satisfied()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((auth.jwt() ->> 'aal') = 'aal2', false);
$$;

CREATE OR REPLACE FUNCTION public.staff_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.staff_members sm ON sm.user_id = p.id AND sm.status = 'active'
    LEFT JOIN public.staff_roles sr ON sr.id = sm.staff_role_id
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND (
        -- Super Admin is still subject to MFA for mutations/sensitive permissions.
        (
          COALESCE(p.is_super_admin, false)
          AND (p_permission LIKE '%.view' OR p_permission = 'dashboard.view' OR p_permission = 'audit.view' OR public.staff_mfa_satisfied())
        )
        OR (
          COALESCE(sr.permissions, '[]'::jsonb) ? p_permission
          AND (p_permission LIKE '%.view' OR p_permission = 'dashboard.view' OR p_permission = 'audit.view' OR public.staff_mfa_satisfied())
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_can_access_property(
  p_property_id uuid,
  p_permission text DEFAULT 'properties.view'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.staff_members sm ON sm.user_id = p.id AND sm.status = 'active'
    LEFT JOIN public.staff_roles sr ON sr.id = sm.staff_role_id
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND (
        COALESCE(p.is_super_admin, false)
        OR (
          COALESCE(sr.permissions, '[]'::jsonb) ? p_permission
          AND EXISTS (
            SELECT 1 FROM public.staff_property_assignments spa
            WHERE spa.user_id = p.id AND spa.property_id = p_property_id
          )
        )
      )
      AND (
        p_permission LIKE '%.view'
        OR p_permission = 'dashboard.view'
        OR p_permission = 'audit.view'
        OR public.staff_mfa_satisfied()
      )
  );
$$;

REVOKE ALL ON FUNCTION public.staff_mfa_satisfied() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_can_access_property(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_mfa_satisfied() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_can_access_property(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
