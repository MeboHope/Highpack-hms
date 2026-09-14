# Phase 37 V6 — Staff Admin Service-Role Profiles Grant Repair

## What this fixes

The V5 Edge Function correctly validates the browser access token with the Supabase service-role client, but the deployed database returned:

`Super Admin profile lookup failed: permission denied for table profiles`

That means the trusted Edge Function client reached the database, but the database role did not have table-level privileges on `public.profiles`.

## V6 changes

- Adds migration `20260914150000_0059_staff_admin_service_role_profiles_grants.sql`.
- Grants the `service_role` only the table operations required by `staff-admin`:
  - `profiles`: SELECT, UPDATE
  - `staff_roles`: SELECT
  - `staff_members`: SELECT, INSERT, UPDATE
  - `staff_property_assignments`: SELECT, INSERT, UPDATE, DELETE
  - `audit_logs`: INSERT
- Grants `USAGE` on the public schema to `service_role`.
- Removes the unnecessary `SUPABASE_ANON_KEY` requirement from the Edge Function. V6 uses the service-role client for trusted server-side identity and data operations.
- No browser service-role key is exposed.
- No changes are made to existing Owner/Tenant/Customer/Admin functionality.

## Deploy

From the V6 project folder:

```powershell
npm ci
npm run build
npm run lint
supabase link --project-ref xhcsanlaslsilqnfanrk
supabase db push --include-all
supabase functions deploy staff-admin
```

The Docker warning from the Supabase CLI is not a blocker for Edge Function deployment when the function upload/deployment completes successfully.

## Test

1. Sign in as the existing Super Admin.
2. Open **Admin → Staff & Access**.
3. Invite a staff member.
4. The previous `permission denied for table profiles` error should no longer occur.
5. If a later operation fails, the V6 diagnostics will identify the exact operation instead of showing a generic non-2xx error.
