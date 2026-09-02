/* HighPark Consult — privilege repair + transactional pending payments.
   This migration repairs explicit API grants while keeping RLS as the authorization layer.
*/

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON public.system_settings TO anon, authenticated;
GRANT SELECT ON public.properties TO anon, authenticated;
GRANT SELECT ON public.property_units TO anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.reservations TO authenticated;
GRANT INSERT ON public.reservations TO authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;
GRANT UPDATE ON public.payments TO authenticated;
GRANT SELECT ON public.tax_records TO authenticated;
GRANT INSERT, UPDATE ON public.tax_records TO authenticated;
GRANT SELECT ON public.leases TO authenticated;
GRANT SELECT ON public.rent_invoices TO authenticated;
GRANT UPDATE ON public.rent_invoices TO authenticated;
GRANT SELECT, INSERT ON public.maintenance_requests TO authenticated;
GRANT UPDATE ON public.maintenance_requests TO authenticated;

-- Public settings are readable; only admins can change them through RLS.
DROP POLICY IF EXISTS "settings_public_read" ON public.system_settings;
CREATE POLICY "settings_public_read" ON public.system_settings
FOR SELECT TO anon, authenticated USING (true);

-- Reservation creation also creates a PENDING payment record atomically.
-- The browser is never allowed to mark it successful/verified.
CREATE OR REPLACE FUNCTION public.create_reservation(
  p_unit_id uuid,
  p_duration_hours integer DEFAULT 48,
  p_payment_method text DEFAULT 'mpesa'
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unit public.property_units%ROWTYPE;
  v_existing public.reservations%ROWTYPE;
  v_res public.reservations%ROWTYPE;
  v_customer uuid := auth.uid();
  v_fee numeric;
  v_hours integer := GREATEST(1, LEAST(COALESCE(p_duration_hours, 48), 168));
  v_method text := COALESCE(p_payment_method, 'mpesa');
BEGIN
  IF v_customer IS NULL THEN RAISE EXCEPTION 'You must be signed in to reserve a property'; END IF;
  IF v_method NOT IN ('mpesa','card','bank_transfer') THEN RAISE EXCEPTION 'Unsupported payment method'; END IF;

  SELECT * INTO v_unit FROM public.property_units WHERE id = p_unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The selected unit could not be found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = v_unit.property_id AND status = 'verified') THEN
    RAISE EXCEPTION 'This property is not currently available for reservation';
  END IF;
  IF v_unit.status <> 'available' THEN RAISE EXCEPTION 'This unit is no longer available'; END IF;

  SELECT * INTO v_existing FROM public.reservations
  WHERE unit_id = p_unit_id AND status IN ('pending','confirmed')
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
  IF FOUND THEN RAISE EXCEPTION 'This unit has already been reserved'; END IF;

  SELECT reservation_fee INTO v_fee FROM public.system_settings WHERE id = 1;
  v_fee := COALESCE(v_unit.reservation_fee, v_fee, 2000);

  UPDATE public.property_units SET status = 'reserved', updated_at = now() WHERE id = v_unit.id;
  INSERT INTO public.reservations (unit_id, property_id, customer_id, reservation_fee, status, expires_at)
  VALUES (v_unit.id, v_unit.property_id, v_customer, v_fee, 'pending', now() + make_interval(hours => v_hours))
  RETURNING * INTO v_res;

  INSERT INTO public.payments (
    user_id, reservation_id, property_id, unit_id, amount, payment_type, payment_method, status, verified
  ) VALUES (
    v_customer, v_res.id, v_unit.property_id, v_unit.id, v_fee, 'reservation', v_method, 'pending', false
  );

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.create_reservation(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reservation(uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_reservation(uuid, integer, text) TO authenticated;

-- Ensure authenticated users can create pending payment intents, while the
-- existing verification trigger/RLS prevents client-side success claims.
DROP POLICY IF EXISTS "payments_insert" ON public.payments;
CREATE POLICY "payments_insert" ON public.payments
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND status = 'pending' AND verified = false);

-- Admin settings writes remain RLS-protected.
DROP POLICY IF EXISTS "settings_admin_write" ON public.system_settings;
CREATE POLICY "settings_admin_write" ON public.system_settings
FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
