/* HighPark Consult — Phase 11: bank-transfer payment workflow
   Tenant-submitted bank transfers remain pending until an administrator verifies them.
   Payment proof is stored in the existing private pms-documents bucket.
*/

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS bank_transfer_date date,
  ADD COLUMN IF NOT EXISTS bank_transfer_channel text,
  ADD COLUMN IF NOT EXISTS proof_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS review_notes text;

CREATE INDEX IF NOT EXISTS idx_payments_bank_transfer_review
  ON public.payments(payment_method, status, verified, created_at DESC)
  WHERE payment_method = 'bank_transfer';

-- The live M-Pesa function uses service_role for payment lookup/update.
-- Keep these privileges in migrations so a fresh environment has the same behaviour.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.payments TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.rent_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.documents TO service_role;

-- Correct payment-intent reuse: changing from M-Pesa to bank transfer must not
-- accidentally reuse an unrelated pending payment created for another method.
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
    AND payment_method = v_method
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

-- Deposit intents get the same method-aware reuse behaviour.
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
  v_user uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_payment public.payments%ROWTYPE;
  v_method text := lower(coalesce(p_payment_method, 'mpesa'));
  v_paid numeric := 0;
  v_reservation_deduction numeric := 0;
  v_due numeric := 0;
  v_policy text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF v_method NOT IN ('mpesa','card','bank_transfer') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id AND tenant_id = v_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease not found or not accessible'; END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_paid
  FROM public.payments
  WHERE lease_id = p_lease_id AND payment_type = 'deposit'
    AND status = 'successful' AND verified = true;

  SELECT reservation_fee_policy INTO v_policy FROM public.system_settings WHERE id = 1;
  IF v_policy = 'deductible_deposit' AND v_lease.reservation_id IS NOT NULL THEN
    SELECT COALESCE(sum(amount), 0) INTO v_reservation_deduction
    FROM public.payments
    WHERE reservation_id = v_lease.reservation_id
      AND payment_type = 'reservation'
      AND status = 'successful' AND verified = true;
  END IF;

  v_due := GREATEST(0, COALESCE(v_lease.deposit, 0) - v_paid - v_reservation_deduction);
  IF v_due <= 0 THEN RAISE EXCEPTION 'No security deposit balance is currently due'; END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE user_id = v_user AND lease_id = p_lease_id
    AND payment_type = 'deposit' AND payment_method = v_method AND status = 'pending'
  ORDER BY created_at DESC LIMIT 1;
  IF FOUND THEN RETURN v_payment; END IF;

  INSERT INTO public.payments (
    user_id, lease_id, reservation_id, property_id, unit_id, amount,
    payment_type, payment_method, status, verified
  ) VALUES (
    v_user, p_lease_id, v_lease.reservation_id, v_lease.property_id, v_lease.unit_id,
    v_due, 'deposit', v_method, 'pending', false
  ) RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;
REVOKE ALL ON FUNCTION public.create_deposit_payment(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_deposit_payment(uuid,text) TO authenticated;

-- Tenant submits the bank reference after completing the actual transfer.
-- The optional proof document must belong to the same tenant and be linked to
-- the same lease/property/payment context.
CREATE OR REPLACE FUNCTION public.submit_bank_transfer_payment(
  p_payment_id uuid,
  p_transaction_ref text,
  p_transfer_date date DEFAULT current_date,
  p_channel text DEFAULT 'bank_transfer',
  p_proof_document_id uuid DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payment public.payments%ROWTYPE;
  v_doc public.documents%ROWTYPE;
  v_ref text := NULLIF(trim(coalesce(p_transaction_ref, '')), '');
  v_channel text := lower(NULLIF(trim(coalesce(p_channel, 'bank_transfer')), ''));
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'Enter the bank transaction or transfer reference'; END IF;
  IF length(v_ref) > 120 THEN RAISE EXCEPTION 'Transaction reference is too long'; END IF;
  IF p_transfer_date > current_date THEN RAISE EXCEPTION 'Transfer date cannot be in the future'; END IF;
  IF v_channel NOT IN ('bank_transfer','paybill') THEN RAISE EXCEPTION 'Unsupported bank payment channel'; END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND user_id = v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found or not accessible'; END IF;
  IF v_payment.payment_method <> 'bank_transfer' THEN RAISE EXCEPTION 'This payment is not a bank-transfer payment'; END IF;
  IF v_payment.status <> 'pending' OR v_payment.verified THEN RAISE EXCEPTION 'This payment is no longer awaiting verification'; END IF;

  IF p_proof_document_id IS NOT NULL THEN
    SELECT * INTO v_doc
    FROM public.documents
    WHERE id = p_proof_document_id
      AND uploaded_by = v_user
      AND tenant_id = v_user
    FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Payment proof could not be verified'; END IF;
  END IF;

  UPDATE public.payments
  SET transaction_ref = v_ref,
      bank_transfer_date = p_transfer_date,
      bank_transfer_channel = v_channel,
      proof_document_id = p_proof_document_id,
      provider_reference = COALESCE(provider_reference, 'BANK-' || upper(left(replace(v_ref, ' ', ''), 30))),
      updated_at = now()
  WHERE id = v_payment.id
  RETURNING * INTO v_payment;

  INSERT INTO public.notifications(user_id, title, message, type)
  VALUES (
    v_user,
    'Bank transfer submitted',
    'Your bank transfer of KSh ' || to_char(v_payment.amount, 'FM999,999,999,990.00') || ' has been submitted for verification. Reference ' || v_ref || '.',
    'payment'
  );

  RETURN v_payment;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_bank_transfer_payment(uuid,text,date,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_bank_transfer_payment(uuid,text,date,text,uuid) TO authenticated;

-- Admin review is explicit and auditable. Bank-transfer verification settles
-- the exact linked rent invoice when available, rather than guessing by lease.
CREATE OR REPLACE FUNCTION public.review_payment_by_admin(
  p_payment_id uuid,
  p_action text,
  p_rejection_reason text DEFAULT NULL
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
  v_reason text := NULLIF(trim(coalesce(p_rejection_reason, '')), '');
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
    SET status = 'successful', verified = true, receipt_number = v_receipt,
        verified_at = COALESCE(verified_at, now()), review_notes = NULL,
        updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    IF v_payment.payment_type = 'rent' THEN
      IF v_payment.invoice_id IS NOT NULL THEN
        SELECT * INTO v_invoice FROM public.rent_invoices WHERE id = v_payment.invoice_id FOR UPDATE;
      ELSE
        SELECT * INTO v_invoice
        FROM public.rent_invoices
        WHERE lease_id = v_payment.lease_id
          AND tenant_id = v_payment.user_id
          AND balance > 0
        ORDER BY due_date ASC, created_at ASC
        LIMIT 1
        FOR UPDATE;
      END IF;

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
    IF v_reason IS NULL THEN RAISE EXCEPTION 'A rejection reason is required'; END IF;
    IF length(v_reason) > 500 THEN RAISE EXCEPTION 'Rejection reason is too long'; END IF;

    UPDATE public.payments
    SET status = 'failed', verified = false, review_notes = v_reason, updated_at = now()
    WHERE id = v_payment.id
    RETURNING * INTO v_payment;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_payment.user_id,
      'Payment requires attention',
      'Your submitted ' || replace(v_payment.payment_type, '_', ' ') || ' payment of KSh ' || to_char(v_payment.amount, 'FM999,999,990.00') || ' was not verified. Reason: ' || v_reason,
      'payment'
    );

    RETURN v_payment;
  END IF;

  RAISE EXCEPTION 'Unsupported payment review action';
END;
$$;
REVOKE ALL ON FUNCTION public.review_payment_by_admin(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_payment_by_admin(uuid,text,text) TO authenticated;

-- Store the actual destination account details supplied by HighPark Consult.
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS equity_bank_name text,
  ADD COLUMN IF NOT EXISTS equity_account_name text,
  ADD COLUMN IF NOT EXISTS equity_account_number text,
  ADD COLUMN IF NOT EXISTS equity_paybill_number text;

UPDATE public.system_settings
SET equity_bank_name = 'Equity Bank',
    equity_account_name = 'HIGHPARK CONSULT LIMITED',
    equity_account_number = '0470281425369',
    equity_paybill_number = '4080693',
    payment_account_name = 'HIGHPARK CONSULT LIMITED',
    mpesa_paybill = '4080693',
    mpesa_account_number = '0470281425369'
WHERE id = 1;

NOTIFY pgrst, 'reload schema';
