-- Phase 51 repair — restore the server-only password preflight verifier.
-- Migration 0066 is already recorded as applied remotely, but the verifier
-- function is missing from the hosted database. Do not modify migration 0066.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.verify_login_password(
  p_email text,
  p_password text
)
RETURNS TABLE(
  user_id uuid,
  email text,
  password_valid boolean
)
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
  SELECT
    u.id,
    u.email,
    u.encrypted_password
  INTO
    v_user_id,
    v_email,
    v_hash
  FROM auth.users AS u
  WHERE lower(u.email) = lower(trim(p_email))
    AND u.deleted_at IS NULL
  LIMIT 1;

  IF v_user_id IS NULL OR v_hash IS NULL OR v_hash = '' THEN
    RETURN QUERY
    SELECT
      NULL::uuid,
      NULL::text,
      false;
    RETURN;
  END IF;

  BEGIN
    v_valid := extensions.crypt(p_password, v_hash) = v_hash;
  EXCEPTION
    WHEN others THEN
      v_valid := false;
  END;

  RETURN QUERY
  SELECT
    v_user_id,
    v_email,
    v_valid;
END;
$$;

REVOKE ALL
ON FUNCTION public.verify_login_password(text, text)
FROM PUBLIC, anon, authenticated;

GRANT EXECUTE
ON FUNCTION public.verify_login_password(text, text)
TO service_role;
