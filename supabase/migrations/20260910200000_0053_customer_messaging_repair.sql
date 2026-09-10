-- Phase 25 messaging repair: make customer enquiries independent of stale
-- client-side owner data and expose the same conversation to the customer.

CREATE OR REPLACE FUNCTION public.send_property_enquiry(
  p_property_id uuid,
  p_body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_owner_id uuid;
  v_property_name text;
  v_message_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_property_id IS NULL THEN RAISE EXCEPTION 'Property is required'; END IF;
  IF NULLIF(trim(p_body), '') IS NULL THEN RAISE EXCEPTION 'Message cannot be empty'; END IF;

  SELECT p.owner_id, p.name INTO v_owner_id, v_property_name
  FROM public.properties p
  WHERE p.id = p_property_id AND p.status = 'verified'
  LIMIT 1;

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'This property does not have a verified owner'; END IF;
  IF v_sender_id = v_owner_id THEN RAISE EXCEPTION 'You cannot send an enquiry to your own property'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_sender_id) THEN RAISE EXCEPTION 'Customer profile not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_owner_id AND role IN ('owner','admin')) THEN RAISE EXCEPTION 'Property owner account not found'; END IF;

  INSERT INTO public.messages(sender_id, receiver_id, property_id, body, read)
  VALUES(v_sender_id, v_owner_id, p_property_id, trim(p_body), false)
  RETURNING id INTO v_message_id;

  BEGIN
    INSERT INTO public.notifications(user_id, title, message, type, read)
    VALUES(v_owner_id, 'New property enquiry', 'A customer has sent you an enquiry about ' || COALESCE(v_property_name, 'your property') || '.', 'message', false);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_property_enquiry(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_property_enquiry(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_messages()
RETURNS TABLE(
  id uuid, sender_id uuid, receiver_id uuid, property_id uuid,
  body text, read boolean, created_at timestamptz,
  property_name text, participant_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_id, m.receiver_id, m.property_id, m.body, m.read, m.created_at,
         p.name AS property_name,
         COALESCE(other.full_name, 'Property owner / manager') AS participant_name
  FROM public.messages m
  LEFT JOIN public.properties p ON p.id = m.property_id
  LEFT JOIN public.profiles other
    ON other.id = CASE WHEN m.sender_id = auth.uid() THEN m.receiver_id ELSE m.sender_id END
  WHERE auth.uid() IS NOT NULL
    AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  ORDER BY m.created_at ASC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.get_my_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_messages() TO authenticated;

CREATE OR REPLACE FUNCTION public.send_customer_reply(
  p_receiver_id uuid,
  p_property_id uuid,
  p_body text
)
RETURNS TABLE(
  id uuid, sender_id uuid, receiver_id uuid, property_id uuid,
  body text, read boolean, created_at timestamptz,
  property_name text, participant_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_message_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'Authentication is required.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_sender_id) THEN RAISE EXCEPTION 'Customer profile not found'; END IF;
  IF p_receiver_id IS NULL OR p_receiver_id = v_sender_id THEN RAISE EXCEPTION 'Invalid reply recipient.'; END IF;
  IF NULLIF(trim(p_body), '') IS NULL THEN RAISE EXCEPTION 'Reply message cannot be empty.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.property_id IS NOT DISTINCT FROM p_property_id
      AND ((m.sender_id=v_sender_id AND m.receiver_id=p_receiver_id)
        OR (m.sender_id=p_receiver_id AND m.receiver_id=v_sender_id))
  ) THEN RAISE EXCEPTION 'No existing enquiry conversation was found.'; END IF;

  INSERT INTO public.messages(sender_id, receiver_id, property_id, body, read)
  VALUES(v_sender_id, p_receiver_id, p_property_id, trim(p_body), false)
  RETURNING messages.id INTO v_message_id;

  RETURN QUERY
  SELECT m.id, m.sender_id, m.receiver_id, m.property_id, m.body, m.read, m.created_at,
         p.name, COALESCE(other.full_name, 'Property owner / manager')
  FROM public.messages m
  LEFT JOIN public.properties p ON p.id = m.property_id
  LEFT JOIN public.profiles other ON other.id = m.receiver_id
  WHERE m.id = v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_customer_reply(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_customer_reply(uuid, uuid, text) TO authenticated;
