-- Phase 50 — financial and sensitive-write hardening.
-- Owner payout records are financial settlement data. Browser clients may
-- read their own payouts, while creation and mutation are kept behind trusted
-- server-side workflows. This removes the legacy owner self-write path.

DROP POLICY IF EXISTS "payouts_insert" ON public.owner_payouts;
DROP POLICY IF EXISTS "payouts_update" ON public.owner_payouts;
DROP POLICY IF EXISTS payouts_client_insert ON public.owner_payouts;
DROP POLICY IF EXISTS payouts_client_update ON public.owner_payouts;
DROP POLICY IF EXISTS payouts_client_delete ON public.owner_payouts;

REVOKE INSERT, UPDATE, DELETE ON public.owner_payouts FROM authenticated;

-- Keep owner visibility, and allow authorized finance/reporting staff to read
-- settlement data without exposing it to ordinary authenticated users.
DROP POLICY IF EXISTS "payouts_read" ON public.owner_payouts;
DROP POLICY IF EXISTS payouts_read ON public.owner_payouts;
CREATE POLICY payouts_read ON public.owner_payouts
FOR SELECT TO authenticated
USING (
  auth.uid() = owner_id
  OR public.staff_has_permission('reports.view')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
      AND COALESCE(p.is_super_admin, false) = true
  )
);

CREATE INDEX IF NOT EXISTS idx_owner_payouts_property_period
  ON public.owner_payouts(property_id, period);

NOTIFY pgrst, 'reload schema';
