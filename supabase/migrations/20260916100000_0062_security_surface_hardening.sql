-- Phase 47: security surface hardening.
-- Closes legacy broad `role = admin` policies left on short-stay, sales,
-- settings and KRA surfaces. MFA remains mandatory for staff mutations.

-- Short-stay listings: public active listings remain public; management is
-- limited to the property owner or staff with the relevant property scope.
DROP POLICY IF EXISTS short_stay_listings_admin ON public.short_stay_listings;
DROP POLICY IF EXISTS short_stay_listings_owner ON public.short_stay_listings;
DROP POLICY IF EXISTS short_stay_public_read ON public.short_stay_listings;
DROP POLICY IF EXISTS short_stay_owner_insert ON public.short_stay_listings;
DROP POLICY IF EXISTS short_stay_owner_update ON public.short_stay_listings;
DROP POLICY IF EXISTS short_stay_owner_delete ON public.short_stay_listings;
CREATE POLICY short_stay_listings_read ON public.short_stay_listings
FOR SELECT TO anon, authenticated USING (
  listing_status = 'active'
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.view')
);
CREATE POLICY short_stay_listings_insert ON public.short_stay_listings
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.manage')
);
CREATE POLICY short_stay_listings_update ON public.short_stay_listings
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.manage')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.manage')
);
CREATE POLICY short_stay_listings_delete ON public.short_stay_listings
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.manage')
);

-- Short-stay bookings: guests can read their own booking and create a booking
-- for an active listing; only owners/staff can alter operational booking data.
DROP POLICY IF EXISTS short_stay_bookings_admin ON public.short_stay_bookings;
DROP POLICY IF EXISTS short_stay_bookings_owner ON public.short_stay_bookings;
DROP POLICY IF EXISTS short_stay_bookings_guest ON public.short_stay_bookings;
DROP POLICY IF EXISTS short_stay_bookings_read ON public.short_stay_bookings;
DROP POLICY IF EXISTS short_stay_bookings_guest_insert ON public.short_stay_bookings;
DROP POLICY IF EXISTS short_stay_bookings_manage ON public.short_stay_bookings;
DROP POLICY IF EXISTS short_stay_bookings_delete ON public.short_stay_bookings;
CREATE POLICY short_stay_bookings_read ON public.short_stay_bookings
FOR SELECT TO authenticated USING (
  guest_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.view')
);
CREATE POLICY short_stay_bookings_insert ON public.short_stay_bookings
FOR INSERT TO authenticated WITH CHECK (
  guest_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.short_stay_listings l
    WHERE l.id = listing_id AND l.listing_status = 'active'
      AND (property_id IS NULL OR l.property_id = short_stay_bookings.property_id)
  )
);
CREATE POLICY short_stay_bookings_manage ON public.short_stay_bookings
FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.manage')
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.manage')
);
CREATE POLICY short_stay_bookings_delete ON public.short_stay_bookings
FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.properties p WHERE p.id = property_id AND p.owner_id = auth.uid())
  OR public.staff_can_access_property(property_id, 'shortstay.manage')
);

-- Rate calendars and turnover operations are never guest-writable.
DROP POLICY IF EXISTS short_stay_rates_admin ON public.short_stay_rate_calendar;
DROP POLICY IF EXISTS short_stay_rates_owner ON public.short_stay_rate_calendar;
CREATE POLICY short_stay_rates_manage ON public.short_stay_rate_calendar
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id
    WHERE l.id = listing_id AND (
      p.owner_id = auth.uid() OR public.staff_can_access_property(l.property_id, 'shortstay.manage')
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id
    WHERE l.id = listing_id AND (
      p.owner_id = auth.uid() OR public.staff_can_access_property(l.property_id, 'shortstay.manage')
    )
  )
);
DROP POLICY IF EXISTS short_stay_turnovers_admin ON public.short_stay_turnovers;
DROP POLICY IF EXISTS short_stay_turnovers_owner ON public.short_stay_turnovers;
CREATE POLICY short_stay_turnovers_manage ON public.short_stay_turnovers
FOR ALL TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id
    WHERE l.id = listing_id AND (
      p.owner_id = auth.uid() OR public.staff_can_access_property(l.property_id, 'shortstay.manage')
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.short_stay_listings l JOIN public.properties p ON p.id = l.property_id
    WHERE l.id = listing_id AND (
      p.owner_id = auth.uid() OR public.staff_can_access_property(l.property_id, 'shortstay.manage')
    )
  )
);

-- Sales offers/transactions: remove the legacy broad admin bypass. Buyers may
-- submit their own offers/read their own transaction records; owners and staff
-- operate only within their assigned property scope.
DROP POLICY IF EXISTS sale_offers_select ON public.sale_offers;
DROP POLICY IF EXISTS sale_offers_insert ON public.sale_offers;
DROP POLICY IF EXISTS sale_offers_manage ON public.sale_offers;
CREATE POLICY sale_offers_select ON public.sale_offers FOR SELECT TO authenticated USING (
  buyer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sale_listings sl JOIN public.properties p ON p.id = sl.property_id WHERE sl.id = sale_listing_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.sale_listings sl WHERE sl.id = sale_listing_id AND public.staff_can_access_property(sl.property_id, 'sales.view'))
);
CREATE POLICY sale_offers_insert ON public.sale_offers FOR INSERT TO authenticated WITH CHECK (
  buyer_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.sale_listings sl WHERE sl.id = sale_listing_id AND sl.listing_status = 'active')
);
CREATE POLICY sale_offers_manage ON public.sale_offers FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sale_listings sl JOIN public.properties p ON p.id = sl.property_id WHERE sl.id = sale_listing_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.sale_listings sl WHERE sl.id = sale_listing_id AND public.staff_can_access_property(sl.property_id, 'sales.manage'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.sale_listings sl JOIN public.properties p ON p.id = sl.property_id WHERE sl.id = sale_listing_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.sale_listings sl WHERE sl.id = sale_listing_id AND public.staff_can_access_property(sl.property_id, 'sales.manage'))
);
DROP POLICY IF EXISTS sale_transactions_select ON public.sale_transactions;
DROP POLICY IF EXISTS sale_transactions_manage ON public.sale_transactions;
CREATE POLICY sale_transactions_select ON public.sale_transactions FOR SELECT TO authenticated USING (
  buyer_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.sale_listings sl JOIN public.properties p ON p.id = sl.property_id WHERE sl.id = sale_listing_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.sale_listings sl WHERE sl.id = sale_listing_id AND public.staff_can_access_property(sl.property_id, 'sales.view'))
);
CREATE POLICY sale_transactions_manage ON public.sale_transactions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.sale_listings sl JOIN public.properties p ON p.id = sl.property_id WHERE sl.id = sale_listing_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.sale_listings sl WHERE sl.id = sale_listing_id AND public.staff_can_access_property(sl.property_id, 'sales.manage'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.sale_listings sl JOIN public.properties p ON p.id = sl.property_id WHERE sl.id = sale_listing_id AND p.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.sale_listings sl WHERE sl.id = sale_listing_id AND public.staff_can_access_property(sl.property_id, 'sales.manage'))
);

-- System settings are platform-wide controls. Only Super Admin can mutate
-- them, and Phase 46 MFA enforcement applies to the staff check.
DROP POLICY IF EXISTS "settings_admin_write" ON public.system_settings;
CREATE POLICY "settings_super_admin_write" ON public.system_settings
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_super_admin = true)
  AND public.staff_mfa_satisfied()
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.is_super_admin = true)
  AND public.staff_mfa_satisfied()
);

-- KRA/eTIMS settings are sensitive credentials/configuration. Reading requires
-- the tax permission; writing additionally requires an AAL2 session.
CREATE OR REPLACE FUNCTION public.get_admin_kra_etims_settings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.staff_has_permission('tax.view') THEN
    RAISE EXCEPTION 'Tax permission required' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(k) INTO v FROM public.kra_etims_settings k WHERE id = 1;
  RETURN COALESCE(v, jsonb_build_object('id', 1));
END;
$$;

CREATE OR REPLACE FUNCTION public.save_admin_kra_etims_settings(p_settings jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.kra_etims_settings%ROWTYPE;
BEGIN
  IF NOT public.staff_has_permission('tax.manage') THEN
    RAISE EXCEPTION 'Tax management permission required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.staff_mfa_satisfied() THEN
    RAISE EXCEPTION 'Multi-factor authentication is required for this sensitive action' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.kra_etims_settings (
    id, enabled, environment, taxpayer_pin, branch_id, device_serial,
    default_item_code, default_item_classification_code, default_item_name,
    default_package_unit_code, default_quantity_unit_code, default_tax_type_code,
    default_tax_rate, payment_type_code, receipt_type_code, sales_type_code,
    registration_name, registration_id, updated_at
  ) VALUES (
    1, COALESCE((p_settings->>'enabled')::boolean, false), COALESCE(p_settings->>'environment','sandbox'),
    NULLIF(p_settings->>'taxpayer_pin',''), COALESCE(NULLIF(p_settings->>'branch_id',''),'00'), NULLIF(p_settings->>'device_serial',''),
    NULLIF(p_settings->>'default_item_code',''), NULLIF(p_settings->>'default_item_classification_code',''),
    COALESCE(NULLIF(p_settings->>'default_item_name',''),'Property management / rental service'),
    COALESCE(NULLIF(p_settings->>'default_package_unit_code',''),'NT'), COALESCE(NULLIF(p_settings->>'default_quantity_unit_code',''),'U'),
    NULLIF(p_settings->>'default_tax_type_code',''),
    CASE WHEN NULLIF(p_settings->>'default_tax_rate','') IS NULL THEN NULL ELSE (p_settings->>'default_tax_rate')::numeric END,
    COALESCE(NULLIF(p_settings->>'payment_type_code',''),'01'), COALESCE(NULLIF(p_settings->>'receipt_type_code',''),'S'),
    COALESCE(NULLIF(p_settings->>'sales_type_code',''),'N'), NULLIF(p_settings->>'registration_name',''), NULLIF(p_settings->>'registration_id',''), now()
  ) ON CONFLICT (id) DO UPDATE SET
    enabled=excluded.enabled, environment=excluded.environment, taxpayer_pin=excluded.taxpayer_pin,
    branch_id=excluded.branch_id, device_serial=excluded.device_serial, default_item_code=excluded.default_item_code,
    default_item_classification_code=excluded.default_item_classification_code, default_item_name=excluded.default_item_name,
    default_package_unit_code=excluded.default_package_unit_code, default_quantity_unit_code=excluded.default_quantity_unit_code,
    default_tax_type_code=excluded.default_tax_type_code, default_tax_rate=excluded.default_tax_rate,
    payment_type_code=excluded.payment_type_code, receipt_type_code=excluded.receipt_type_code, sales_type_code=excluded.sales_type_code,
    registration_name=excluded.registration_name, registration_id=excluded.registration_id, updated_at=now();
  SELECT to_jsonb(k) INTO v FROM public.kra_etims_settings k WHERE id=1;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_kra_etims_settings() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_admin_kra_etims_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_admin_kra_etims_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_admin_kra_etims_settings(jsonb) TO authenticated;

-- Secure the short-stay and sales dashboard SECURITY DEFINER functions too.
CREATE OR REPLACE FUNCTION public.get_short_stay_dashboard(p_owner_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_total integer; v_active integer; v_bookings integer; v_revenue numeric;
BEGIN
  IF NOT (public.staff_has_permission('shortstay.view') OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id=auth.uid() AND p.role IN ('owner','agent'))) THEN
    RAISE EXCEPTION 'Short-stay permission required' USING ERRCODE='42501';
  END IF;
  SELECT count(*) INTO v_total FROM short_stay_listings l JOIN properties p ON p.id=l.property_id
    WHERE (p.owner_id=auth.uid() OR public.staff_can_access_property(p.id,'shortstay.view'))
      AND (p_owner_id IS NULL OR p.owner_id=p_owner_id);
  SELECT count(*) INTO v_active FROM short_stay_listings l JOIN properties p ON p.id=l.property_id
    WHERE l.listing_status='active' AND (p.owner_id=auth.uid() OR public.staff_can_access_property(p.id,'shortstay.view'))
      AND (p_owner_id IS NULL OR p.owner_id=p_owner_id);
  SELECT count(*) INTO v_bookings FROM short_stay_bookings b JOIN properties p ON p.id=b.property_id
    WHERE b.status IN ('pending','confirmed','checked_in') AND (p.owner_id=auth.uid() OR public.staff_can_access_property(p.id,'shortstay.view'))
      AND (p_owner_id IS NULL OR p.owner_id=p_owner_id);
  SELECT coalesce(sum(b.total_amount),0) INTO v_revenue FROM short_stay_bookings b JOIN properties p ON p.id=b.property_id
    WHERE b.status IN ('confirmed','checked_in','checked_out') AND b.created_at >= date_trunc('month', current_date)
      AND (p.owner_id=auth.uid() OR public.staff_can_access_property(p.id,'shortstay.view'))
      AND (p_owner_id IS NULL OR p.owner_id=p_owner_id);
  RETURN jsonb_build_object('listings',v_total,'active_listings',v_active,'upcoming_bookings',v_bookings,'month_revenue',v_revenue);
END;
$$;

REVOKE ALL ON FUNCTION public.get_short_stay_dashboard(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_sale_operations_dashboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_short_stay_dashboard(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sale_operations_dashboard() TO authenticated;

NOTIFY pgrst, 'reload schema';
