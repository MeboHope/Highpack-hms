# HighPark Consult — Data Integrity Fix 0012

This release addresses the recurring issue where populated counters were displayed as `0`, reservation confirmation showed success while the database remained `pending`, and expense records could be written through the server workflow but not reliably reflected in the UI.

## 1. Apply the migration

In the Supabase SQL Editor, run:

`supabase/migrations/20260902210000_0012_dashboard_counts_reservation_expense_repairs.sql`

This migration adds:

- `get_public_site_stats()` — secure aggregate statistics for the public website and About page.
- `get_dashboard_property_performance(period)` — secure owner/admin property performance aggregates.
- `update_reservation_status_by_manager(reservation_id,status)` — transactional owner/admin reservation confirmation/cancellation.
- A repaired `create_owner_expense(...)` implementation that attaches an expense to the property's real owner.

## 2. Verify the public counters

After migration, these are driven from verified catalog/database data rather than RLS-sensitive browser count queries:

- Verified Properties
- Available Homes
- Counties Covered
- Customer Accounts
- Verified Rent Processed

The Home page derives the first three directly from the same public property catalog used to render listings. The About page uses the catalog plus `get_public_site_stats()`.

## 3. Verify reservation confirmation

The owner dashboard now calls `update_reservation_status_by_manager` instead of directly updating `reservations` from the browser.

Expected flow:

`pending → confirmed → converted`

After confirmation, the reservation list is reloaded from Supabase. The lease conversion function then accepts the reservation because its persisted status is genuinely `confirmed`.

## 4. Verify expenses

The owner expense form calls `create_owner_expense`. The UI only shows success after the RPC returns without an error, then reloads the expense ledger.

## 5. Dashboard data

Owner and Admin dashboard property performance now uses `get_dashboard_property_performance()` so RLS cannot silently turn valid aggregate data into zeroes.

## Important

Do not use `npm audit fix --force` automatically on this release. Your current Vite/esbuild audit warning proposes a major Vite upgrade. Test dependency upgrades separately before production deployment.
