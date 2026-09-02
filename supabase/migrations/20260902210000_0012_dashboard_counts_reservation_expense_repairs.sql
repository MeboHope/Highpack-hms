/* HighPark Consult — dashboard data integrity + reservation/expense workflow repair.
   This migration adds server-side aggregate/read helpers and makes owner reservation
   confirmation transactional so a success toast cannot leave the reservation pending.
*/

-- ---------------------------------------------------------------------------
-- Public website statistics
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_public_site_stats()
RETURNS TABLE (
  verified_properties bigint,
  available_homes bigint,
  counties_covered bigint,
  customer_accounts bigint,
  verified_rent_processed numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.properties WHERE status = 'verified'),
    (SELECT count(*) FROM public.property_units u
      WHERE u.status = 'available'
        AND EXISTS (
          SELECT 1 FROM public.properties p
          WHERE p.id = u.property_id AND p.status = 'verified'
        )),
    (SELECT count(DISTINCT NULLIF(trim(p.county), ''))
      FROM public.properties p WHERE p.status = 'verified'),
    (SELECT count(*) FROM public.profiles WHERE role = 'customer'),
    COALESCE((
      SELECT sum(amount)
      FROM public.payments
      WHERE payment_type = 'rent'
        AND status = 'successful'
        AND verified = true
    ), 0);
$$;

REVOKE ALL ON FUNCTION public.get_public_site_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_stats() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Owner/admin reservation confirmation. The browser no longer performs the
-- status update itself, preventing a false success toast when RLS blocks it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_reservation_status_by_manager(
  p_reservation_id uuid,
  p_status text
)
RETURNS public.reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_res public.reservations%ROWTYPE;
  v_is_admin boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  IF p_status NOT IN ('confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'Only confirmation or cancellation is allowed from this workflow';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_user AND role = 'admin'
  ) INTO v_is_admin;

  SELECT * INTO v_res
  FROM public.reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;

  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = v_res.property_id AND owner_id = v_user
  ) THEN
    RAISE EXCEPTION 'You are not allowed to manage this reservation';
  END IF;

  IF p_status = 'confirmed' THEN
    IF v_res.status <> 'pending' THEN
      RAISE EXCEPTION 'Only a pending reservation can be confirmed';
    END IF;

    UPDATE public.reservations
    SET status = 'confirmed', updated_at = now()
    WHERE id = v_res.id
    RETURNING * INTO v_res;

    UPDATE public.property_units
    SET status = 'reserved', updated_at = now()
    WHERE id = v_res.unit_id;
  ELSE
    IF v_res.status NOT IN ('pending', 'confirmed') THEN
      RAISE EXCEPTION 'This reservation cannot be cancelled';
    END IF;

    UPDATE public.reservations
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_res.id
    RETURNING * INTO v_res;

    UPDATE public.property_units
    SET status = 'available', updated_at = now()
    WHERE id = v_res.unit_id
      AND NOT EXISTS (
        SELECT 1 FROM public.reservations r
        WHERE r.unit_id = v_res.unit_id
          AND r.status IN ('pending', 'confirmed')
          AND r.id <> v_res.id
          AND (r.expires_at IS NULL OR r.expires_at > now())
      );
  END IF;

  RETURN v_res;
END;
$$;

REVOKE ALL ON FUNCTION public.update_reservation_status_by_manager(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_reservation_status_by_manager(uuid,text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Repair expense ownership. When an administrator records an expense for an
-- owner's property, the expense remains attached to the actual property owner
-- so it appears in the owner's expense ledger and reports.
-- ---------------------------------------------------------------------------
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
  v_property public.properties%ROWTYPE;
  v_is_admin boolean;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be greater than zero';
  END IF;

  SELECT * INTO v_property
  FROM public.properties
  WHERE id = p_property_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Property not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_user AND role = 'admin'
  ) INTO v_is_admin;

  IF v_property.owner_id IS DISTINCT FROM v_user AND NOT v_is_admin THEN
    RAISE EXCEPTION 'You are not allowed to record an expense for this property';
  END IF;

  INSERT INTO public.expenses (
    property_id, owner_id, category, amount, expense_date, vendor,
    description, payment_method
  )
  VALUES (
    p_property_id,
    COALESCE(v_property.owner_id, v_user),
    trim(p_category),
    p_amount,
    p_expense_date,
    NULLIF(trim(COALESCE(p_vendor, '')), ''),
    NULLIF(trim(COALESCE(p_description, '')), ''),
    lower(COALESCE(p_payment_method, 'cash'))
  )
  RETURNING * INTO v_exp;

  RETURN v_exp;
END;
$$;

REVOKE ALL ON FUNCTION public.create_owner_expense(uuid,text,numeric,date,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_owner_expense(uuid,text,numeric,date,text,text,text) TO authenticated;


-- ---------------------------------------------------------------------------
-- Authenticated dashboard property performance. This is a SECURITY DEFINER
-- aggregate so RLS cannot turn a populated dashboard into misleading zeroes.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dashboard_property_performance(p_period text)
RETURNS TABLE (
  id uuid,
  name text,
  property_type text,
  units bigint,
  available bigint,
  reserved bigint,
  occupied bigint,
  tenants bigint,
  expected_rent numeric,
  collected_rent numeric,
  tax numeric,
  floors jsonb,
  unit_types jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_role text;
  v_period_start date;
  v_period_end date;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'You must be signed in';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = v_user;
  IF v_role IS NULL OR v_role NOT IN ('owner', 'agent', 'admin') THEN
    RAISE EXCEPTION 'You are not allowed to view this dashboard';
  END IF;

  v_period_start := to_date(COALESCE(NULLIF(p_period, ''), to_char(current_date, 'YYYY-MM')), 'YYYY-MM');
  v_period_end := (v_period_start + interval '1 month')::date;

  RETURN QUERY
  WITH visible_properties AS (
    SELECT p.id, p.name, p.property_type
    FROM public.properties p
    WHERE v_role = 'admin' OR p.owner_id = v_user
  ),
  unit_rollup AS (
    SELECT
      u.property_id,
      count(*)::bigint AS units,
      count(*) FILTER (WHERE u.status = 'available')::bigint AS available,
      count(*) FILTER (WHERE u.status = 'reserved')::bigint AS reserved,
      count(*) FILTER (WHERE u.status = 'occupied')::bigint AS occupied,
      COALESCE(sum(u.monthly_rent) FILTER (WHERE u.status = 'occupied'), 0)::numeric AS expected_rent
    FROM public.property_units u
    JOIN visible_properties vp ON vp.id = u.property_id
    GROUP BY u.property_id
  ),
  tenant_rollup AS (
    SELECT l.property_id, count(*)::bigint AS tenants
    FROM public.leases l
    JOIN visible_properties vp ON vp.id = l.property_id
    WHERE l.status = 'active'
    GROUP BY l.property_id
  ),
  payment_rollup AS (
    SELECT p.property_id, COALESCE(sum(p.amount), 0)::numeric AS collected_rent
    FROM public.payments p
    JOIN visible_properties vp ON vp.id = p.property_id
    WHERE p.payment_type = 'rent'
      AND p.status = 'successful'
      AND p.verified = true
      AND p.created_at >= v_period_start
      AND p.created_at < v_period_end
    GROUP BY p.property_id
  ),
  tax_rollup AS (
    SELECT t.property_id, COALESCE(sum(t.estimated_tax), 0)::numeric AS tax
    FROM public.tax_records t
    JOIN visible_properties vp ON vp.id = t.property_id
    WHERE t.period = to_char(v_period_start, 'YYYY-MM')
    GROUP BY t.property_id
  ),
  floor_counts AS (
    SELECT
      u.property_id,
      CASE WHEN u.floor IS NULL THEN 'Ground / Unspecified' ELSE 'Floor ' || u.floor::text END AS floor_label,
      count(*)::bigint AS total,
      count(*) FILTER (WHERE u.status = 'available')::bigint AS available,
      count(*) FILTER (WHERE u.status = 'occupied')::bigint AS occupied,
      count(*) FILTER (WHERE u.status = 'reserved')::bigint AS reserved
    FROM public.property_units u
    JOIN visible_properties vp ON vp.id = u.property_id
    GROUP BY u.property_id, CASE WHEN u.floor IS NULL THEN 'Ground / Unspecified' ELSE 'Floor ' || u.floor::text END
  ),
  floor_rollup AS (
    SELECT
      property_id,
      jsonb_object_agg(
        floor_label,
        jsonb_build_object('total', total, 'available', available, 'occupied', occupied, 'reserved', reserved)
      ) AS floors
    FROM floor_counts
    GROUP BY property_id
  ),
  type_rollup AS (
    SELECT
      u.property_id,
      jsonb_object_agg(
        COALESCE(NULLIF(trim(u.house_type), ''), CASE WHEN u.bedrooms = 0 THEN 'Bedsitter / Studio' ELSE u.bedrooms::text || ' Bedroom' END),
        type_count
      ) AS unit_types
    FROM (
      SELECT property_id,
             house_type,
             bedrooms,
             count(*)::bigint AS type_count
      FROM public.property_units
      GROUP BY property_id, house_type, bedrooms
    ) u
    JOIN visible_properties vp ON vp.id = u.property_id
    GROUP BY u.property_id
  )
  SELECT
    vp.id,
    vp.name,
    vp.property_type,
    COALESCE(ur.units, 0),
    COALESCE(ur.available, 0),
    COALESCE(ur.reserved, 0),
    COALESCE(ur.occupied, 0),
    COALESCE(tr.tenants, 0),
    COALESCE(ur.expected_rent, 0),
    COALESCE(pr.collected_rent, 0),
    COALESCE(tx.tax, 0),
    COALESCE(fr.floors, '{}'::jsonb),
    COALESCE(ty.unit_types, '{}'::jsonb)
  FROM visible_properties vp
  LEFT JOIN unit_rollup ur ON ur.property_id = vp.id
  LEFT JOIN tenant_rollup tr ON tr.property_id = vp.id
  LEFT JOIN payment_rollup pr ON pr.property_id = vp.id
  LEFT JOIN tax_rollup tx ON tx.property_id = vp.id
  LEFT JOIN floor_rollup fr ON fr.property_id = vp.id
  LEFT JOIN type_rollup ty ON ty.property_id = vp.id
  ORDER BY vp.name;
END;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_property_performance(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_property_performance(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
