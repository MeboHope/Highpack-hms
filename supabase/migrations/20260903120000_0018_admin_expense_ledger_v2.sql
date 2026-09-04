/*
  HighPark Consult — authoritative expense ledger v2.

  This function is intentionally independent of the browser-side RLS SELECT
  policy on public.expenses. It reads persisted expenses in a SECURITY DEFINER
  context and verifies the caller's admin role from profiles.

  Apply this migration in Supabase SQL Editor if your project was upgraded
  manually and the previous admin-expense RPC was not created.
*/

CREATE OR REPLACE FUNCTION public.get_admin_expense_ledger_v2()
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

  SELECT role INTO v_role
  FROM public.profiles
  WHERE id = v_user;

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
    COALESCE(pr.name, 'Property') AS property_name,
    COALESCE(op.full_name, 'Owner') AS owner_name
  FROM public.expenses e
  LEFT JOIN public.properties pr ON pr.id = e.property_id
  LEFT JOIN public.profiles op ON op.id = e.owner_id
  ORDER BY e.expense_date DESC, e.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_expense_ledger_v2() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_expense_ledger_v2() TO authenticated;

NOTIFY pgrst, 'reload schema';
