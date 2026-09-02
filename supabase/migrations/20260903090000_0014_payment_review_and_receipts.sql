/* HighPark Consult — admin payment review + tenant receipt workflow.
   A payment can only become successful/verified through this server-side admin RPC.
   Verification also settles the related rent invoice and notifies the tenant.
*/

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS receipt_number text,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;

ALTER TABLE public.rent_invoices
  ADD COLUMN IF NOT EXISTS invoice_number text;

UPDATE public.rent_invoices
SET invoice_number = 'INV-' || regexp_replace(period, '[^0-9]', '', 'g') || '-' || upper(left(replace(id::text, '-', ''), 8))
WHERE invoice_number IS NULL;

UPDATE public.payments
SET receipt_number = 'RCP-' || to_char(created_at, 'YYYYMMDD') || '-' || upper(left(replace(id::text, '-', ''), 8))
WHERE verified = true AND receipt_number IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_invoices_invoice_number
  ON public.rent_invoices(invoice_number)
  WHERE invoice_number IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_receipt_number
  ON public.payments(receipt_number)
  WHERE receipt_number IS NOT NULL;

CREATE OR REPLACE FUNCTION public.review_payment_by_admin(
  p_payment_id uuid,
  p_action text
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_payment public.payments%ROWTYPE;
  v_invoice public.rent_invoices%ROWTYPE;
  v_receipt text;
  v_new_balance numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user;
  IF v_role <> 'admin' THEN RAISE EXCEPTION 'Only an administrator can review payments'; END IF;

  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  IF p_action = 'verify' THEN
    IF v_payment.status NOT IN ('pending','successful') THEN
      RAISE EXCEPTION 'Only pending or successful payments can be verified';
    END IF;

    v_receipt := COALESCE(v_payment.receipt_number,
      'RCP-' || to_char(COALESCE(v_payment.created_at, now()), 'YYYYMMDD') || '-' || upper(left(replace(v_payment.id::text, '-', ''), 8)));

    UPDATE public.payments
    SET status = 'successful', verified = true, receipt_number = v_receipt, verified_at = COALESCE(verified_at, now()), updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    IF v_payment.payment_type = 'rent' AND v_payment.lease_id IS NOT NULL THEN
      SELECT * INTO v_invoice
      FROM public.rent_invoices
      WHERE lease_id = v_payment.lease_id
        AND tenant_id = v_payment.user_id
        AND balance > 0
      ORDER BY due_date ASC, created_at ASC
      LIMIT 1
      FOR UPDATE;

      IF FOUND THEN
        v_new_balance := GREATEST(0, COALESCE(v_invoice.balance, 0) - COALESCE(v_payment.amount, 0));
        UPDATE public.rent_invoices
        SET balance = v_new_balance,
            status = CASE
              WHEN v_new_balance <= 0 THEN 'paid'
              WHEN v_new_balance < amount THEN 'partially_paid'
              WHEN due_date < current_date THEN 'overdue'
              ELSE 'unpaid'
            END
        WHERE id = v_invoice.id;
      END IF;
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_payment.user_id,
      'Payment verified — receipt available',
      'Your ' || replace(v_payment.payment_type, '_', ' ') || ' payment of KSh ' || to_char(v_payment.amount, 'FM999,999,990.00') || ' has been verified. Receipt ' || v_receipt || ' is now available in Rent & Payments.',
      'payment'
    );

    RETURN v_payment;
  ELSIF p_action = 'reject' THEN
    IF v_payment.status <> 'pending' OR v_payment.verified THEN
      RAISE EXCEPTION 'Only an unverified pending payment can be rejected';
    END IF;

    UPDATE public.payments
    SET status = 'failed', verified = false, updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_payment.user_id,
      'Payment requires attention',
      'Your submitted ' || replace(v_payment.payment_type, '_', ' ') || ' payment of KSh ' || to_char(v_payment.amount, 'FM999,999,990.00') || ' could not be verified. Please contact HighPark Consult if you believe this is an error.',
      'payment'
    );

    RETURN v_payment;
  END IF;

  RAISE EXCEPTION 'Unsupported payment review action';
END;
$$;

REVOKE ALL ON FUNCTION public.review_payment_by_admin(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_payment_by_admin(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
