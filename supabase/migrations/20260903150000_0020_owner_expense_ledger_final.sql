/*
  HighPark Consult — final owner expense ledger repair.

  The owner Expenses screen previously called get_managed_expenses(), then
  fell back to a direct /rest/v1/expenses query. In the affected database the
  RPC returned HTTP 400 and the direct query returned HTTP 403, so a newly
  recorded expense appeared temporarily in local React state but disappeared
  on reload.

  This migration creates a dedicated SECURITY DEFINER owner ledger and also
  repairs the direct SELECT policy for legitimate property owners.
*/

/* Keep this migration self-contained: the owner SELECT policy below uses the
   helper to avoid querying profiles recursively from an RLS policy. */
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin_user() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_owner_expense_ledger()
RETURNS jsonb
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

  RETURN COALESCE(
    (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', e.id,
          'property_id', e.property_id,
          'owner_id', e.owner_id,
          'category', e.category,
          'amount', e.amount,
          'expense_date', e.expense_date,
          'vendor', e.vendor,
          'description', e.description,
          'receipt_url', e.receipt_url,
          'payment_method', e.payment_method,
          'created_at', e.created_at,
          'property_name', COALESCE(pr.name, 'Property')
        )
        ORDER BY e.expense_date DESC, e.created_at DESC
      )
      FROM public.expenses e
      INNER JOIN public.properties pr ON pr.id = e.property_id
      WHERE v_role = 'admin'
         OR pr.owner_id = v_user
         OR e.owner_id = v_user
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_expense_ledger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_expense_ledger() TO authenticated;

/*
  Repair direct owner SELECTs too. The important addition is property
  ownership, not only expense.owner_id. That makes the policy resilient to
  legacy rows created before the owner-id write was hardened.
*/
DROP POLICY IF EXISTS "expenses_read" ON public.expenses;
CREATE POLICY "expenses_read" ON public.expenses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1
      FROM public.properties pr
      WHERE pr.id = expenses.property_id
        AND pr.owner_id = auth.uid()
    )
    OR public.is_admin_user()
  );

NOTIFY pgrst, 'reload schema';
