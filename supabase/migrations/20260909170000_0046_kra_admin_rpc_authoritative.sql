/* Phase 22 — authoritative KRA settings RPC.
   Avoids stale/overloaded PostgREST function signatures that previously caused
   the complete JSON settings object to be coerced into an integer.
*/

DROP FUNCTION IF EXISTS public.save_admin_kra_etims_settings(integer);
DROP FUNCTION IF EXISTS public.save_admin_kra_etims_settings(text);
DROP FUNCTION IF EXISTS public.save_admin_kra_etims_settings(json);

CREATE OR REPLACE FUNCTION public.admin_save_kra_etims_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v public.kra_etims_settings%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  INSERT INTO public.kra_etims_settings (
    id, enabled, environment, taxpayer_pin, branch_id, device_serial,
    default_item_code, default_item_classification_code, default_item_name,
    default_package_unit_code, default_quantity_unit_code, default_tax_type_code,
    default_tax_rate, payment_type_code, receipt_type_code, sales_type_code,
    registration_name, registration_id, updated_at
  ) VALUES (
    1,
    COALESCE(NULLIF(p_settings->>'enabled','')::boolean, false),
    CASE WHEN p_settings->>'environment' IN ('sandbox','production') THEN p_settings->>'environment' ELSE 'sandbox' END,
    NULLIF(p_settings->>'taxpayer_pin',''),
    COALESCE(NULLIF(p_settings->>'branch_id',''), '00'),
    NULLIF(p_settings->>'device_serial',''),
    NULLIF(p_settings->>'default_item_code',''),
    NULLIF(p_settings->>'default_item_classification_code',''),
    COALESCE(NULLIF(p_settings->>'default_item_name',''), 'Property management / rental service'),
    COALESCE(NULLIF(p_settings->>'default_package_unit_code',''), 'NT'),
    COALESCE(NULLIF(p_settings->>'default_quantity_unit_code',''), 'U'),
    NULLIF(p_settings->>'default_tax_type_code',''),
    CASE WHEN NULLIF(p_settings->>'default_tax_rate','') IS NULL THEN NULL ELSE (p_settings->>'default_tax_rate')::numeric END,
    COALESCE(NULLIF(p_settings->>'payment_type_code',''), '01'),
    COALESCE(NULLIF(p_settings->>'receipt_type_code',''), 'S'),
    COALESCE(NULLIF(p_settings->>'sales_type_code',''), 'N'),
    NULLIF(p_settings->>'registration_name',''),
    NULLIF(p_settings->>'registration_id',''),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    enabled = excluded.enabled,
    environment = excluded.environment,
    taxpayer_pin = excluded.taxpayer_pin,
    branch_id = excluded.branch_id,
    device_serial = excluded.device_serial,
    default_item_code = excluded.default_item_code,
    default_item_classification_code = excluded.default_item_classification_code,
    default_item_name = excluded.default_item_name,
    default_package_unit_code = excluded.default_package_unit_code,
    default_quantity_unit_code = excluded.default_quantity_unit_code,
    default_tax_type_code = excluded.default_tax_type_code,
    default_tax_rate = excluded.default_tax_rate,
    payment_type_code = excluded.payment_type_code,
    receipt_type_code = excluded.receipt_type_code,
    sales_type_code = excluded.sales_type_code,
    registration_name = excluded.registration_name,
    registration_id = excluded.registration_id,
    updated_at = now();

  SELECT to_jsonb(k) INTO v FROM public.kra_etims_settings k WHERE id = 1;
  RETURN v;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_save_kra_etims_settings(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_save_kra_etims_settings(jsonb) TO authenticated;
NOTIFY pgrst, 'reload schema';
