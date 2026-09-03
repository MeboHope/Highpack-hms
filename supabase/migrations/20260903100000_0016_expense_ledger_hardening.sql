/* HighPark Consult — expense ledger hardening.
   Ensures owner expense writes are attached to the property's real owner and
   owner expense reads are scoped by property ownership. This is intentionally
   idempotent so it can safely repair an already-migrated database. */

CREATE OR REPLACE FUNCTION public.create_owner_expense(
  p_property_id uuid,
  p_category text,
  p_amount numeric,
  p_expense_date date,
  p_vendor text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash'
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_property public.properties%ROWTYPE;
  v_exp public.expenses%ROWTYPE;
  v_is_admin boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  SELECT * INTO v_property
  FROM public.properties
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user AND role = 'admin'
  ) INTO v_is_admin;

  IF v_property.owner_id IS DISTINCT FROM v_user AND NOT v_is_admin THEN
    RAISE EXCEPTION 'You are not allowed to record an expense for this property';
  END IF;

  INSERT INTO public.expenses (
    property_id, owner_id, category, amount, expense_date,
    vendor, description, payment_method
  )
  VALUES (
    p_property_id,
    COALESCE(v_property.owner_id, v_user),
    NULLIF(trim(COALESCE(p_category, '')), ''),
    p_amount,
    COALESCE(p_expense_date, CURRENT_DATE),
    NULLIF(trim(COALESCE(p_vendor, '')), ''),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    lower(COALESCE(NULLIF(trim(p_payment_method), ''), 'cash'))
  )
  RETURNING * INTO v_exp;

  RETURN v_exp;
END;
$$;

REVOKE ALL ON FUNCTION public.create_owner_expense(uuid,text,numeric,date,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_owner_expense(uuid,text,numeric,date,text,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_managed_expenses()
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
  property_name text
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

  IF v_role NOT IN ('owner', 'agent', 'admin') THEN
    RAISE EXCEPTION 'You are not allowed to view expenses';
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
    p.name
  FROM public.expenses e
  INNER JOIN public.properties p ON p.id = e.property_id
  WHERE v_role = 'admin'
     OR p.owner_id = v_user
  ORDER BY e.expense_date DESC, e.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_managed_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_expenses() TO authenticated;

NOTIFY pgrst, 'reload schema';
