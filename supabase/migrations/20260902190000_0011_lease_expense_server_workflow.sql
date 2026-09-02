/* HighPark Consult — server-side lease conversion and expense recording.
   These SECURITY DEFINER functions prevent browser RLS policies from blocking
   legitimate owner operations while keeping ownership validation server-side. */

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
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  SELECT * INTO v_res FROM public.reservations WHERE id = p_reservation_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id = v_res.property_id AND (owner_id = v_user OR EXISTS (SELECT 1 FROM public.profiles WHERE id=v_user AND role='admin'))) THEN
    RAISE EXCEPTION 'You are not allowed to convert this reservation';
  END IF;
  IF v_res.status <> 'confirmed' THEN RAISE EXCEPTION 'Only a confirmed reservation can become a lease'; END IF;
  IF EXISTS (SELECT 1 FROM public.leases WHERE reservation_id = p_reservation_id AND status IN ('active','pending_signature')) THEN
    RAISE EXCEPTION 'This reservation already has a lease';
  END IF;
  SELECT * INTO v_unit FROM public.property_units WHERE id = v_res.unit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unit not found'; END IF;
  v_end := (p_lease_start + make_interval(months => GREATEST(1, p_lease_months)))::date;

  INSERT INTO public.leases (tenant_id, unit_id, property_id, reservation_id, lease_start, lease_end, monthly_rent, deposit, status, signed_by_tenant, signed_by_owner)
  VALUES (v_res.customer_id, v_res.unit_id, v_res.property_id, v_res.id, p_lease_start, v_end, COALESCE(v_unit.monthly_rent,0), COALESCE(v_unit.security_deposit,0), 'active', false, true)
  RETURNING * INTO v_lease;

  UPDATE public.reservations SET status='converted' WHERE id=v_res.id;
  UPDATE public.property_units SET status='occupied' WHERE id=v_res.unit_id;
  INSERT INTO public.notifications (user_id,title,message,type)
  VALUES (v_res.customer_id,'Lease activated','Your reservation has been converted to an active lease.','lease');
  RETURN v_lease;
END;
$$;
REVOKE ALL ON FUNCTION public.create_lease_from_reservation(uuid,date,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_lease_from_reservation(uuid,date,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_owner_expense(
  p_property_id uuid,
  p_category text,
  p_amount numeric,
  p_expense_date date,
  p_vendor text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_payment_method text DEFAULT 'cash'
)
RETURNS public.expenses
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_exp public.expenses%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Expense amount must be greater than zero'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.properties WHERE id=p_property_id AND (owner_id=v_user OR EXISTS (SELECT 1 FROM public.profiles WHERE id=v_user AND role='admin'))) THEN
    RAISE EXCEPTION 'You are not allowed to record an expense for this property';
  END IF;
  INSERT INTO public.expenses(property_id,owner_id,category,amount,expense_date,vendor,description,payment_method)
  VALUES(p_property_id, v_user, trim(p_category), p_amount, p_expense_date, NULLIF(trim(COALESCE(p_vendor,'')),''), NULLIF(trim(COALESCE(p_description,'')),''), lower(COALESCE(p_payment_method,'cash')))
  RETURNING * INTO v_exp;
  RETURN v_exp;
END;
$$;
REVOKE ALL ON FUNCTION public.create_owner_expense(uuid,text,numeric,date,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_owner_expense(uuid,text,numeric,date,text,text,text) TO authenticated;

NOTIFY pgrst, 'reload schema';
