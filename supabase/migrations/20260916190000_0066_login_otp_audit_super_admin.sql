-- Phase 51 — mandatory email OTP login gate, professional audit telemetry,
-- and a dedicated Super Admin command centre foundation.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS ip_address inet,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS session_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS severity text NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'application';

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_created_at ON public.audit_logs(ip_address, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_severity_created_at ON public.audit_logs(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_source_created_at ON public.audit_logs(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON public.audit_logs(session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.login_otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  code_hash text NOT NULL,
  client_nonce_hash text NOT NULL,
  ip_address inet,
  user_agent text,
  expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 10),
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.login_otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.login_otp_challenges FROM anon, authenticated, public;
GRANT ALL ON TABLE public.login_otp_challenges TO service_role;

CREATE INDEX IF NOT EXISTS idx_login_otp_user_created ON public.login_otp_challenges(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_login_otp_expiry ON public.login_otp_challenges(expires_at);

-- Keep the existing data-change audit trigger, but enrich every event with
-- request context supplied by PostgREST.
CREATE OR REPLACE FUNCTION public.capture_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  actor uuid := auth.uid();
  headers jsonb := NULLIF(current_setting('request.headers', true), '')::jsonb;
  jwt jsonb := NULLIF(current_setting('request.jwt.claims', true), '')::jsonb;
  req_ip text := split_part(COALESCE(headers->>'x-forwarded-for', headers->>'cf-connecting-ip', headers->>'x-real-ip', ''), ',', 1);
  req_user_agent text := headers->>'user-agent';
  req_session uuid := NULLIF(jwt->>'session_id', '')::uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id, action, entity_type, entity_id, previous_value, new_value,
    ip_address, user_agent, session_id, metadata, severity, source
  ) VALUES (
    actor,
    TG_OP,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    CASE WHEN req_ip ~ '^[0-9a-fA-F:.]+$' THEN req_ip::inet ELSE NULL END,
    req_user_agent,
    req_session,
    jsonb_build_object('table', TG_TABLE_NAME, 'operation', TG_OP),
    CASE WHEN TG_OP = 'DELETE' THEN 'warning' ELSE 'info' END,
    'database_trigger'
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
EXCEPTION WHEN others THEN
  -- Audit capture must never break a legitimate business transaction.
  RAISE WARNING 'Audit capture failed for %.%: %', TG_TABLE_SCHEMA, TG_TABLE_NAME, SQLERRM;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;



-- The secure-login Edge Function must validate a password before an OTP is
-- created, but it must not issue a JWT during that preflight. The normal
-- Supabase Auth password endpoint is intentionally blocked by the Phase 51
-- custom access-token hook, so use a tightly scoped server-only verifier.
-- Supabase Auth stores password hashes in auth.users.encrypted_password.
CREATE OR REPLACE FUNCTION public.verify_login_password(
  p_email text,
  p_password text
)
RETURNS TABLE(user_id uuid, email text, password_valid boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_hash text;
  v_valid boolean := false;
BEGIN
  SELECT u.id, u.email, u.encrypted_password
    INTO v_user_id, v_email, v_hash
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
    AND COALESCE(u.deleted_at, NULL) IS NULL
  LIMIT 1;

  IF v_user_id IS NULL OR v_hash IS NULL OR v_hash = '' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::text, false;
    RETURN;
  END IF;

  -- Current HighPark Consult accounts use Supabase's bcrypt password hashes.
  -- crypt() never returns or exposes the stored hash to the caller.
  BEGIN
    v_valid := extensions.crypt(p_password, v_hash) = v_hash;
  EXCEPTION WHEN others THEN
    v_valid := false;
  END;

  RETURN QUERY SELECT v_user_id, v_email, v_valid;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_login_password(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_login_password(text, text) TO service_role;

-- A short-lived, one-time server-side gate. The Auth custom access-token hook
-- calls this function before issuing password/OTP/magic-link login tokens.
CREATE OR REPLACE FUNCTION public.consume_login_otp_challenge(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  challenge_id uuid;
BEGIN
  SELECT id INTO challenge_id
  FROM public.login_otp_challenges
  WHERE user_id = p_user_id
    AND verified_at IS NOT NULL
    AND consumed_at IS NULL
    AND expires_at > now()
  ORDER BY verified_at DESC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF challenge_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.login_otp_challenges
  SET consumed_at = now()
  WHERE id = challenge_id;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_login_otp_challenge(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_login_otp_challenge(uuid) TO service_role, supabase_auth_admin;

-- Auth custom access-token hook: direct password, OTP and magic-link login
-- attempts cannot receive a usable session until the email OTP challenge has
-- been completed. Refresh tokens are intentionally unaffected.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  auth_method text := COALESCE(event->>'authentication_method', '');
  user_id_value uuid := NULLIF(event->>'user_id', '')::uuid;
  claims jsonb := COALESCE(event->'claims', '{}'::jsonb);
  allowed boolean;
BEGIN
  IF auth_method IN ('password', 'otp', 'magiclink') THEN
    SELECT public.consume_login_otp_challenge(user_id_value) INTO allowed;
    IF NOT allowed THEN
      RAISE EXCEPTION 'Email verification code required before sign-in.' USING ERRCODE = '42501';
    END IF;
    claims := jsonb_set(claims, '{login_otp_verified}', 'true'::jsonb, true);
  END IF;

  event := jsonb_set(event, '{claims}', claims, true);
  RETURN event;
END;
$$;

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM anon, authenticated, public;


-- Security operators can use the existing Sign out all devices control. We do
-- not mass-delete existing sessions automatically in a migration because that
-- would unexpectedly sign out every user during deployment.

-- Gate every authenticated Data API table behind the same login verification.
-- Anonymous public marketplace reads remain unaffected because the policy is
-- explicitly scoped to the authenticated role.
CREATE OR REPLACE FUNCTION public.login_otp_verified()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.login_otp_challenges
    WHERE user_id = auth.uid()
      AND verified_at IS NOT NULL
      AND expires_at > now()
      AND consumed_at IS NOT NULL
      AND consumed_at >= verified_at
      AND created_at > now() - interval '24 hours'
  );
$$;
REVOKE ALL ON FUNCTION public.login_otp_verified() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.login_otp_verified() TO authenticated, service_role;

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'audit_logs','expenses','favorites','leases','maintenance_requests','messages',
    'notifications','owner_payouts','payments','profiles','properties','property_units',
    'rent_invoices','reservations','system_settings','tax_records','viewing_appointments',
    'documents','kra_etims_settings','kra_etims_submission_log','land_parcels','sale_listings',
    'sale_offers','sale_transactions','short_stay_bookings','short_stay_listings',
    'staff_members','staff_property_assignments','staff_roles'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS hp_login_otp_gate ON public.%I', t);
      EXECUTE format('CREATE POLICY hp_login_otp_gate ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.login_otp_verified()) WITH CHECK (public.login_otp_verified())', t);
    END IF;
  END LOOP;
END $$;

-- Professional paginated audit API for Super Admins and authorized audit staff.
DROP FUNCTION IF EXISTS public.get_admin_audit_page(integer, integer, text, text, text);
CREATE OR REPLACE FUNCTION public.get_admin_audit_page(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25,
  p_entity_type text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_query text DEFAULT NULL,
  p_severity text DEFAULT NULL,
  p_source text DEFAULT NULL,
  p_ip text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_page integer := GREATEST(COALESCE(p_page, 1), 1);
  v_size integer := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_offset integer := (v_page - 1) * v_size;
  v_total integer;
  v_rows jsonb;
  v_allowed boolean;
BEGIN
  SELECT (
    public.staff_has_permission('audit.view')
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND COALESCE(p.is_super_admin, false))
  ) INTO v_allowed;
  IF NOT v_allowed THEN RAISE EXCEPTION 'Audit access required' USING ERRCODE = '42501'; END IF;

  SELECT count(*) INTO v_total
  FROM public.audit_logs a
  WHERE (NULLIF(trim(p_entity_type), '') IS NULL OR a.entity_type = trim(p_entity_type))
    AND (NULLIF(trim(p_action), '') IS NULL OR a.action = trim(p_action))
    AND (NULLIF(trim(p_severity), '') IS NULL OR a.severity = trim(p_severity))
    AND (NULLIF(trim(p_source), '') IS NULL OR a.source = trim(p_source))
    AND (NULLIF(trim(p_ip), '') IS NULL OR a.ip_address::text = trim(p_ip))
    AND (NULLIF(trim(p_query), '') IS NULL
      OR a.action ILIKE '%' || trim(p_query) || '%'
      OR a.entity_type ILIKE '%' || trim(p_query) || '%'
      OR a.entity_id::text ILIKE '%' || trim(p_query) || '%'
      OR a.user_agent ILIKE '%' || trim(p_query) || '%'
      OR a.metadata::text ILIKE '%' || trim(p_query) || '%');

  SELECT COALESCE(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.previous_value,
           a.new_value, a.created_at, a.ip_address, a.user_agent, a.session_id,
           a.metadata, a.severity, a.source,
           p.full_name AS user_name, p.role AS user_role
    FROM public.audit_logs a
    LEFT JOIN public.profiles p ON p.id = a.user_id
    WHERE (NULLIF(trim(p_entity_type), '') IS NULL OR a.entity_type = trim(p_entity_type))
      AND (NULLIF(trim(p_action), '') IS NULL OR a.action = trim(p_action))
      AND (NULLIF(trim(p_severity), '') IS NULL OR a.severity = trim(p_severity))
      AND (NULLIF(trim(p_source), '') IS NULL OR a.source = trim(p_source))
      AND (NULLIF(trim(p_ip), '') IS NULL OR a.ip_address::text = trim(p_ip))
      AND (NULLIF(trim(p_query), '') IS NULL
        OR a.action ILIKE '%' || trim(p_query) || '%'
        OR a.entity_type ILIKE '%' || trim(p_query) || '%'
        OR a.entity_id::text ILIKE '%' || trim(p_query) || '%'
        OR a.user_agent ILIKE '%' || trim(p_query) || '%'
        OR a.metadata::text ILIKE '%' || trim(p_query) || '%')
    ORDER BY a.created_at DESC
    OFFSET v_offset LIMIT v_size
  ) x;

  RETURN jsonb_build_object('rows', v_rows, 'page', v_page, 'page_size', v_size,
    'total', v_total, 'total_pages', GREATEST(1, CEIL(v_total::numeric / v_size)::integer));
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_audit_page(integer, integer, text, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_page(integer, integer, text, text, text, text, text, text) TO authenticated;

-- Backward-compatible wrapper used by existing admin activity screens.
CREATE OR REPLACE FUNCTION public.get_admin_audit_page(
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20,
  p_entity_type text DEFAULT NULL,
  p_action text DEFAULT NULL,
  p_query text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.get_admin_audit_page(p_page, p_page_size, p_entity_type, p_action, p_query, NULL, NULL, NULL);
$$;
REVOKE ALL ON FUNCTION public.get_admin_audit_page(integer, integer, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_audit_page(integer, integer, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
