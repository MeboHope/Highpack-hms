/* Phase 25 runtime repair: owner inbox + public property-owner lookup. */

CREATE OR REPLACE FUNCTION public.get_owner_messages()
RETURNS TABLE (
  id uuid,
  sender_id uuid,
  receiver_id uuid,
  property_id uuid,
  body text,
  read boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.sender_id, m.receiver_id, m.property_id, m.body, m.read, m.created_at
  FROM public.messages m
  WHERE auth.uid() IS NOT NULL
    AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('owner', 'admin')
    )
  ORDER BY m.created_at ASC
  LIMIT 500;
$$;

REVOKE ALL ON FUNCTION public.get_owner_messages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_messages() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_public_property_owner(p_property_id uuid)
RETURNS TABLE (
  owner_id uuid,
  full_name text,
  phone text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.owner_id, pr.full_name, pr.phone
  FROM public.properties p
  LEFT JOIN public.profiles pr ON pr.id = p.owner_id
  WHERE p.id = p_property_id
    AND p.status = 'verified'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_property_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_property_owner(uuid) TO anon, authenticated;
