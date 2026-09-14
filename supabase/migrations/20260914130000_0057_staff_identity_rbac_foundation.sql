-- Phase 36: Staff identity, role and permission foundation.
-- Existing admin accounts remain fully compatible. New staff members are represented
-- as normal authenticated users with profiles.role='admin' plus a dedicated staff role.
-- This keeps the current admin RLS model intact while giving HighPark a safe foundation
-- for progressively narrowing module access in subsequent phases.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_super_admin
  ON public.profiles(is_super_admin) WHERE is_super_admin = true;

CREATE TABLE IF NOT EXISTS public.staff_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_roles_admin_read ON public.staff_roles;
CREATE POLICY staff_roles_admin_read ON public.staff_roles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

INSERT INTO public.staff_roles (role_key, name, description, permissions)
VALUES
  ('property_manager', 'Property Manager', 'Portfolio operations, occupants, leases and maintenance.', '["properties.view","properties.manage","units.view","units.manage","leases.view","leases.manage","maintenance.view","maintenance.manage","tenants.view","documents.view"]'::jsonb),
  ('finance_officer', 'Finance Officer', 'Collections, expenses, owner settlements and financial reporting.', '["payments.view","payments.manage","expenses.view","expenses.manage","tax.view","tax.manage","reports.view"]'::jsonb),
  ('sales_officer', 'Sales & Lettings Officer', 'Sales listings, enquiries, viewings and marketplace operations.', '["properties.view","sales.view","sales.manage","enquiries.view","enquiries.manage","viewings.view","viewings.manage"]'::jsonb),
  ('compliance_officer', 'Compliance & Verification Officer', 'Property verification, documentation and compliance workflows.', '["properties.view","properties.verify","documents.view","documents.manage","audit.view"]'::jsonb),
  ('support_officer', 'Customer Support Officer', 'Customer communication, enquiries, appointments and notifications.', '["customers.view","messages.view","messages.manage","enquiries.view","enquiries.manage","viewings.view","viewings.manage","notifications.manage"]'::jsonb)
ON CONFLICT (role_key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  permissions = EXCLUDED.permissions,
  updated_at = now();

CREATE TABLE IF NOT EXISTS public.staff_members (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  staff_role_id uuid NOT NULL REFERENCES public.staff_roles(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_members_admin_read ON public.staff_members;
CREATE POLICY staff_members_admin_read ON public.staff_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

DROP POLICY IF EXISTS staff_members_super_admin_write ON public.staff_members;
CREATE POLICY staff_members_super_admin_write ON public.staff_members
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_super_admin = true));

CREATE TABLE IF NOT EXISTS public.staff_property_assignments (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, property_id)
);

ALTER TABLE public.staff_property_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS staff_property_assignments_admin_read ON public.staff_property_assignments;
CREATE POLICY staff_property_assignments_admin_read ON public.staff_property_assignments
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
DROP POLICY IF EXISTS staff_property_assignments_super_admin_write ON public.staff_property_assignments;
CREATE POLICY staff_property_assignments_super_admin_write ON public.staff_property_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_super_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_super_admin = true));

CREATE OR REPLACE FUNCTION public.my_staff_access()
RETURNS TABLE (
  is_admin boolean,
  is_super_admin boolean,
  staff_role_key text,
  staff_role_name text,
  permissions jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    COALESCE(p.role = 'admin', false),
    COALESCE(p.is_super_admin, false),
    sr.role_key,
    sr.name,
    COALESCE(sr.permissions, '[]'::jsonb)
  FROM public.profiles p
  LEFT JOIN public.staff_members sm ON sm.user_id = p.id AND sm.status = 'active'
  LEFT JOIN public.staff_roles sr ON sr.id = sm.staff_role_id
  WHERE p.id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.my_staff_access() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_staff_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.bootstrap_super_admin()
RETURNS public.profiles
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_profile public.profiles;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE is_super_admin = true) THEN
    SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid() AND role = 'admin' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Only an existing administrator can bootstrap Super Admin'; END IF;
    UPDATE public.profiles SET is_super_admin = true, updated_at = now() WHERE id = auth.uid() RETURNING * INTO v_profile;
    RETURN v_profile;
  END IF;
  RAISE EXCEPTION 'A Super Admin already exists';
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_super_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_members_for_admin()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  phone text,
  role text,
  is_super_admin boolean,
  staff_status text,
  staff_role_key text,
  staff_role_name text,
  permissions jsonb,
  created_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.phone, p.role, p.is_super_admin,
         sm.status, sr.role_key, sr.name, sr.permissions, p.created_at
  FROM public.profiles p
  LEFT JOIN public.staff_members sm ON sm.user_id = p.id
  LEFT JOIN public.staff_roles sr ON sr.id = sm.staff_role_id
  WHERE EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me.role = 'admin')
    AND (p.role = 'admin' OR sm.user_id IS NOT NULL)
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.staff_members_for_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_members_for_admin() TO authenticated;

NOTIFY pgrst, 'reload schema';
