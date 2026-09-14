-- Phase 35: Admin property verification hardening.
-- Keeps the existing property lifecycle but makes verification decisions explicit,
-- admin-only, auditable and reviewable without touching customer/owner messaging.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS verification_notes text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS verified_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_verification_status_created
  ON public.properties(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_properties_verified_by
  ON public.properties(verified_by);

CREATE OR REPLACE FUNCTION public.admin_review_property(
  p_property_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS public.properties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property public.properties;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles pr WHERE pr.id = v_actor AND pr.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only an administrator can review properties';
  END IF;

  IF p_decision NOT IN ('verified', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid property review decision';
  END IF;

  SELECT * INTO v_property
  FROM public.properties
  WHERE id = p_property_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  UPDATE public.properties
  SET
    status = p_decision,
    verification_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
    verified_at = CASE WHEN p_decision = 'verified' THEN now() ELSE verified_at END,
    verified_by = CASE WHEN p_decision = 'verified' THEN v_actor ELSE verified_by END,
    rejected_at = CASE WHEN p_decision = 'rejected' THEN now() ELSE rejected_at END,
    rejected_by = CASE WHEN p_decision = 'rejected' THEN v_actor ELSE rejected_by END,
    updated_at = now()
  WHERE id = p_property_id
  RETURNING * INTO v_property;

  RETURN v_property;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_review_property(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_property(uuid, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
