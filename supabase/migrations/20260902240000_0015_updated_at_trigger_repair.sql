/* HighPark Consult — repair for the generic updated_at trigger.
   Safe to run against an existing database where an older migration attached
   set_updated_at to tables that do not have an updated_at column.
*/

DO $$
DECLARE
  t text;
BEGIN
  -- These tables do not have updated_at and must not use set_updated_at.
  FOREACH t IN ARRAY ARRAY['rent_invoices','expenses','tax_records','owner_payouts','notifications','viewing_appointments'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', t);
  END LOOP;

  -- Ensure the trigger exists only where updated_at is present.
  FOREACH t IN ARRAY ARRAY['profiles','properties','property_units','reservations','payments','leases','maintenance_requests'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I;', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
