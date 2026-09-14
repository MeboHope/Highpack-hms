-- Phase 32: messaging RPC ambiguity repair.
-- This migration only repairs the existing customer messaging flow.
-- It does not change the messages table, RLS model, or conversation rules.

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

  SELECT pr.owner_id, pr.name
    INTO v_owner_id, v_property_name
  FROM public.properties AS pr
  WHERE pr.id = p_property_id
    AND pr.status = 'verified'
  LIMIT 1;

  IF v_owner_id IS NULL THEN RAISE EXCEPTION 'This property does not have a verified owner'; END IF;
  IF v_sender_id = v_owner_id THEN RAISE EXCEPTION 'You cannot send an enquiry to your own property'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS sender_profile
    WHERE sender_profile.id = v_sender_id
  ) THEN RAISE EXCEPTION 'Customer profile not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS owner_profile
    WHERE owner_profile.id = v_owner_id
      AND owner_profile.role IN ('owner','admin')
  ) THEN RAISE EXCEPTION 'Property owner account not found'; END IF;

  INSERT INTO public.messages AS msg (sender_id, receiver_id, property_id, body, read)
  VALUES (v_sender_id, v_owner_id, p_property_id, trim(p_body), false)
  RETURNING msg.id INTO v_message_id;

  -- Notification is best-effort; the message itself remains authoritative.
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, read)
    VALUES (
      v_owner_id,
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

REVOKE ALL ON FUNCTION public.send_property_enquiry(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_property_enquiry(uuid, text) TO authenticated;

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
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles AS sender_profile
    WHERE sender_profile.id = v_sender_id
  ) THEN RAISE EXCEPTION 'Customer profile not found'; END IF;
  IF p_receiver_id IS NULL OR p_receiver_id = v_sender_id THEN RAISE EXCEPTION 'Invalid reply recipient.'; END IF;
  IF NULLIF(trim(p_body), '') IS NULL THEN RAISE EXCEPTION 'Reply message cannot be empty.'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.messages AS existing_msg
    WHERE existing_msg.property_id IS NOT DISTINCT FROM p_property_id
      AND (
        (existing_msg.sender_id = v_sender_id AND existing_msg.receiver_id = p_receiver_id)
        OR
        (existing_msg.sender_id = p_receiver_id AND existing_msg.receiver_id = v_sender_id)
      )
  ) THEN
    RAISE EXCEPTION 'No existing enquiry conversation was found.';
  END IF;

  -- Deliberately capture the inserted message id into a uniquely named variable.
  -- The final SELECT is wrapped/aliased so the RETURNS TABLE output column `id`
  -- can never collide with a source-table `id` reference.
  INSERT INTO public.messages AS new_msg (sender_id, receiver_id, property_id, body, read)
  VALUES (v_sender_id, p_receiver_id, p_property_id, trim(p_body), false)
  RETURNING new_msg.id INTO v_message_id;

  RETURN QUERY
  SELECT result.message_id,
         result.message_sender_id,
         result.message_receiver_id,
         result.message_property_id,
         result.message_body,
         result.message_read,
         result.message_created_at,
         result.property_name,
         result.participant_name
  FROM (
    SELECT
      sent_msg.id AS message_id,
      sent_msg.sender_id AS message_sender_id,
      sent_msg.receiver_id AS message_receiver_id,
      sent_msg.property_id AS message_property_id,
      sent_msg.body AS message_body,
      sent_msg.read AS message_read,
      sent_msg.created_at AS message_created_at,
      property_row.name AS property_name,
      COALESCE(profile_row.full_name, 'Property owner / manager') AS participant_name
    FROM public.messages AS sent_msg
    LEFT JOIN public.properties AS property_row
      ON property_row.id = sent_msg.property_id
    LEFT JOIN public.profiles AS profile_row
      ON profile_row.id = sent_msg.receiver_id
    WHERE sent_msg.id = v_message_id
  ) AS result;
END;
$$;

REVOKE ALL ON FUNCTION public.send_customer_reply(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_customer_reply(uuid, uuid, text) TO authenticated;

-- Also harden the notification trigger's source references. This does not alter
-- its behavior; it only makes every id lookup explicitly table-qualified.
CREATE OR REPLACE FUNCTION public.notify_message_receiver()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sender_name text;
  property_name text;
BEGIN
  SELECT COALESCE(NULLIF(sender_profile.full_name, ''), 'A customer')
    INTO sender_name
  FROM public.profiles AS sender_profile
  WHERE sender_profile.id = NEW.sender_id;

  SELECT property_row.name
    INTO property_name
  FROM public.properties AS property_row
  WHERE property_row.id = NEW.property_id;

  INSERT INTO public.notifications (user_id, title, message, type, read)
  VALUES (
    NEW.receiver_id,
    CASE
      WHEN property_name IS NULL THEN 'New customer enquiry'
      ELSE 'New enquiry about ' || property_name
    END,
    COALESCE(sender_name, 'A customer') || ' sent you a new message' ||
      CASE
        WHEN property_name IS NULL THEN '.'
        ELSE ' about ' || property_name || '.'
      END,
    'message',
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_message_receiver ON public.messages;
CREATE TRIGGER trg_notify_message_receiver
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_message_receiver();
