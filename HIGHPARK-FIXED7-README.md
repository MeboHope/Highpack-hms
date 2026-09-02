# HighPark Consult PMS — FIXED7

This build is based on FIXED6 Payment Foundation.

## Included
- Premium owner property-performance cards with clickable drill-down.
- Premium admin property-performance cards with clickable property filtering.
- Stronger contrast for navy/gold dashboard hero text.
- Server-side lease conversion RPC: `create_lease_from_reservation`.
- Server-side owner expense RPC: `create_owner_expense`.
- Downloadable CSV + lightweight PDF reports from Owner Reports.
- Existing payment foundation and M-Pesa/Equity configuration retained.

## Required Supabase migration
Apply:
`supabase/migrations/20260902190000_0011_lease_expense_server_workflow.sql`

Then refresh the Supabase schema cache if required.

## Local verification
```powershell
npm ci
npm run build
npm run lint
```

Do not run `npm audit fix --force` automatically; it may introduce a major Vite upgrade.
