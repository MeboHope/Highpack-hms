# HighPark Consult PMS — Phase 16 Premium UI/UX + Analytics

## Included
- Fixes Admin Settings `permission denied` on save by granting authenticated table write privileges while keeping the existing admin-only RLS policy.
- Adds a reusable premium analytics layer without introducing a chart-library dependency.
- Admin Dashboard: verified collection trend + portfolio occupancy mix.
- Owner Dashboard: expected-vs-collected property comparison + occupancy mix.
- Tenant Dashboard: verified payment trend + current balance composition.
- Adds polished analytics cards, micro-interactions, visual hierarchy and chart styling globally.
- Fixes the Admin Dashboard lease-expiry query to use the schema's `lease_end` column.

## Deployment
1. `npm ci`
2. `supabase link --project-ref xhcsanlaslsilqnfanrk`
3. `supabase db push --include-all`
4. `npm run build`
5. `npm run lint`

No Equity credentials are required for this phase. KRA remains dormant when unconfigured.
