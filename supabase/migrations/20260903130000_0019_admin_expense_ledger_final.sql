/*
  HighPark Consult — final admin expense ledger repair.

  Root cause addressed here:
  - browser SELECTs on expenses depended on an RLS policy that queried the
    profiles table from inside the profiles RLS policy family;
  - the previous admin RPCs returned composite TABLE results, which made the
    client dependent on an already-correct PostgREST function/schema cache;
  - the UI therefore could receive 400/403 responses even though expenses
    were already persisted in public.expenses.

  This migration provides:
  1. A small SECURITY DEFINER admin-role helper that is safe to call from RLS.
  2. A repaired expenses SELECT policy that uses that helper.
  3. A final, intentionally simple SECURITY DEFINER JSON ledger RPC. The RPC
     reads the authoritative expenses table and returns one JSON array, which
     avoids PostgREST return-table signature/cache ambiguity.
*/

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

/* Repair the browser-side expense policy as well. The dedicated RPC remains
   the primary admin read path, but this makes direct reads safe too. */
DROP POLICY IF EXISTS "expenses_read" ON public.expenses;
CREATE POLICY "expenses_read" ON public.expenses
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_admin_user()
  );

CREATE OR REPLACE FUNCTION public.get_admin_expense_ledger_final()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  IF NOT public.is_admin_user() THEN
    RAISE EXCEPTION 'Administrator access is required';
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
          'payment_method', e.payment_method,
          'receipt_url', e.receipt_url,
          'created_at', e.created_at,
          'property_name', COALESCE(pr.name, 'Property'),
          'owner_name', COALESCE(op.full_name, 'Owner')
        )
        ORDER BY e.expense_date DESC, e.created_at DESC
      )
      FROM public.expenses e
      LEFT JOIN public.properties pr ON pr.id = e.property_id
      LEFT JOIN public.profiles op ON op.id = e.owner_id
    ),
    '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_expense_ledger_final() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_expense_ledger_final() TO authenticated;

NOTIFY pgrst, 'reload schema';
