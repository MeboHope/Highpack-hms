-- Phase 25: secure property enquiry submission
-- Moves customer -> owner enquiry creation into a SECURITY DEFINER RPC so
-- client-side RLS/notification-trigger interactions cannot block valid enquiries.

CREATE OR REPLACE FUNCTION public.send_property_enquiry(
  p_property_id uuid,
  p_owner_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_message_id uuid;
  v_property_name text;
  v_actual_owner_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_property_id IS NULL OR p_owner_id IS NULL THEN
    RAISE EXCEPTION 'Property owner information is required';
  END IF;

  IF NULLIF(trim(p_body), '') IS NULL THEN
    RAISE EXCEPTION 'Message cannot be empty';
  END IF;

  IF v_sender_id = p_owner_id THEN
    RAISE EXCEPTION 'You cannot send an enquiry to your own property';
  END IF;

  -- Only allow enquiries for currently verified properties whose owner still
  -- matches the owner displayed to the customer.
  SELECT p.owner_id, p.name
    INTO v_actual_owner_id, v_property_name
  FROM public.properties p
  WHERE p.id = p_property_id
    AND p.status = 'verified'
  LIMIT 1;

  IF v_actual_owner_id IS NULL THEN
    RAISE EXCEPTION 'This property does not have a verified owner';
  END IF;

  IF v_actual_owner_id <> p_owner_id THEN
    RAISE EXCEPTION 'Property owner information has changed. Please refresh and try again.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_sender_id) THEN
    RAISE EXCEPTION 'Customer profile not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_owner_id AND role IN ('owner','admin')) THEN
    RAISE EXCEPTION 'Property owner account not found';
  END IF;

  INSERT INTO public.messages (
    sender_id,
    receiver_id,
    property_id,
    body,
    read
  ) VALUES (
    v_sender_id,
    p_owner_id,
    p_property_id,
    trim(p_body),
    false
  )
  RETURNING id INTO v_message_id;

  -- Notification is best-effort. The enquiry itself must not be rolled back
  -- merely because an existing notification configuration is incomplete.
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (
      p_owner_id,
      'New property enquiry',
      'A customer has sent you an enquiry about ' || COALESCE(v_property_name, 'your property') || '.',
      'message',
      false
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_property_enquiry(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_property_enquiry(uuid, uuid, text) TO authenticated;
