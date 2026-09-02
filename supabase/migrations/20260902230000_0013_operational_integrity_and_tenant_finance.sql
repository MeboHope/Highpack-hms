/* HighPark Consult — final operational integrity pass.
   - Keeps dashboard aggregates tied to real portfolio rows.
   - Makes owner/admin maintenance and expense ledgers reliable.
   - Generates the first rent invoice when a lease is activated/signed.
   - Exposes an accurate tenant move-in amount and controlled deposit payment intent.
*/

-- Ensure a lease cannot receive two invoices for the same period.
-- Remove any accidental duplicates from earlier test data before enforcing it.
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY lease_id, period ORDER BY created_at, id) AS rn
  FROM public.rent_invoices
)
DELETE FROM public.rent_invoices ri
USING duplicates d
WHERE ri.id = d.id AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_rent_invoices_lease_period
  ON public.rent_invoices(lease_id, period);

-- Backfill the first invoice for existing active leases that do not have one.
INSERT INTO public.rent_invoices (
  lease_id, tenant_id, property_id, unit_id, period, amount, balance, status, due_date
)
SELECT
  l.id,
  l.tenant_id,
  l.property_id,
  l.unit_id,
  to_char(l.lease_start, 'YYYY-MM'),
  GREATEST(0, COALESCE(l.monthly_rent, 0) + COALESCE(l.service_charge, 0)),
  GREATEST(0, COALESCE(l.monthly_rent, 0) + COALESCE(l.service_charge, 0)),
  'unpaid',
  l.lease_start
FROM public.leases l
WHERE l.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.rent_invoices ri
    WHERE ri.lease_id = l.id
      AND ri.period = to_char(l.lease_start, 'YYYY-MM')
  )
ON CONFLICT (lease_id, period) DO NOTHING;

-- Rebuild lease activation so it also creates the first payable rent invoice.
CREATE OR REPLACE FUNCTION public.create_lease_from_reservation(
  p_reservation_id uuid,
  p_lease_start date DEFAULT CURRENT_DATE,
  p_lease_months integer DEFAULT 12
)
RETURNS public.leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_res public.reservations%ROWTYPE;
  v_unit public.property_units%ROWTYPE;
  v_lease public.leases%ROWTYPE;
  v_user uuid := auth.uid();
  v_end date;
  v_period text;
  v_amount numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;

  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = v_res.property_id
      AND (owner_id = v_user OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND role = 'admin'))
  ) THEN
    RAISE EXCEPTION 'You are not allowed to convert this reservation';
  END IF;

  IF v_res.status <> 'confirmed' THEN RAISE EXCEPTION 'Only a confirmed reservation can become a lease'; END IF;
  IF EXISTS (SELECT 1 FROM public.leases WHERE reservation_id = p_reservation_id AND status IN ('active','pending_signature')) THEN
    RAISE EXCEPTION 'This reservation already has a lease';
  END IF;

  SELECT * INTO v_unit FROM public.property_units WHERE id = v_res.unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found'; END IF;

  v_end := (p_lease_start + make_interval(months => GREATEST(1, p_lease_months)))::date;
  v_period := to_char(p_lease_start, 'YYYY-MM');
  v_amount := GREATEST(0, COALESCE(v_unit.monthly_rent, 0) + COALESCE(v_unit.service_charge, 0));

  INSERT INTO public.leases (
    tenant_id, unit_id, property_id, reservation_id, lease_start, lease_end,
    monthly_rent, deposit, service_charge, status, signed_by_tenant, signed_by_owner
  ) VALUES (
    v_res.customer_id, v_res.unit_id, v_res.property_id, v_res.id, p_lease_start, v_end,
    COALESCE(v_unit.monthly_rent, 0), COALESCE(v_unit.security_deposit, 0), COALESCE(v_unit.service_charge, 0),
    'active', false, true
  ) RETURNING * INTO v_lease;

  UPDATE public.rent_invoices
  SET amount = v_amount,
      balance = CASE WHEN status = 'paid' THEN 0 ELSE v_amount END
  WHERE lease_id = v_lease.id AND period = v_period;

  INSERT INTO public.rent_invoices (
    lease_id, tenant_id, property_id, unit_id, period, amount, balance, status, due_date
  )
  VALUES (
    v_lease.id, v_lease.tenant_id, v_lease.property_id, v_lease.unit_id,
    v_period, v_amount, v_amount, 'unpaid', p_lease_start
  ) ON CONFLICT (lease_id, period) DO NOTHING;

  UPDATE public.reservations SET status = 'converted', updated_at = now() WHERE id = v_res.id;
  UPDATE public.property_units SET status = 'occupied', updated_at = now() WHERE id = v_res.unit_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_res.customer_id,
    'Lease activated',
    'Your lease is active. Your first rent invoice is now available in Rent & Payments.',
    'lease'
  );

  RETURN v_lease;
END;
$$;
REVOKE ALL ON FUNCTION public.create_lease_from_reservation(uuid,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_lease_from_reservation(uuid,date,integer) TO authenticated;

-- Tenant signature is transactional and guarantees the first invoice exists.
CREATE OR REPLACE FUNCTION public.sign_lease_and_prepare_payment(p_lease_id uuid)
RETURNS public.leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_period text;
  v_amount numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;

  SELECT * INTO v_lease
  FROM public.leases
  WHERE id = p_lease_id AND tenant_id = v_user
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease not found or not accessible'; END IF;
  IF v_lease.status IN ('terminated', 'expired') THEN RAISE EXCEPTION 'This lease is no longer active'; END IF;

  UPDATE public.leases
  SET signed_by_tenant = true,
      status = 'active',
      updated_at = now()
  WHERE id = p_lease_id
  RETURNING * INTO v_lease;

  v_period := to_char(v_lease.lease_start, 'YYYY-MM');
  v_amount := GREATEST(0, COALESCE(v_lease.monthly_rent, 0) + COALESCE(v_lease.service_charge, 0));

  INSERT INTO public.rent_invoices (
    lease_id, tenant_id, property_id, unit_id, period, amount, balance, status, due_date
  ) VALUES (
    v_lease.id, v_lease.tenant_id, v_lease.property_id, v_lease.unit_id,
    v_period, v_amount, v_amount, 'unpaid', v_lease.lease_start
  ) ON CONFLICT (lease_id, period) DO NOTHING;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_user, 'Lease signed', 'Your tenancy agreement is signed and your payment balance is ready.', 'lease');

  RETURN v_lease;
END;
$$;
REVOKE ALL ON FUNCTION public.sign_lease_and_prepare_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_lease_and_prepare_payment(uuid) TO authenticated;

-- Controlled deposit payment intent. The browser can never choose an arbitrary amount.
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
    AND payment_type = 'deposit' AND status = 'pending'
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




CREATE OR REPLACE FUNCTION public.update_maintenance_status_by_manager(p_request_id uuid, p_status text)
RETURNS public.maintenance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_request public.maintenance_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_status NOT IN ('submitted','assigned','in_progress','awaiting_parts','completed','closed') THEN RAISE EXCEPTION 'Invalid maintenance status'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user;
  IF v_role NOT IN ('owner','agent','admin') THEN RAISE EXCEPTION 'You are not allowed to manage maintenance'; END IF;
  SELECT * INTO v_request FROM public.maintenance_requests WHERE id = p_request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Maintenance request not found'; END IF;
  IF v_role <> 'admin' AND NOT EXISTS (SELECT 1 FROM public.properties WHERE id = v_request.property_id AND owner_id = v_user) THEN
    RAISE EXCEPTION 'You are not allowed to manage this maintenance request';
  END IF;
  UPDATE public.maintenance_requests SET status = p_status, updated_at = now() WHERE id = p_request_id RETURNING * INTO v_request;
  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (v_request.tenant_id, 'Maintenance request updated', 'Your maintenance/service request status is now ' || replace(initcap(p_status), '_', ' ') || '.', 'maintenance');
  RETURN v_request;
END;
$$;
REVOKE ALL ON FUNCTION public.update_maintenance_status_by_manager(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_maintenance_status_by_manager(uuid,text) TO authenticated;

-- Stable read helpers for manager ledgers. These return only records the
-- signed-in owner/admin is entitled to see, but do not depend on browser RLS
-- joins or stale policy caches.
CREATE OR REPLACE FUNCTION public.get_managed_expenses()
RETURNS TABLE (
  id uuid, property_id uuid, owner_id uuid, category text, amount numeric,
  expense_date date, vendor text, description text, payment_method text,
  created_at timestamptz, property_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user;
  IF v_role NOT IN ('owner','agent','admin') THEN RAISE EXCEPTION 'You are not allowed to view expenses'; END IF;

  RETURN QUERY
  SELECT e.id, e.property_id, e.owner_id, e.category, e.amount, e.expense_date,
         e.vendor, e.description, e.payment_method, e.created_at, p.name
  FROM public.expenses e
  JOIN public.properties p ON p.id = e.property_id
  WHERE v_role = 'admin' OR p.owner_id = v_user
  ORDER BY e.expense_date DESC, e.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_managed_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_expenses() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_managed_maintenance_requests()
RETURNS TABLE (
  id uuid, tenant_id uuid, property_id uuid, unit_id uuid, category text,
  description text, priority text, status text, photos text[], assigned_to text,
  created_at timestamptz, updated_at timestamptz, property_name text,
  unit_number text, tenant_name text, tenant_phone text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user;
  IF v_role NOT IN ('owner','agent','admin') THEN RAISE EXCEPTION 'You are not allowed to view maintenance requests'; END IF;

  RETURN QUERY
  SELECT m.id, m.tenant_id, m.property_id, m.unit_id, m.category, m.description,
         m.priority, m.status, m.photos, m.assigned_to, m.created_at, m.updated_at,
         p.name, u.unit_number, tp.full_name, tp.phone
  FROM public.maintenance_requests m
  JOIN public.properties p ON p.id = m.property_id
  JOIN public.property_units u ON u.id = m.unit_id
  LEFT JOIN public.profiles tp ON tp.id = m.tenant_id
  WHERE v_role = 'admin' OR p.owner_id = v_user
  ORDER BY m.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.get_managed_maintenance_requests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_maintenance_requests() TO authenticated;

-- Tenant maintenance creation is validated server-side against an active lease
-- or current reservation, preventing orphaned requests and RLS edge cases.
CREATE OR REPLACE FUNCTION public.create_tenant_maintenance_request(
  p_category text,
  p_priority text,
  p_description text
)
RETURNS public.maintenance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_property uuid;
  v_unit uuid;
  v_request public.maintenance_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF lower(coalesce(p_category, 'other')) NOT IN ('plumbing','electrical','water','security','structural','appliances','cleaning','other') THEN
    RAISE EXCEPTION 'Invalid maintenance category';
  END IF;
  IF lower(coalesce(p_priority, 'medium')) NOT IN ('low','medium','high','urgent') THEN
    RAISE EXCEPTION 'Invalid maintenance priority';
  END IF;
  IF nullif(trim(coalesce(p_description, '')), '') IS NULL THEN RAISE EXCEPTION 'Please describe the issue'; END IF;

  SELECT property_id, unit_id INTO v_property, v_unit
  FROM public.leases
  WHERE tenant_id = v_user AND status = 'active'
  ORDER BY created_at DESC LIMIT 1;

  IF v_property IS NULL THEN
    SELECT property_id, unit_id INTO v_property, v_unit
    FROM public.reservations
    WHERE customer_id = v_user AND status IN ('pending','confirmed')
    ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF v_property IS NULL OR v_unit IS NULL THEN
    RAISE EXCEPTION 'Reserve or activate a home before submitting a maintenance request';
  END IF;

  INSERT INTO public.maintenance_requests (
    tenant_id, property_id, unit_id, category, priority, description, status
  ) VALUES (
    v_user, v_property, v_unit, lower(coalesce(p_category, 'other')),
    lower(coalesce(p_priority, 'medium')), trim(p_description), 'submitted'
  ) RETURNING * INTO v_request;

  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT p.owner_id, 'New maintenance request', 'A tenant has submitted a new maintenance/service request.', 'maintenance'
  FROM public.properties p WHERE p.id = v_property AND p.owner_id IS NOT NULL;

  RETURN v_request;
END;
$$;
REVOKE ALL ON FUNCTION public.create_tenant_maintenance_request(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_tenant_maintenance_request(text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
