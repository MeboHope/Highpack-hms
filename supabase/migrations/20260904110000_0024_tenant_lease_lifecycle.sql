/* HighPark Consult — Phase 4: Tenant & Lease Lifecycle Management.
   Centralizes lease renewal, move-out and expiry processing in transactional RPCs.
*/

CREATE OR REPLACE FUNCTION public.renew_lease(
  p_lease_id uuid,
  p_lease_months integer DEFAULT 12
)
RETURNS public.leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
  v_new public.leases%ROWTYPE;
  v_new_start date;
  v_new_end date;
  v_period text;
  v_amount numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_lease_months < 1 OR p_lease_months > 36 THEN RAISE EXCEPTION 'Renewal term must be between 1 and 36 months'; END IF;

  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = v_lease.property_id
      AND (p.owner_id = v_user OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND role = 'admin'))
  ) THEN RAISE EXCEPTION 'You are not allowed to renew this lease'; END IF;
  IF v_lease.status NOT IN ('active','expired','renewed') THEN RAISE EXCEPTION 'Only an active, expired or renewed lease can be renewed'; END IF;

  v_new_start := GREATEST(CURRENT_DATE, v_lease.lease_end + 1);
  v_new_end := (v_new_start + make_interval(months => p_lease_months))::date;

  UPDATE public.leases
  SET status = 'renewed', updated_at = now()
  WHERE id = v_lease.id;

  INSERT INTO public.leases (
    tenant_id, unit_id, property_id, reservation_id, lease_start, lease_end,
    monthly_rent, deposit, service_charge, payment_due_day, grace_period_days,
    status, agreement_text, signed_by_tenant, signed_by_owner
  ) VALUES (
    v_lease.tenant_id, v_lease.unit_id, v_lease.property_id, NULL,
    v_new_start, v_new_end, v_lease.monthly_rent, v_lease.deposit, v_lease.service_charge,
    v_lease.payment_due_day, v_lease.grace_period_days, 'active', v_lease.agreement_text,
    false, true
  ) RETURNING * INTO v_new;

  v_period := to_char(v_new.lease_start, 'YYYY-MM');
  v_amount := GREATEST(0, COALESCE(v_new.monthly_rent,0) + COALESCE(v_new.service_charge,0));
  INSERT INTO public.rent_invoices (
    lease_id, tenant_id, property_id, unit_id, period, amount, balance, status, due_date
  ) VALUES (
    v_new.id, v_new.tenant_id, v_new.property_id, v_new.unit_id, v_period,
    v_amount, v_amount, 'unpaid', v_new.lease_start
  ) ON CONFLICT (lease_id, period) DO NOTHING;

  UPDATE public.property_units SET status = 'occupied', updated_at = now() WHERE id = v_new.unit_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_new.tenant_id,
    'Lease renewed',
    format('Your lease has been renewed for %s months. The renewed term runs from %s to %s.', p_lease_months, v_new.lease_start, v_new.lease_end),
    'lease'
  );

  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.renew_lease(uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.renew_lease(uuid,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.move_out_lease(
  p_lease_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS public.leases
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_lease public.leases%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT * INTO v_lease FROM public.leases WHERE id = p_lease_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lease not found'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = v_lease.property_id
      AND (p.owner_id = v_user OR EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND role = 'admin'))
  ) THEN RAISE EXCEPTION 'You are not allowed to close this lease'; END IF;
  IF v_lease.status NOT IN ('active','expired') THEN RAISE EXCEPTION 'Only an active or expired lease can be moved out'; END IF;

  UPDATE public.leases
  SET status = 'terminated', updated_at = now()
  WHERE id = v_lease.id
  RETURNING * INTO v_lease;

  UPDATE public.property_units
  SET status = 'available', updated_at = now()
  WHERE id = v_lease.unit_id;

  INSERT INTO public.notifications (user_id, title, message, type)
  VALUES (
    v_lease.tenant_id,
    'Tenancy closed',
    CASE WHEN NULLIF(trim(COALESCE(p_reason,'')), '') IS NULL
      THEN 'Your tenancy has been closed and the unit has been released.'
      ELSE 'Your tenancy has been closed. Reason: ' || trim(p_reason)
    END,
    'lease'
  );

  RETURN v_lease;
END;
$$;
REVOKE ALL ON FUNCTION public.move_out_lease(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.move_out_lease(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.expire_due_leases()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_count integer := 0;
  v_expired public.leases%ROWTYPE;
BEGIN
  IF v_user IS NULL OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_user AND role = 'admin') THEN
    RAISE EXCEPTION 'Only administrators can process lease expiries';
  END IF;

  FOR v_expired IN
    SELECT * FROM public.leases
    WHERE status = 'active' AND lease_end < CURRENT_DATE
    FOR UPDATE
  LOOP
    UPDATE public.leases
    SET status = 'expired', updated_at = now()
    WHERE id = v_expired.id;

    UPDATE public.property_units
    SET status = 'available', updated_at = now()
    WHERE id = v_expired.unit_id;

    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (
      v_expired.tenant_id,
      'Lease expired',
      'Your lease has reached its end date. Please contact the property manager if you would like to renew.',
      'lease'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.expire_due_leases() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_due_leases() TO authenticated;
