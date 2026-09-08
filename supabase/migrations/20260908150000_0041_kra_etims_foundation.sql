ALTER TABLE public.rent_invoices
  ADD COLUMN IF NOT EXISTS kra_submission_status text NOT NULL DEFAULT 'not_submitted' CHECK (kra_submission_status IN ('not_submitted','queued','submitted','failed','cancelled')),
  ADD COLUMN IF NOT EXISTS kra_invoice_number bigint,
  ADD COLUMN IF NOT EXISTS kra_receipt_number bigint,
  ADD COLUMN IF NOT EXISTS kra_internal_data text,
  ADD COLUMN IF NOT EXISTS kra_receipt_signature text,
  ADD COLUMN IF NOT EXISTS kra_sdc_datetime text,
  ADD COLUMN IF NOT EXISTS kra_result_code text,
  ADD COLUMN IF NOT EXISTS kra_result_message text,
  ADD COLUMN IF NOT EXISTS kra_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS kra_response jsonb,
  ADD COLUMN IF NOT EXISTS kra_last_error text;
CREATE INDEX IF NOT EXISTS idx_rent_invoices_kra_status ON public.rent_invoices(kra_submission_status);
CREATE TABLE IF NOT EXISTS public.kra_etims_settings (
 id integer PRIMARY KEY DEFAULT 1 CHECK (id=1), enabled boolean NOT NULL DEFAULT false,
 environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
 taxpayer_pin text, branch_id text NOT NULL DEFAULT '00', device_serial text,
 default_item_code text, default_item_classification_code text,
 default_item_name text NOT NULL DEFAULT 'Property management / rental service',
 default_package_unit_code text NOT NULL DEFAULT 'NT', default_quantity_unit_code text NOT NULL DEFAULT 'U',
 default_tax_type_code text, default_tax_rate numeric(7,2), payment_type_code text NOT NULL DEFAULT '01',
 receipt_type_code text NOT NULL DEFAULT 'S', sales_type_code text NOT NULL DEFAULT 'N',
 registration_name text, registration_id text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.kra_etims_settings(id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.kra_etims_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kra_etims_settings_admin_select ON public.kra_etims_settings;
CREATE POLICY kra_etims_settings_admin_select ON public.kra_etims_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
DROP POLICY IF EXISTS kra_etims_settings_admin_modify ON public.kra_etims_settings;
CREATE POLICY kra_etims_settings_admin_modify ON public.kra_etims_settings FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin')) WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
CREATE TABLE IF NOT EXISTS public.kra_etims_submission_log (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), rent_invoice_id uuid NOT NULL REFERENCES public.rent_invoices(id) ON DELETE CASCADE,
 submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL, environment text NOT NULL, endpoint text NOT NULL,
 request_payload jsonb, response_payload jsonb, result_code text, result_message text, success boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kra_submission_log_invoice ON public.kra_etims_submission_log(rent_invoice_id, created_at DESC);
ALTER TABLE public.kra_etims_submission_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS kra_etims_submission_log_admin_select ON public.kra_etims_submission_log;
CREATE POLICY kra_etims_submission_log_admin_select ON public.kra_etims_submission_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id=auth.uid() AND role='admin'));
NOTIFY pgrst, 'reload schema';
