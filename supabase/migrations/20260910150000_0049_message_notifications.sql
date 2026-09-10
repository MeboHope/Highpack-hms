-- Customer/owner messaging notifications. The existing messages table is retained.
-- This trigger creates an in-app notification for the receiver without allowing
-- clients to forge notifications for arbitrary users.

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
  SELECT COALESCE(NULLIF(full_name, ''), 'A customer') INTO sender_name
  FROM public.profiles WHERE id = NEW.sender_id;

  SELECT name INTO property_name
  FROM public.properties WHERE id = NEW.property_id;

  INSERT INTO public.notifications (user_id, title, message, type, read)
  VALUES (
    NEW.receiver_id,
    CASE WHEN property_name IS NULL THEN 'New customer enquiry' ELSE 'New enquiry about ' || property_name END,
    COALESCE(sender_name, 'A customer') || ' sent you a new message' || CASE WHEN property_name IS NULL THEN '.' ELSE ' about ' || property_name || '.' END,
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
