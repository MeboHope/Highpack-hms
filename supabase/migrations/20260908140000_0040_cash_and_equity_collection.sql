/* Phase 13 — cash collection + Equity/Jenga collection metadata */
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS equity_payment_link_ref text,
  ADD COLUMN IF NOT EXISTS equity_external_ref text,
  ADD COLUMN IF NOT EXISTS equity_status_code text,
  ADD COLUMN IF NOT EXISTS equity_status_name text,
  ADD COLUMN IF NOT EXISTS equity_response jsonb,
  ADD COLUMN IF NOT EXISTS equity_initiated_at timestamptz,
  ADD COLUMN IF NOT EXISTS equity_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS cash_received_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cash_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS cash_notes text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_equity_link_ref
  ON public.payments(equity_payment_link_ref) WHERE equity_payment_link_ref IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_equity_external_ref
  ON public.payments(equity_external_ref) WHERE equity_external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_payments_equity_status
  ON public.payments(payment_method, equity_status_code, created_at DESC);

CREATE OR REPLACE FUNCTION public.create_rent_payment(p_invoice_id uuid, p_payment_method text DEFAULT 'mpesa')
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_invoice public.rent_invoices%ROWTYPE; v_existing public.payments%ROWTYPE; v_payment public.payments%ROWTYPE; v_user uuid:=auth.uid(); v_method text:=lower(coalesce(p_payment_method,'mpesa'));
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in to make a payment'; END IF;
 IF v_method NOT IN ('mpesa','card','bank_transfer','equity') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
 SELECT * INTO v_invoice FROM public.rent_invoices WHERE id=p_invoice_id AND tenant_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found or not accessible'; END IF;
 IF v_invoice.balance<=0 THEN RAISE EXCEPTION 'This invoice has no outstanding balance'; END IF;
 SELECT * INTO v_existing FROM public.payments WHERE user_id=v_user AND invoice_id=p_invoice_id AND payment_method=v_method AND status='pending' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN RETURN v_existing; END IF;
 INSERT INTO public.payments(user_id,invoice_id,lease_id,property_id,unit_id,amount,payment_type,payment_method,status,verified)
 VALUES(v_user,p_invoice_id,v_invoice.lease_id,v_invoice.property_id,v_invoice.unit_id,v_invoice.balance,'rent',v_method,'pending',false) RETURNING * INTO v_payment;
 RETURN v_payment;
END; $$;
REVOKE ALL ON FUNCTION public.create_rent_payment(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_rent_payment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_deposit_payment(p_lease_id uuid, p_payment_method text DEFAULT 'mpesa')
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_lease public.leases%ROWTYPE; v_existing public.payments%ROWTYPE; v_payment public.payments%ROWTYPE; v_user uuid:=auth.uid(); v_method text:=lower(coalesce(p_payment_method,'mpesa')); v_due numeric;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in to make a payment'; END IF;
 IF v_method NOT IN ('mpesa','card','bank_transfer','equity') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;
 SELECT * INTO v_lease FROM public.leases WHERE id=p_lease_id AND tenant_id=v_user FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lease not found or not accessible'; END IF;
 v_due:=GREATEST(0,COALESCE(v_lease.security_deposit,0)-COALESCE((SELECT SUM(amount) FROM public.payments WHERE lease_id=p_lease_id AND user_id=v_user AND payment_type='deposit' AND verified=true AND status='successful'),0));
 IF v_due<=0 THEN RAISE EXCEPTION 'This security deposit has no outstanding balance'; END IF;
 SELECT * INTO v_existing FROM public.payments WHERE user_id=v_user AND lease_id=p_lease_id AND payment_type='deposit' AND payment_method=v_method AND status='pending' ORDER BY created_at DESC LIMIT 1;
 IF FOUND THEN RETURN v_existing; END IF;
 INSERT INTO public.payments(user_id,lease_id,property_id,unit_id,amount,payment_type,payment_method,status,verified)
 VALUES(v_user,p_lease_id,v_lease.property_id,v_lease.unit_id,v_due,'deposit',v_method,'pending',false) RETURNING * INTO v_payment;
 RETURN v_payment;
END; $$;
REVOKE ALL ON FUNCTION public.create_deposit_payment(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_deposit_payment(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_cash_rent_payment(p_invoice_id uuid,p_amount numeric,p_transaction_ref text DEFAULT NULL,p_received_at timestamptz DEFAULT now(),p_notes text DEFAULT NULL)
RETURNS public.payments LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_role text; v_invoice public.rent_invoices%ROWTYPE; v_payment public.payments%ROWTYPE; v_user uuid:=auth.uid(); v_ref text;
BEGIN
 IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
 SELECT role INTO v_role FROM public.profiles WHERE id=v_user;
 IF v_role<>'admin' THEN RAISE EXCEPTION 'Only an administrator can record cash payments'; END IF;
 SELECT * INTO v_invoice FROM public.rent_invoices WHERE id=p_invoice_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invoice not found'; END IF;
 IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Cash amount must be greater than zero'; END IF;
 IF p_amount>v_invoice.balance THEN RAISE EXCEPTION 'Cash amount cannot exceed the outstanding invoice balance'; END IF;
 v_ref:=NULLIF(trim(coalesce(p_transaction_ref,'')),'');
 INSERT INTO public.payments(user_id,invoice_id,lease_id,property_id,unit_id,amount,payment_type,payment_method,status,verified,transaction_ref,cash_received_by,cash_received_at,cash_notes,provider_reference)
 VALUES(v_invoice.tenant_id,v_invoice.id,v_invoice.lease_id,v_invoice.property_id,v_invoice.unit_id,p_amount,'rent','cash','pending',false,v_ref,v_user,p_received_at,p_notes,'CASH-'||upper(left(replace(gen_random_uuid()::text,'-',''),12))) RETURNING * INTO v_payment;
 RETURN public.review_payment_by_admin(v_payment.id,'verify',NULL);
END; $$;
REVOKE ALL ON FUNCTION public.record_cash_rent_payment(uuid,numeric,text,timestamptz,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_cash_rent_payment(uuid,numeric,text,timestamptz,text) TO authenticated;

NOTIFY pgrst,'reload schema';
