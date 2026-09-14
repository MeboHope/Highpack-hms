# Phase 36 — Staff Identity, Admin Accounts & RBAC Foundation

## What this phase adds

- Individual internal staff accounts instead of shared administrator credentials.
- `is_super_admin` flag on profiles.
- Five production-oriented operational staff roles:
  - Property Manager
  - Finance Officer
  - Sales & Lettings Officer
  - Compliance & Verification Officer
  - Customer Support Officer
- Server-side `staff_roles`, `staff_members` and `staff_property_assignments` tables.
- Super Admin bootstrap RPC for the first existing administrator.
- Super Admin-only staff invitation, suspension/reactivation and role reassignment through the `staff-admin` Edge Function.
- Staff access inspection through `my_staff_access()` and `staff_members_for_admin()` RPCs.
- Staff administration page at `#/admin/staff`.
- Staff invitation flow uses Supabase Auth invitation email; the staff member creates their own password.
- Invitation callback support in the existing password/reset routing.
- Staff lifecycle actions are written to the existing audit log.

## Important compatibility decision

Existing `profiles.role='admin'` accounts remain full administrators in this phase so the current HighPark PMS cannot accidentally lose access to existing modules. The new operational role is stored separately in `staff_members` and is the foundation for progressively enforcing module-level permissions and portfolio/property scope in the next security phase.

This is intentional: changing every existing RLS policy from `role='admin'` to a new permission engine in one migration would create unnecessary production risk.

## Supabase deployment

From the project root:

```powershell
supabase link --project-ref xhcsanlaslsilqnfanrk
supabase db push --include-all
supabase functions deploy staff-admin
```

The `staff-admin` function requires the normal Supabase `SUPABASE_SERVICE_ROLE_KEY` runtime secret, which is automatically available to deployed Supabase Edge Functions. No service-role key belongs in the React `.env` file.

If your production Auth redirect configuration requires an explicit site URL, set the `SITE_URL` Edge Function secret to the production HighPark website origin.

## First-time setup

1. Sign in using the existing administrator account.
2. Open **Admin → Staff & Access**.
3. If no Super Admin exists, click **Become Super Admin** once.
4. Click **Invite staff**.
5. Enter the employee's name, work email, phone (optional), and operational role.
6. The employee receives the Supabase invitation email and creates their own password.
7. Use the Staff & Access page to change their operational role or suspend/reactivate their staff access.

## Security model

- Super Admin management actions are validated server-side by the Edge Function.
- The service-role key is never exposed to the browser.
- Staff accounts remain separate Auth identities.
- Existing administrator RLS remains compatible.
- Staff role/permission definitions are database-backed rather than hard-coded only in React.
- Property assignment storage is included for the next phase's portfolio-scoped authorization.

## Next security phase

The next phase should progressively enforce the stored permissions at the database/RPC layer for each module, then apply property/portfolio assignment scope. The UI should never be the sole security boundary.
