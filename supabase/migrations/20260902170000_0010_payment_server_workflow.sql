/* HighPark Consult — payment workflow foundation
   Browser clients may create pending intents through controlled RPCs, but
   successful/verified payment state remains server-side/admin controlled.

   This migration is safe to apply before Daraja credentials are available.
*/

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
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to make a payment';
  END IF;
  IF v_method NOT IN ('mpesa','card','bank_transfer') THEN
    RAISE EXCEPTION 'Unsupported payment method';
  END IF;

  SELECT * INTO v_invoice
  FROM public.rent_invoices
  WHERE id = p_invoice_id AND tenant_id = v_user
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found or not accessible';
  END IF;
  IF v_invoice.balance <= 0 THEN
    RAISE EXCEPTION 'This invoice has no outstanding balance';
  END IF;

  SELECT * INTO v_existing
  FROM public.payments
  WHERE user_id = v_user
    AND lease_id = v_invoice.lease_id
    AND payment_type = 'rent'
    AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.payments (
    user_id, lease_id, property_id, unit_id, amount,
    payment_type, payment_method, status, verified
  ) VALUES (
    v_user, v_invoice.lease_id, v_invoice.property_id, v_invoice.unit_id,
    v_invoice.balance, 'rent', v_method, 'pending', false
  ) RETURNING * INTO v_payment;

  RETURN v_payment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_rent_payment(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_rent_payment(uuid, text) TO authenticated;

-- Make the browser incapable of creating arbitrary payment rows. Controlled
-- RPCs above create only valid pending rows; service-role webhooks can bypass RLS.
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert_pending_only" ON public.payments
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND status = 'pending' AND verified = false);

-- Explicitly document/allow customer reads of their own payment state through RLS.
GRANT SELECT ON public.payments TO authenticated;

-- Server-side integration configuration is intentionally stored as non-secret
-- business settings. Daraja consumer secrets/passkeys must NOT be stored here.
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS mpesa_paybill text,
  ADD COLUMN IF NOT EXISTS mpesa_account_number text,
  ADD COLUMN IF NOT EXISTS equity_paybill text,
  ADD COLUMN IF NOT EXISTS equity_account_prefix text,
  ADD COLUMN IF NOT EXISTS payment_account_name text;

UPDATE public.system_settings
SET mpesa_paybill = COALESCE(mpesa_paybill, '4080693'),
    mpesa_account_number = COALESCE(mpesa_account_number, '0470281425369'),
    equity_paybill = COALESCE(equity_paybill, '247247'),
    equity_account_prefix = COALESCE(equity_account_prefix, '382000'),
    payment_account_name = COALESCE(payment_account_name, 'HIGHPARK CONSULT LTD')
WHERE id = 1;

NOTIFY pgrst, 'reload schema';
