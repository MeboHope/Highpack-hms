# HighPark Consult PMS — Premium UI + Payment/Expense Final Fix

This build starts from `HighPark-Consult-PMS-FINAL-DATA-INTEGRITY-FIX.zip` and keeps the existing operational/data-integrity work.

## Included

- Premium admin presentation for Properties, Users, Units and Reservations.
- Search/filter controls and clearer status/action treatments.
- Admin reservation confirmation/cancellation uses the existing transactional manager RPC.
- Admin Payments now has an explicit **Verify & issue receipt** action for pending submissions.
- Payment verification is server-controlled through migration `0014`.
- Verification creates a unique receipt number, timestamps verification, settles the related rent invoice, and sends the tenant a notification that the receipt is available.
- Rejection is also server-controlled and notifies the tenant.
- Tenant Rent & Payments now shows downloadable rent invoices and downloadable verified payment receipts.
- Owner Payments now exposes receipts for verified payments.
- Owner expense recording now validates the amount, returns the saved row, immediately inserts it into the visible ledger, and reloads the server ledger. If PostgREST returns no composite row because of a stale schema cache, it confirms the saved record directly from `expenses` before reporting failure.
- Owner expense form now exposes the payment method field.
- Shared dashboard shell, cards, buttons, inputs and tables received a more premium visual treatment.
- Fixed the duplicate mobile navigation `<Link>` corruption present in the source package.

## Supabase step

Apply the new migration:

`supabase/migrations/20260903090000_0014_payment_review_and_receipts.sql`

This migration adds `receipt_number` and `verified_at` to `payments`, `invoice_number` to `rent_invoices`, and creates `review_payment_by_admin(uuid,text)`.

The browser never directly changes successful/verified payment state.
