/* HighPark Consult — definitive owner expense ledger repair.
   Replaces the legacy composite-return get_managed_expenses() RPC that is
   currently producing HTTP 400 on the Owner Expenses screen.
   Also repairs direct owner SELECT policy used by older client builds. */

DROP FUNCTION IF EXISTS public.get_managed_expenses();

CREATE OR REPLACE FUNCTION public.get_managed_expenses()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_is_admin boolean := false;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user
      AND role = 'admin'
  ) INTO v_is_admin;

  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = v_user
      AND role IN ('owner', 'agent')
  ) THEN
    RAISE EXCEPTION 'You are not allowed to view expenses';
  END IF;

  RETURN COALESCE((
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
    JOIN public.properties pr ON pr.id = e.property_id
    WHERE v_is_admin
       OR pr.owner_id = v_user
       OR e.owner_id = v_user
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.get_managed_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_expenses() TO authenticated;

/* Make the older direct REST fallback correct as well. Avoid querying
   profiles/properties through their own RLS policies from this policy. */
CREATE OR REPLACE FUNCTION public.is_expense_property_owner(p_property_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.properties pr
    WHERE pr.id = p_property_id
      AND pr.owner_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.is_expense_property_owner(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_expense_property_owner(uuid) TO authenticated;

DROP POLICY IF EXISTS "expenses_read" ON public.expenses;
CREATE POLICY "expenses_read" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    auth.uid() = owner_id
    OR public.is_expense_property_owner(property_id)
    OR public.is_admin_user()
  );

NOTIFY pgrst, 'reload schema';
