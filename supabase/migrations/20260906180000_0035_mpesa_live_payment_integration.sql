/* HighPark Consult — Phase 10: live M-Pesa payment integration
   Adds provider tracking and a secure server-side callback workflow.
   Daraja secrets stay in Supabase Edge Function secrets.
*/

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.rent_invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payer_phone text,
  ADD COLUMN IF NOT EXISTS merchant_request_id text,
  ADD COLUMN IF NOT EXISTS checkout_request_id text,
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number text,
  ADD COLUMN IF NOT EXISTS provider_result_code integer,
  ADD COLUMN IF NOT EXISTS provider_result_description text,
  ADD COLUMN IF NOT EXISTS provider_response jsonb,
  ADD COLUMN IF NOT EXISTS initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_checkout_request_id
  ON public.payments(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_mpesa_receipt_number
  ON public.payments(mpesa_receipt_number)
  WHERE mpesa_receipt_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON public.payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_payer_phone ON public.payments(payer_phone);
CREATE INDEX IF NOT EXISTS idx_payments_provider_status ON public.payments(payment_method, status, verified, created_at DESC);

-- Backfill the direct relationship for existing rent payments where it can be
-- established unambiguously. This does not change payment amounts/statuses.
UPDATE public.payments p
SET invoice_id = x.invoice_id
FROM (
  SELECT p2.id AS payment_id,
         (SELECT ri.id
            FROM public.rent_invoices ri
           WHERE ri.lease_id = p2.lease_id
             AND ri.tenant_id = p2.user_id
             AND ri.property_id = p2.property_id
           ORDER BY CASE WHEN ri.balance >= p2.amount THEN 0 ELSE 1 END,
                    ri.due_date DESC, ri.created_at DESC
           LIMIT 1) AS invoice_id
    FROM public.payments p2
   WHERE p2.payment_type = 'rent'
     AND p2.invoice_id IS NULL
) x
WHERE p.id = x.payment_id
  AND x.invoice_id IS NOT NULL;

-- Update the controlled rent-payment RPC so a payment points to the exact
-- invoice being paid. This prevents callbacks from guessing which invoice to settle.
CREATE OR REPLACE FUNCTION public.create_rent_payment(
  p_invoice_id uuid,
  p_payment_method text DEFAULT 'mpesa'
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice public.rent_invoices%ROWTYPE;
  v_existing public.payments%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_user uuid := auth.uid();
  v_method text := lower(coalesce(p_payment_method, 'mpesa'));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in to make a payment'; END IF;
  IF v_method NOT IN ('mpesa','card','bank_transfer') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;

  SELECT * INTO v_invoice
  FROM public.rent_invoices
  WHERE id = p_invoice_id AND tenant_id = v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found or not accessible'; END IF;
  IF v_invoice.balance <= 0 THEN RAISE EXCEPTION 'This invoice has no outstanding balance'; END IF;

  SELECT * INTO v_existing
  FROM public.payments
  WHERE user_id = v_user
    AND invoice_id = p_invoice_id
    AND status = 'pending'
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_existing; END IF;

  INSERT INTO public.payments (
    user_id, invoice_id, lease_id, property_id, unit_id, amount,
    payment_type, payment_method, status, verified
  ) VALUES (
    v_user, p_invoice_id, v_invoice.lease_id, v_invoice.property_id, v_invoice.unit_id,
    v_invoice.balance, 'rent', v_method, 'pending', false
  ) RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;
REVOKE ALL ON FUNCTION public.create_rent_payment(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_rent_payment(uuid,text) TO authenticated;

-- Controlled server-side finalization. Only service_role should call this.
CREATE OR REPLACE FUNCTION public.finalize_mpesa_payment(
  p_payment_id uuid,
  p_result_code integer,
  p_result_description text,
  p_checkout_request_id text DEFAULT NULL,
  p_merchant_request_id text DEFAULT NULL,
  p_mpesa_receipt_number text DEFAULT NULL,
  p_transaction_phone text DEFAULT NULL,
  p_result_amount numeric DEFAULT NULL,
  p_provider_response jsonb DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.payments%ROWTYPE;
  v_invoice public.rent_invoices%ROWTYPE;
  v_amount numeric;
BEGIN
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;

  IF v_payment.payment_method <> 'mpesa' THEN RAISE EXCEPTION 'Payment is not an M-Pesa transaction'; END IF;
  IF v_payment.status IN ('successful','refunded','partially_refunded') AND v_payment.verified THEN
    RETURN v_payment;
  END IF;

  IF p_result_code = 0 THEN
    v_amount := COALESCE(p_result_amount, v_payment.amount);
    IF abs(v_amount - v_payment.amount) > 0.01 THEN
      UPDATE public.payments SET
        status = 'failed', verified = false,
        provider_result_code = p_result_code,
        provider_result_description = 'Amount mismatch: provider returned ' || v_amount || ', expected ' || v_payment.amount,
        provider_response = p_provider_response,
        checkout_request_id = COALESCE(p_checkout_request_id, checkout_request_id),
        merchant_request_id = COALESCE(p_merchant_request_id, merchant_request_id),
        updated_at = now()
      WHERE id = v_payment.id
      RETURNING * INTO v_payment;
      RETURN v_payment;
    END IF;

    UPDATE public.payments SET
      status = 'successful', verified = true,
      verified_at = COALESCE(verified_at, now()),
      completed_at = COALESCE(completed_at, now()),
      initiated_at = COALESCE(initiated_at, now()),
      provider_result_code = p_result_code,
      provider_result_description = p_result_description,
      provider_response = p_provider_response,
      checkout_request_id = COALESCE(p_checkout_request_id, checkout_request_id),
      merchant_request_id = COALESCE(p_merchant_request_id, merchant_request_id),
      mpesa_receipt_number = COALESCE(p_mpesa_receipt_number, mpesa_receipt_number),
      payer_phone = COALESCE(p_transaction_phone, payer_phone),
      transaction_ref = COALESCE(p_mpesa_receipt_number, transaction_ref),
      updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    IF v_payment.invoice_id IS NOT NULL THEN
      SELECT * INTO v_invoice FROM public.rent_invoices WHERE id = v_payment.invoice_id FOR UPDATE;
      IF FOUND THEN
        UPDATE public.rent_invoices
        SET balance = GREATEST(0, balance - v_payment.amount),
            status = CASE WHEN GREATEST(0, balance - v_payment.amount) <= 0 THEN 'paid' ELSE 'partially_paid' END
        WHERE id = v_invoice.id;
      END IF;
    END IF;

    INSERT INTO public.notifications(user_id,title,message,type)
    VALUES (
      v_payment.user_id,
      'M-Pesa payment received',
      'Payment of KES ' || to_char(v_payment.amount, 'FM999,999,999,990.00') || ' was confirmed. Receipt ' || COALESCE(v_payment.receipt_number, v_payment.mpesa_receipt_number, v_payment.transaction_ref, 'pending') || '.',
      'payment'
    );
  ELSE
    UPDATE public.payments SET
      status = CASE WHEN p_result_code = 1032 THEN 'cancelled' ELSE 'failed' END,
      verified = false,
      provider_result_code = p_result_code,
      provider_result_description = p_result_description,
      provider_response = p_provider_response,
      checkout_request_id = COALESCE(p_checkout_request_id, checkout_request_id),
      merchant_request_id = COALESCE(p_merchant_request_id, merchant_request_id),
      payer_phone = COALESCE(p_transaction_phone, payer_phone),
      updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;
  END IF;

  RETURN v_payment;
END;
$$;
REVOKE ALL ON FUNCTION public.finalize_mpesa_payment(uuid,integer,text,text,text,text,text,numeric,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_mpesa_payment(uuid,integer,text,text,text,text,text,numeric,jsonb) TO service_role;

NOTIFY pgrst, 'reload schema';
