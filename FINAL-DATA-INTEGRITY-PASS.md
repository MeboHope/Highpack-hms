# HighPark Consult — Final Data Integrity Pass

This build keeps the latest HighPark dashboard styling while repairing the live-data paths behind the dashboard and management screens.

## What was repaired

### Public website counters
- Verified property count is sourced from verified database records.
- Available-home count is sourced from verified properties and available units.
- County count is derived from verified properties.
- If the public statistics RPC is stale/unavailable, the homepage falls back to the same verified public catalog used by the property cards instead of showing false zeroes.

### Admin dashboard
- Property, unit, occupancy, reserved-unit and active-tenant cards use live portfolio data.
- Property-by-property performance cards are restored.
- Added dedicated **Expenses** and **Maintenance** admin screens.
- Added dashboard previews for open maintenance requests and recorded expenses.

### Owner dashboard
- Property-by-property performance is restored from live property/unit/lease/payment/tax records.
- A fallback table query prevents a stale dashboard RPC from turning a populated portfolio into zeroes.
- Expense ledger now loads by the owner's actual property IDs, so expenses recorded by an administrator still appear in the owner's ledger.
- Maintenance/service requests are loaded through a manager-safe read path and can be status-updated transactionally.

### Tenant lease + payments
- Activating a lease now creates the first rent/service invoice automatically.
- Existing active leases without a first invoice are backfilled by the migration.
- Signing a lease transactionally prepares the first invoice.
- Tenant dashboard now shows:
  - Move-in amount due
  - Rent/service balance
  - Security-deposit balance
  - Verified amount paid
  - Lease value over the signed term
- Tenant **Rent & Payments** page now has a dedicated payment-centre layout and controlled security-deposit payment intent.

### Tenant maintenance
- Tenant maintenance/service requests are created through a server-side RPC tied to an active lease or current reservation.
- Owner/admin status changes notify the tenant.

## Required database step

The frontend changes alone cannot create the new server-side functions. Apply the included migration to the same Supabase project used by `VITE_SUPABASE_URL`:

```powershell
supabase db push
```

If the project is not linked yet, link it first with the Supabase CLI and then run `supabase db push`.

The migration to apply is:

`supabase/migrations/20260902230000_0013_operational_integrity_and_tenant_finance.sql`

## Validation

All TS/TSX source files in the delivered build were syntax-transpiled successfully with TypeScript. A complete `npm run build` could not be executed in the isolated build environment because the npm registry was unavailable, so the package dependencies could not be reinstalled there. The source tree was nevertheless checked for TS/TSX syntax after the changes.

After extracting the project locally:

```powershell
npm ci
npm run build
npm run lint
```

The existing ESLint warnings about React Fast Refresh are non-blocking. Any database migration errors should be resolved before using the application against production data.
