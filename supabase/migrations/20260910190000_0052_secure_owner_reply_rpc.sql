-- Secure owner/admin replies without relying on browser-side INSERT RLS.
-- The RPC only permits an authenticated owner/admin to reply to an existing
-- conversation, and requires the receiver/property pair to already exist.

CREATE OR REPLACE FUNCTION public.send_owner_reply(
  p_receiver_id uuid,
  p_property_id uuid,
  p_body text
)
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  property_id uuid,
  body text,
  read boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_message_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = v_sender_id
      AND p.role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Only owners and administrators can send owner replies.';
  END IF;

  IF p_receiver_id IS NULL OR p_receiver_id = v_sender_id THEN
    RAISE EXCEPTION 'Invalid reply recipient.';
  END IF;

  IF NULLIF(trim(p_body), '') IS NULL THEN
    RAISE EXCEPTION 'Reply message cannot be empty.';
  END IF;

  -- A reply must belong to a conversation that already exists between these
  -- two participants for the same property. This prevents arbitrary messaging.
  IF NOT EXISTS (
    SELECT 1
    FROM public.messages m
    WHERE m.property_id IS NOT DISTINCT FROM p_property_id
      AND (
        (m.sender_id = v_sender_id AND m.receiver_id = p_receiver_id)
        OR (m.sender_id = p_receiver_id AND m.receiver_id = v_sender_id)
      )
  ) THEN
    RAISE EXCEPTION 'No existing enquiry conversation was found.';
  END IF;

  INSERT INTO public.messages (sender_id, receiver_id, property_id, body, read)
  VALUES (v_sender_id, p_receiver_id, p_property_id, trim(p_body), false)
  RETURNING messages.id INTO v_message_id;

  RETURN QUERY
  SELECT m.id, m.sender_id, m.receiver_id, m.property_id, m.body, m.read, m.created_at
  FROM public.messages m
  WHERE m.id = v_message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.send_owner_reply(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_owner_reply(uuid, uuid, text) TO authenticated;
