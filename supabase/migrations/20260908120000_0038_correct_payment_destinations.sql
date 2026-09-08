-- Phase 11.2: Correct payment destinations for HighPark Consult
-- M-Pesa rent/deposit payments: PayBill 247242, account 382000#<HOUSE NO>
-- Direct bank transfers: Equity Bank, HIGHPARK CONSULT LIMITED, A/C 0470281425369

ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS mpesa_paybill text,
  ADD COLUMN IF NOT EXISTS mpesa_account_prefix text;

UPDATE public.system_settings
SET mpesa_paybill = '247242',
    mpesa_account_prefix = '382000',
    equity_bank_name = 'Equity Bank',
    equity_account_name = 'HIGHPARK CONSULT LIMITED',
    equity_account_number = '0470281425369'
WHERE id = 1;

-- M-Pesa PayBill payments are manually submitted with the Safaricom
-- confirmation reference. They remain pending until finance/admin verifies them.
CREATE OR REPLACE FUNCTION public.submit_mpesa_paybill_payment(
  p_payment_id uuid,
  p_transaction_ref text,
  p_payment_date date DEFAULT current_date
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payment public.payments%ROWTYPE;
  v_ref text := NULLIF(trim(coalesce(p_transaction_ref, '')), '');
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF v_ref IS NULL THEN RAISE EXCEPTION 'Enter the M-Pesa transaction reference'; END IF;
  IF length(v_ref) > 120 THEN RAISE EXCEPTION 'Transaction reference is too long'; END IF;
  IF p_payment_date > current_date THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;

  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id AND user_id = v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found or not accessible'; END IF;
  IF v_payment.payment_method <> 'mpesa' THEN RAISE EXCEPTION 'This payment is not an M-Pesa payment'; END IF;
  IF v_payment.status <> 'pending' OR v_payment.verified THEN RAISE EXCEPTION 'This payment is no longer awaiting verification'; END IF;

  UPDATE public.payments
  SET transaction_ref = v_ref,
      bank_transfer_date = p_payment_date,
      bank_transfer_channel = 'mpesa_paybill',
      updated_at = now()
  WHERE id = p_payment_id
  RETURNING * INTO v_payment;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_user,
    'M-Pesa payment submitted',
    'Your M-Pesa PayBill payment reference ' || v_ref || ' has been submitted for verification. Your receipt will be issued after confirmation.',
    'payment'
  );

  RETURN v_payment;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_mpesa_paybill_payment(uuid,text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_mpesa_paybill_payment(uuid,text,date) TO authenticated;

NOTIFY pgrst, 'reload schema';
