# HighPark Consult — Production Role Subdomain Security Model

## How users access their accounts

Every person has an individual authenticated account. The role determines the workspace they are permitted to use. There are no shared staff credentials.

Examples:

- Super Admin / System Owner → `superadmin.highparkconsult.com`
- Administrator → `admin.highparkconsult.com`
- Property Manager → `property-manager.highparkconsult.com`
- Finance Officer → `finance.highparkconsult.com`
- Sales Officer → `sales.highparkconsult.com`
- Compliance Officer → `compliance.highparkconsult.com`
- Support Officer → `support.highparkconsult.com`
- Owner / Agent → `owners.highparkconsult.com`
- Tenant / customer workspace → `tenants.highparkconsult.com`

## Security layers

1. Supabase Auth verifies the user's identity and session.
2. The profile role determines the user's base role.
3. Staff membership determines the operational staff role.
4. Permission RPCs determine whether the requested operation is allowed.
5. Property assignments restrict staff to assigned properties where applicable.
6. PostgreSQL RLS remains the authoritative database boundary.
7. Hostname-aware routing prevents a signed-in user from intentionally using another role's workspace host.
8. Sensitive staff administration is restricted to Super Admin and audited.

## Important production hardening

Before calling the deployment fully hardened, configure:

- Vercel custom domains/wildcard DNS for the role subdomains.
- Supabase Site URL and Redirect URLs for every production auth callback.
- HTTPS-only production hosts and HSTS.
- MFA for Super Admin accounts.
- Strong password policy and session/re-authentication for sensitive actions.
- Rate limiting and abuse monitoring for public/auth endpoints.
- CSP/security headers at the hosting layer.
- Regular review of RLS policies, staff permissions and audit logs.

The browser hostname check must never replace database authorization. A user who manipulates the browser or URL must still be denied by Supabase RLS/RPC authorization.
