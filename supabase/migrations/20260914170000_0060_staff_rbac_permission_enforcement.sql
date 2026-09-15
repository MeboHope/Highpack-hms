-- Phase 38: Staff RBAC permission enforcement and property scope.
-- Super Admin remains unrestricted. Operational staff are constrained by their
-- role permissions and, where applicable, assigned properties.

CREATE OR REPLACE FUNCTION public.staff_has_permission(p_permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.staff_members sm ON sm.user_id = p.id AND sm.status = 'active'
    LEFT JOIN public.staff_roles sr ON sr.id = sm.staff_role_id
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND (
        COALESCE(p.is_super_admin, false)
        OR COALESCE(sr.permissions, '[]'::jsonb) ? p_permission
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.staff_can_access_property(
  p_property_id uuid,
  p_permission text DEFAULT 'properties.view'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    LEFT JOIN public.staff_members sm ON sm.user_id = p.id AND sm.status = 'active'
    LEFT JOIN public.staff_roles sr ON sr.id = sm.staff_role_id
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND (
        COALESCE(p.is_super_admin, false)
        OR (
          COALESCE(sr.permissions, '[]'::jsonb) ? p_permission
          AND EXISTS (
            SELECT 1
            FROM public.staff_property_assignments spa
            WHERE spa.user_id = p.id
              AND spa.property_id = p_property_id
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.require_staff_permission(
  p_permission text,
  p_property_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_property_id IS NULL THEN
    IF NOT public.staff_has_permission(p_permission) THEN
      RAISE EXCEPTION 'Staff permission required: %', p_permission USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT public.staff_can_access_property(p_property_id, p_permission) THEN
      RAISE EXCEPTION 'Staff permission or property assignment required: %', p_permission USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN true;
END;
$$;

INSERT INTO public.staff_roles (role_key, name, description, permissions)
VALUES
  ('property_manager', 'Property Manager', 'Portfolio operations, occupants, leases and maintenance.', '["dashboard.view","properties.view","properties.manage","units.view","units.manage","leases.view","leases.manage","maintenance.view","maintenance.manage","reservations.view","reservations.manage","shortstay.view","shortstay.manage","tenants.view","documents.view","reports.view"]'::jsonb),
  ('finance_officer', 'Finance Officer', 'Collections, expenses, tax and financial reporting.', '["dashboard.view","payments.view","payments.manage","expenses.view","expenses.manage","tax.view","tax.manage","reports.view"]'::jsonb),
  ('sales_officer', 'Sales & Lettings Officer', 'Sales listings, enquiries, viewings and marketplace operations.', '["dashboard.view","properties.view","sales.view","sales.manage","enquiries.view","enquiries.manage","viewings.view","viewings.manage"]'::jsonb),
  ('compliance_officer', 'Compliance & Verification Officer', 'Property verification, documentation and compliance workflows.', '["dashboard.view","properties.view","properties.verify","documents.view","documents.manage","audit.view"]'::jsonb),
  ('support_officer', 'Customer Support Officer', 'Customer communication, enquiries, appointments and notifications.', '["dashboard.view","customers.view","messages.view","messages.manage","enquiries.view","enquiries.manage","viewings.view","viewings.manage","notifications.manage"]'::jsonb)
ON CONFLICT (role_key) DO UPDATE SET permissions=EXCLUDED.permissions, name=EXCLUDED.name, description=EXCLUDED.description, updated_at=now();

REVOKE ALL ON FUNCTION public.staff_has_permission(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.staff_can_access_property(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.require_staff_permission(text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_has_permission(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_can_access_property(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_staff_permission(text,uuid) TO authenticated;

-- Super Admin-only property assignment lifecycle helpers.
CREATE OR REPLACE FUNCTION public.staff_property_assignments_for_admin(p_user_id uuid)
RETURNS TABLE(property_id uuid, property_name text, town text, county text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.town, p.county
  FROM public.staff_property_assignments spa
  JOIN public.properties p ON p.id = spa.property_id
  WHERE spa.user_id = p_user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid() AND me.role = 'admin' AND me.is_super_admin = true
    )
  ORDER BY p.name;
$$;

CREATE OR REPLACE FUNCTION public.set_staff_property_assignments(
  p_user_id uuid,
  p_property_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles me
    WHERE me.id = auth.uid() AND me.role = 'admin' AND me.is_super_admin = true
  ) THEN
    RAISE EXCEPTION 'Only a Super Admin can assign staff properties' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.staff_members sm
    WHERE sm.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'The selected user is not an operational staff member';
  END IF;

  DELETE FROM public.staff_property_assignments WHERE user_id = p_user_id;

  INSERT INTO public.staff_property_assignments(user_id, property_id, assigned_by)
  SELECT p_user_id, pid, auth.uid()
  FROM unnest(COALESCE(p_property_ids, ARRAY[]::uuid[])) AS pid
  JOIN public.properties p ON p.id = pid
  ON CONFLICT (user_id, property_id) DO UPDATE
    SET assigned_by = EXCLUDED.assigned_by;

  SELECT count(*)::integer INTO v_count
  FROM public.staff_property_assignments
  WHERE user_id = p_user_id;

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_property_assignments_for_admin(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_staff_property_assignments(uuid,uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_property_assignments_for_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_property_assignments(uuid,uuid[]) TO authenticated;

-- Property registry and inventory are the first direct-table surfaces to receive
-- property-scoped staff enforcement. Public verified listings remain public.
DROP POLICY IF EXISTS "properties_public_read" ON public.properties;
CREATE POLICY "properties_public_read" ON public.properties
FOR SELECT TO anon, authenticated
USING (
  status = 'verified'
  OR auth.uid() = owner_id
  OR public.staff_can_access_property(id, 'properties.view')
);

DROP POLICY IF EXISTS "properties_owner_update" ON public.properties;
CREATE POLICY "properties_owner_update" ON public.properties
FOR UPDATE TO authenticated
USING (
  auth.uid() = owner_id
  OR public.staff_can_access_property(id, 'properties.manage')
)
WITH CHECK (
  auth.uid() = owner_id
  OR public.staff_can_access_property(id, 'properties.manage')
);

DROP POLICY IF EXISTS "properties_owner_delete" ON public.properties;
CREATE POLICY "properties_owner_delete" ON public.properties
FOR DELETE TO authenticated
USING (
  auth.uid() = owner_id
  OR public.staff_can_access_property(id, 'properties.manage')
);

DROP POLICY IF EXISTS "units_public_read" ON public.property_units;
CREATE POLICY "units_public_read" ON public.property_units
FOR SELECT TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.properties p
    WHERE p.id = property_units.property_id
      AND (p.status = 'verified' OR p.owner_id = auth.uid())
  )
  OR public.staff_can_access_property(property_id, 'units.view')
);

DROP POLICY IF EXISTS "units_owner_insert" ON public.property_units;
CREATE POLICY "units_owner_insert" ON public.property_units
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'units.manage')
);

DROP POLICY IF EXISTS "units_owner_update" ON public.property_units;
CREATE POLICY "units_owner_update" ON public.property_units
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'units.manage')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'units.manage')
);

DROP POLICY IF EXISTS "units_owner_delete" ON public.property_units;
CREATE POLICY "units_owner_delete" ON public.property_units
FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'units.manage')
);

-- Harden the existing sensitive verification and payment RPCs without changing
-- their browser contracts.
CREATE OR REPLACE FUNCTION public.admin_review_property(
  p_property_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
)
RETURNS public.properties
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_property public.properties;
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL OR NOT public.staff_can_access_property(p_property_id, 'properties.verify') THEN
    RAISE EXCEPTION 'Property verification permission required' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('verified', 'rejected', 'suspended') THEN
    RAISE EXCEPTION 'Invalid property review decision';
  END IF;
  SELECT * INTO v_property FROM public.properties WHERE id = p_property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Property not found'; END IF;
  UPDATE public.properties
  SET status = p_decision,
      verification_notes = NULLIF(trim(COALESCE(p_notes, '')), ''),
      verified_at = CASE WHEN p_decision = 'verified' THEN now() ELSE verified_at END,
      verified_by = CASE WHEN p_decision = 'verified' THEN v_actor ELSE verified_by END,
      rejected_at = CASE WHEN p_decision = 'rejected' THEN now() ELSE rejected_at END,
      rejected_by = CASE WHEN p_decision = 'rejected' THEN v_actor ELSE rejected_by END,
      updated_at = now()
  WHERE id = p_property_id
  RETURNING * INTO v_property;
  RETURN v_property;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_payment_by_admin(
  p_payment_id uuid,
  p_action text
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_payment public.payments%ROWTYPE;
  v_invoice public.rent_invoices%ROWTYPE;
  v_receipt text;
  v_new_balance numeric;
BEGIN
  IF v_user IS NULL OR NOT public.staff_has_permission('payments.manage') THEN
    RAISE EXCEPTION 'Payment management permission required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found'; END IF;
  IF NOT public.staff_can_access_property(v_payment.property_id, 'payments.manage') THEN
    RAISE EXCEPTION 'You are not assigned to this property' USING ERRCODE = '42501';
  END IF;
  IF p_action = 'verify' THEN
    IF v_payment.status NOT IN ('pending','successful') THEN RAISE EXCEPTION 'Only pending or successful payments can be verified'; END IF;
    v_receipt := COALESCE(v_payment.receipt_number, 'RCP-' || to_char(COALESCE(v_payment.created_at, now()), 'YYYYMMDD') || '-' || upper(left(replace(v_payment.id::text, '-', ''), 8)));
    UPDATE public.payments SET status='successful', verified=true, receipt_number=v_receipt, verified_at=COALESCE(verified_at,now()), updated_at=now() WHERE id=v_payment.id RETURNING * INTO v_payment;
    IF v_payment.payment_type = 'rent' AND v_payment.lease_id IS NOT NULL THEN
      SELECT * INTO v_invoice FROM public.rent_invoices WHERE lease_id=v_payment.lease_id AND tenant_id=v_payment.user_id AND balance>0 ORDER BY due_date ASC, created_at ASC LIMIT 1 FOR UPDATE;
      IF FOUND THEN
        v_new_balance := GREATEST(0, COALESCE(v_invoice.balance,0)-COALESCE(v_payment.amount,0));
        UPDATE public.rent_invoices SET balance=v_new_balance, status=CASE WHEN v_new_balance<=0 THEN 'paid' WHEN v_new_balance<amount THEN 'partially_paid' WHEN due_date<current_date THEN 'overdue' ELSE 'unpaid' END WHERE id=v_invoice.id;
      END IF;
    END IF;
    INSERT INTO public.notifications(user_id,title,message,type) VALUES(v_payment.user_id,'Payment verified — receipt available','Your '||replace(v_payment.payment_type,'_',' ')||' payment of KSh '||to_char(v_payment.amount,'FM999,999,990.00')||' has been verified. Receipt '||v_receipt||' is now available in Rent & Payments.','payment');
    RETURN v_payment;
  ELSIF p_action='reject' THEN
    IF v_payment.status <> 'pending' OR v_payment.verified THEN RAISE EXCEPTION 'Only an unverified pending payment can be rejected'; END IF;
    UPDATE public.payments SET status='failed', verified=false, updated_at=now() WHERE id=v_payment.id RETURNING * INTO v_payment;
    INSERT INTO public.notifications(user_id,title,message,type) VALUES(v_payment.user_id,'Payment requires attention','Your submitted '||replace(v_payment.payment_type,'_',' ')||' payment of KSh '||to_char(v_payment.amount,'FM999,999,990.00')||' could not be verified. Please contact HighPark Consult if you believe this is an error.','payment');
    RETURN v_payment;
  END IF;
  RAISE EXCEPTION 'Unsupported payment review action';
END;
$$;

-- KRA settings are a finance permission, while Super Admin remains unrestricted.
CREATE OR REPLACE FUNCTION public.admin_save_kra_etims_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v public.kra_etims_settings%ROWTYPE;
BEGIN
  IF NOT public.staff_has_permission('tax.manage') THEN RAISE EXCEPTION 'Tax management permission required' USING ERRCODE='42501'; END IF;
  INSERT INTO public.kra_etims_settings (id,enabled,environment,taxpayer_pin,branch_id,device_serial,default_item_code,default_item_classification_code,default_item_name,default_package_unit_code,default_quantity_unit_code,default_tax_type_code,default_tax_rate,payment_type_code,receipt_type_code,sales_type_code,registration_name,registration_id,updated_at)
  VALUES (1,COALESCE(NULLIF(p_settings->>'enabled','')::boolean,false),CASE WHEN p_settings->>'environment' IN ('sandbox','production') THEN p_settings->>'environment' ELSE 'sandbox' END,NULLIF(p_settings->>'taxpayer_pin',''),COALESCE(NULLIF(p_settings->>'branch_id',''),'00'),NULLIF(p_settings->>'device_serial',''),NULLIF(p_settings->>'default_item_code',''),NULLIF(p_settings->>'default_item_classification_code',''),COALESCE(NULLIF(p_settings->>'default_item_name',''),'Property management / rental service'),COALESCE(NULLIF(p_settings->>'default_package_unit_code',''),'NT'),COALESCE(NULLIF(p_settings->>'default_quantity_unit_code',''),'U'),NULLIF(p_settings->>'default_tax_type_code',''),CASE WHEN NULLIF(p_settings->>'default_tax_rate','') IS NULL THEN NULL ELSE (p_settings->>'default_tax_rate')::numeric END,COALESCE(NULLIF(p_settings->>'payment_type_code',''),'01'),COALESCE(NULLIF(p_settings->>'receipt_type_code',''),'S'),COALESCE(NULLIF(p_settings->>'sales_type_code',''),'N'),NULLIF(p_settings->>'registration_name',''),NULLIF(p_settings->>'registration_id',''),now())
  ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,environment=excluded.environment,taxpayer_pin=excluded.taxpayer_pin,branch_id=excluded.branch_id,device_serial=excluded.device_serial,default_item_code=excluded.default_item_code,default_item_classification_code=excluded.default_item_classification_code,default_item_name=excluded.default_item_name,default_package_unit_code=excluded.default_package_unit_code,default_quantity_unit_code=excluded.default_quantity_unit_code,default_tax_type_code=excluded.default_tax_type_code,default_tax_rate=excluded.default_tax_rate,payment_type_code=excluded.payment_type_code,receipt_type_code=excluded.receipt_type_code,sales_type_code=excluded.sales_type_code,registration_name=excluded.registration_name,registration_id=excluded.registration_id,updated_at=now();
  SELECT to_jsonb(k) INTO v FROM public.kra_etims_settings k WHERE id=1;
  RETURN v;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Property-scoped operational RLS for core staff modules. Owner/tenant access
-- remains unchanged; only the legacy broad admin branch is replaced.
DROP POLICY IF EXISTS "reservations_read" ON public.reservations;
CREATE POLICY "reservations_read" ON public.reservations FOR SELECT TO authenticated USING (
  auth.uid() = customer_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'reservations.view')
);
DROP POLICY IF EXISTS "reservations_update" ON public.reservations;
CREATE POLICY "reservations_update" ON public.reservations FOR UPDATE TO authenticated USING (
  auth.uid() = customer_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'reservations.manage')
) WITH CHECK (
  auth.uid() = customer_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'reservations.manage')
);
DROP POLICY IF EXISTS "reservations_delete" ON public.reservations;
CREATE POLICY "reservations_delete" ON public.reservations FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'reservations.manage')
);

DROP POLICY IF EXISTS "leases_read" ON public.leases;
CREATE POLICY "leases_read" ON public.leases FOR SELECT TO authenticated USING (
  auth.uid() = tenant_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'leases.view')
);
DROP POLICY IF EXISTS "leases_insert" ON public.leases;
CREATE POLICY "leases_insert" ON public.leases FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = tenant_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'leases.manage')
);
DROP POLICY IF EXISTS "leases_update" ON public.leases;
CREATE POLICY "leases_update" ON public.leases FOR UPDATE TO authenticated USING (
  auth.uid() = tenant_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'leases.manage')
) WITH CHECK (
  auth.uid() = tenant_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'leases.manage')
);

DROP POLICY IF EXISTS "payments_read" ON public.payments;
CREATE POLICY "payments_read" ON public.payments FOR SELECT TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'payments.view')
);
DROP POLICY IF EXISTS "payments_update" ON public.payments;
CREATE POLICY "payments_update" ON public.payments FOR UPDATE TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'payments.manage')
) WITH CHECK (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'payments.manage')
);

DROP POLICY IF EXISTS "maintenance_read" ON public.maintenance_requests;
CREATE POLICY "maintenance_read" ON public.maintenance_requests FOR SELECT TO authenticated USING (
  auth.uid() = tenant_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'maintenance.view')
);
DROP POLICY IF EXISTS "maintenance_update" ON public.maintenance_requests;
CREATE POLICY "maintenance_update" ON public.maintenance_requests FOR UPDATE TO authenticated USING (
  auth.uid() = tenant_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'maintenance.manage')
) WITH CHECK (
  auth.uid() = tenant_id
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'maintenance.manage')
);

DROP POLICY IF EXISTS "expenses_read" ON public.expenses;
CREATE POLICY "expenses_read" ON public.expenses FOR SELECT TO authenticated USING (
  auth.uid() = owner_id
  OR public.is_expense_property_owner(property_id)
  OR public.staff_can_access_property(property_id, 'expenses.view')
);
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;
CREATE POLICY "expenses_update" ON public.expenses FOR UPDATE TO authenticated USING (
  auth.uid() = owner_id
  OR public.is_expense_property_owner(property_id)
  OR public.staff_can_access_property(property_id, 'expenses.manage')
) WITH CHECK (
  auth.uid() = owner_id
  OR public.is_expense_property_owner(property_id)
  OR public.staff_can_access_property(property_id, 'expenses.manage')
);
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
CREATE POLICY "expenses_delete" ON public.expenses FOR DELETE TO authenticated USING (
  auth.uid() = owner_id
  OR public.is_expense_property_owner(property_id)
  OR public.staff_can_access_property(property_id, 'expenses.manage')
);

DROP POLICY IF EXISTS "tax_read" ON public.tax_records;
CREATE POLICY "tax_read" ON public.tax_records FOR SELECT TO authenticated USING (
  auth.uid() = owner_id
  OR public.staff_can_access_property(property_id, 'tax.view')
);
DROP POLICY IF EXISTS "tax_update" ON public.tax_records;
CREATE POLICY "tax_update" ON public.tax_records FOR UPDATE TO authenticated USING (
  auth.uid() = owner_id
  OR public.staff_can_access_property(property_id, 'tax.manage')
) WITH CHECK (
  auth.uid() = owner_id
  OR public.staff_can_access_property(property_id, 'tax.manage')
);

DROP POLICY IF EXISTS "documents_select_authorized" ON public.documents;
CREATE POLICY "documents_select_authorized" ON public.documents FOR SELECT TO authenticated USING (
  uploaded_by = auth.uid()
  OR tenant_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'documents.view')
);
DROP POLICY IF EXISTS "documents_update_authorized" ON public.documents;
CREATE POLICY "documents_update_authorized" ON public.documents FOR UPDATE TO authenticated USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'documents.manage')
) WITH CHECK (
  uploaded_by = auth.uid()
  OR public.staff_can_access_property(property_id, 'documents.manage')
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
);
DROP POLICY IF EXISTS "documents_delete_authorized" ON public.documents;
CREATE POLICY "documents_delete_authorized" ON public.documents FOR DELETE TO authenticated USING (
  uploaded_by = auth.uid()
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = documents.property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'documents.manage')
);

DROP POLICY IF EXISTS sale_listings_select ON public.sale_listings;
CREATE POLICY sale_listings_select ON public.sale_listings FOR SELECT TO authenticated USING (
  listing_status = 'active'
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = sale_listings.property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'sales.view')
);
DROP POLICY IF EXISTS sale_listings_manage ON public.sale_listings;
CREATE POLICY sale_listings_manage ON public.sale_listings FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = sale_listings.property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'sales.manage')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = sale_listings.property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'sales.manage')
);

NOTIFY pgrst, 'reload schema';

-- Preserve the existing paginated admin screens while enforcing role/scope in
-- their SECURITY DEFINER RPCs too.
CREATE OR REPLACE FUNCTION public.get_managed_expenses_page(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_staff boolean := false; v_page integer := GREATEST(1,p_page); v_size integer := LEAST(100,GREATEST(1,p_page_size)); v_offset integer := (v_page-1)*v_size; v_total bigint; v_amount numeric;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  v_staff := public.staff_has_permission('expenses.view');
  IF NOT v_staff AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND role IN ('owner','agent')) THEN RAISE EXCEPTION 'You are not allowed to view expenses'; END IF;
  SELECT count(*), coalesce(sum(e.amount),0) INTO v_total,v_amount FROM public.expenses e JOIN public.properties pr ON pr.id=e.property_id WHERE pr.owner_id=v_user OR e.owner_id=v_user OR public.staff_can_access_property(e.property_id,'expenses.view');
  RETURN jsonb_build_object('total_count',v_total,'total_amount',v_amount,'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'property_id',x.property_id,'owner_id',x.owner_id,'category',x.category,'amount',x.amount,'expense_date',x.expense_date,'vendor',x.vendor,'description',x.description,'receipt_url',x.receipt_url,'payment_method',x.payment_method,'created_at',x.created_at,'property_name',x.property_name) ORDER BY x.expense_date DESC,x.created_at DESC) FROM (SELECT e.*,coalesce(pr.name,'Property') AS property_name FROM public.expenses e JOIN public.properties pr ON pr.id=e.property_id WHERE pr.owner_id=v_user OR e.owner_id=v_user OR public.staff_can_access_property(e.property_id,'expenses.view') ORDER BY e.expense_date DESC,e.created_at DESC OFFSET v_offset LIMIT v_size) x),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.get_managed_expenses_page(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_expenses_page(integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_managed_maintenance_page(p_page integer DEFAULT 1, p_page_size integer DEFAULT 20)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_staff boolean := false; v_page integer := GREATEST(1,p_page); v_size integer := LEAST(100,GREATEST(1,p_page_size)); v_offset integer := (v_page-1)*v_size; v_total bigint;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  v_staff := public.staff_has_permission('maintenance.view');
  IF NOT v_staff AND NOT EXISTS(SELECT 1 FROM public.profiles WHERE id=v_user AND role IN ('owner','agent')) THEN RAISE EXCEPTION 'You are not allowed to view maintenance requests'; END IF;
  SELECT count(*) INTO v_total FROM public.maintenance_requests mr JOIN public.properties pr ON pr.id=mr.property_id WHERE pr.owner_id=v_user OR public.staff_can_access_property(mr.property_id,'maintenance.view');
  RETURN jsonb_build_object('total_count',v_total,'rows',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',x.id,'tenant_id',x.tenant_id,'property_id',x.property_id,'unit_id',x.unit_id,'category',x.category,'description',x.description,'priority',x.priority,'status',x.status,'created_at',x.created_at,'updated_at',x.updated_at,'property_name',x.property_name,'unit_number',x.unit_number,'tenant_name',x.tenant_name,'tenant_phone',x.tenant_phone) ORDER BY x.created_at DESC) FROM (SELECT mr.*,coalesce(pr.name,'Property') AS property_name,coalesce(pu.unit_number,'—') AS unit_number,p.full_name AS tenant_name,p.phone AS tenant_phone FROM public.maintenance_requests mr JOIN public.properties pr ON pr.id=mr.property_id LEFT JOIN public.property_units pu ON pu.id=mr.unit_id LEFT JOIN public.profiles p ON p.id=mr.tenant_id WHERE pr.owner_id=v_user OR public.staff_can_access_property(mr.property_id,'maintenance.view') ORDER BY mr.created_at DESC OFFSET v_offset LIMIT v_size) x),'[]'::jsonb));
END; $$;
REVOKE ALL ON FUNCTION public.get_managed_maintenance_page(integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_maintenance_page(integer,integer) TO authenticated;

NOTIFY pgrst, 'reload schema';

CREATE OR REPLACE FUNCTION public.get_managed_expenses()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user uuid := auth.uid(); v_staff boolean := false;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'You must be signed in'; END IF;
  v_staff := public.staff_has_permission('expenses.view');
  IF NOT v_staff AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id=v_user AND role IN ('owner','agent')) THEN RAISE EXCEPTION 'You are not allowed to view expenses'; END IF;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',e.id,'property_id',e.property_id,'owner_id',e.owner_id,'category',e.category,'amount',e.amount,'expense_date',e.expense_date,'vendor',e.vendor,'description',e.description,'receipt_url',e.receipt_url,'payment_method',e.payment_method,'created_at',e.created_at,'property_name',COALESCE(pr.name,'Property')) ORDER BY e.expense_date DESC,e.created_at DESC) FROM public.expenses e JOIN public.properties pr ON pr.id=e.property_id WHERE pr.owner_id=v_user OR e.owner_id=v_user OR public.staff_can_access_property(e.property_id,'expenses.view')),'[]'::jsonb);
END; $$;
REVOKE ALL ON FUNCTION public.get_managed_expenses() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_expenses() TO authenticated;

NOTIFY pgrst, 'reload schema';
