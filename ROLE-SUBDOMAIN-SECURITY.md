# HighPark Consult — Role-Isolated Subdomain Security

The frontend now contains hostname-aware role isolation for the planned HighPark production domains:

- `superadmin.highparkconsult.com` — System Owner / Super Admin
- `admin.highparkconsult.com` — general administrator
- `property-manager.highparkconsult.com` — Property Manager
- `finance.highparkconsult.com` — Finance Officer
- `sales.highparkconsult.com` — Sales Officer
- `compliance.highparkconsult.com` — Compliance Officer
- `support.highparkconsult.com` — Support Officer
- `owners.highparkconsult.com` — Property Owner / Agent
- `tenants.highparkconsult.com` — Tenant
- `portal.highparkconsult.com` — Customer portal

## Security model

The browser hostname check is an additional isolation layer, not the primary authorization boundary. The existing Phase 38 Supabase RLS/RPC permission enforcement remains authoritative for database access.

Before enabling these domains in production:

1. Add each hostname to the Vercel project.
2. Configure DNS for the HighPark domain.
3. Add every production auth callback hostname/path to Supabase Authentication URL Configuration.
4. Configure the production `VITE_SITE_URL`/auth callback strategy consistently for the selected login and recovery domain.
5. Test each role with an account that is intentionally assigned to another role and verify that the workspace is rejected.
6. Do not use shared credentials between roles.

The current public Vercel domain remains usable for the marketplace and discovery experience.
