/*
  HighPark Consult — payment verification hardening

  The browser may create a pending payment record, but it must never be able
  to mark a payment successful/verified. Production gateway webhooks should
  update these fields using the Supabase service role from a server-side
  Edge Function.
*/

DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update_admin_only"
ON public.payments FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- Prevent ordinary users from changing verification fields even if another
-- permissive policy is added later. The production webhook/service role is
-- intentionally exempt because it bypasses RLS.
CREATE OR REPLACE FUNCTION public.prevent_client_payment_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND (
    NEW.verified IS DISTINCT FROM OLD.verified OR
    NEW.status IS DISTINCT FROM OLD.status OR
    NEW.transaction_ref IS DISTINCT FROM OLD.transaction_ref OR
    NEW.provider_reference IS DISTINCT FROM OLD.provider_reference
  ) THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
      RAISE EXCEPTION 'Payment status and verification are controlled by the payment server';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_payment_verification ON public.payments;
CREATE TRIGGER protect_payment_verification
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.prevent_client_payment_verification();
