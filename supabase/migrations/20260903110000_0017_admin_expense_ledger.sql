/* HighPark Consult — authoritative admin expense ledger.
   The admin application must be able to see every persisted expense regardless
   of the owner attached to the row. A dedicated SECURITY DEFINER function
   keeps this read independent of browser RLS/schema-cache behaviour while
   still requiring the signed-in account to be an actual admin. */

CREATE OR REPLACE FUNCTION public.get_admin_expense_ledger()
RETURNS TABLE (
  id uuid,
  property_id uuid,
  owner_id uuid,
  category text,
  amount numeric,
  expense_date date,
  vendor text,
  description text,
  payment_method text,
  created_at timestamptz,
  property_name text,
  owner_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT p.role INTO v_role
  FROM public.profiles p
  WHERE p.id = v_user;

  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Administrator access is required';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.property_id,
    e.owner_id,
    e.category,
    e.amount,
    e.expense_date,
    e.vendor,
    e.description,
    e.payment_method,
    e.created_at,
    p.name,
    op.full_name
  FROM public.expenses e
  LEFT JOIN public.properties p ON p.id = e.property_id
  LEFT JOIN public.profiles op ON op.id = e.owner_id
  ORDER BY e.expense_date DESC, e.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_expense_ledger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_expense_ledger() TO authenticated;

NOTIFY pgrst, 'reload schema';
