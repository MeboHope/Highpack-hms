-- Phase 5: Notifications + Activity/Audit Centre
-- Adds automatic audit capture for high-value operational records.

CREATE OR REPLACE FUNCTION public.capture_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, previous_value, new_value
  ) VALUES (
    actor,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'properties',
    'property_units',
    'reservations',
    'payments',
    'leases',
    'rent_invoices',
    'expenses',
    'maintenance_requests',
    'tax_records',
    'owner_payouts'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_audit_log()', t, t);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.get_admin_audit_page(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_entity_type text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
  v_offset integer := (v_page - 1) * v_size;
  v_total integer;
  v_rows jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT count(*) INTO v_total
  FROM audit_logs a
  WHERE (NULLIF(trim(p_entity_type), '') IS NULL OR a.entity_type = trim(p_entity_type))
    AND (NULLIF(trim(p_action), '') IS NULL OR a.action = trim(p_action))
    AND (
      NULLIF(trim(p_query), '') IS NULL
      OR a.action ILIKE '%' || trim(p_query) || '%'
      OR a.entity_type ILIKE '%' || trim(p_query) || '%'
      OR a.entity_id::text ILIKE '%' || trim(p_query) || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.previous_value, a.new_value, a.created_at,
           p.full_name AS user_name, p.role AS user_role
    FROM audit_logs a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE (NULLIF(trim(p_entity_type), '') IS NULL OR a.entity_type = trim(p_entity_type))
      AND (NULLIF(trim(p_action), '') IS NULL OR a.action = trim(p_action))
      AND (
        NULLIF(trim(p_query), '') IS NULL
        OR a.action ILIKE '%' || trim(p_query) || '%'
        OR a.entity_type ILIKE '%' || trim(p_query) || '%'
        OR a.entity_id::text ILIKE '%' || trim(p_query) || '%'
      )
    ORDER BY a.created_at DESC
    OFFSET v_offset LIMIT v_size
  ) x;

  RETURN jsonb_build_object(
    'rows', v_rows,
    'page', v_page,
    'page_size', v_size,
    'total', v_total,
    'total_pages', GREATEST(1, CEIL(v_total::numeric / v_size)::integer)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_page(integer, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_page(integer, integer, text, text, text) TO authenticated;
