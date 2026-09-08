/* Runtime repair: KRA table privileges, deposit policy column, and Equity service-role reconciliation. */

-- KRA settings/log tables are protected by RLS; grant table privileges to the
-- authenticated role so the admin-only RLS policies can actually evaluate.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.kra_etims_settings TO authenticated;
GRANT SELECT ON TABLE public.kra_etims_submission_log TO authenticated;

-- The original system_settings schema stores reservation_fee_policy, not value.
-- Recreate the deposit-payment RPC without referencing the nonexistent column.
CREATE OR REPLACE FUNCTION public.create_deposit_payment(
  p_lease_id uuid,
  p_payment_method text DEFAULT 'mpesa'
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lease public.leases%ROWTYPE;
  v_existing public.payments%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_user uuid := auth.uid();
  v_method text := lower(coalesce(p_payment_method, 'mpesa'));
  v_due numeric;
  v_paid numeric;
  v_reservation_deduction numeric := 0;
  v_policy text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in to make a payment'; END IF;
  IF v_method NOT IN ('mpesa','card','bank_transfer','equity') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT * INTO v_lease
  FROM public.leases
  WHERE id = p_lease_id AND tenant_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Lease not found or not accessible'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_paid
  FROM public.payments
  WHERE lease_id = p_lease_id
    AND user_id = v_user
    AND payment_type = 'deposit'
    AND verified = true
    AND status = 'successful';

  SELECT reservation_fee_policy INTO v_policy
  FROM public.system_settings
  WHERE id = 1;

  IF v_policy = 'deductible_deposit' AND v_lease.reservation_id IS NOT NULL THEN
    SELECT COALESCE(SUM(reservation_fee), 0) INTO v_reservation_deduction
    FROM public.reservations
    WHERE id = v_lease.reservation_id AND status = 'confirmed';
  END IF;

  v_due := GREATEST(0, COALESCE(v_lease.deposit, 0) - v_paid - v_reservation_deduction);

  IF v_due <= 0 THEN RAISE EXCEPTION 'This security deposit has no outstanding balance'; END IF;

  SELECT * INTO v_existing
  FROM public.payments
  WHERE user_id = v_user
    AND lease_id = p_lease_id
    AND payment_type = 'deposit'
    AND payment_method = v_method
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN RETURN v_existing; END IF;

  INSERT INTO public.payments(
    user_id, lease_id, property_id, unit_id, amount, payment_type,
    payment_method, status, verified
  )
  VALUES (
    v_user, p_lease_id, v_lease.property_id, v_lease.unit_id, v_due,
    'deposit', v_method, 'pending', false
  )
  RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_deposit_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_deposit_payment(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
