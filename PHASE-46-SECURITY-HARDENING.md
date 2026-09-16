# Phase 46 — HighPark Consult Security Hardening

This phase adds application-side session protection, MFA enrollment/challenge, security headers and database-side MFA enforcement for staff mutations.

## Implemented in the project

- PKCE auth flow.
- Local inactivity sign-out after 15 minutes.
- A visible 2-minute inactivity warning.
- Current-session sign-out for idle timeout; it does not silently terminate other devices.
- Security & Sessions page at `#/security`.
- TOTP authenticator enrollment, verification and removal.
- MFA challenge during sign-in when a verified factor exists.
- Sign out all devices from the Security page.
- Fresh reauthentication before password change.
- Security response headers through Vercel.
- Migration `20260915180000_0061_staff_mfa_sensitive_actions.sql`: staff write/sensitive permissions require an `aal2` session while read-only permissions remain available.

## Required Supabase Dashboard configuration

These settings are outside source control and must be configured in Supabase:

1. Authentication → Providers / Password: enable email confirmation for production accounts.
2. Authentication → Security and Protection → Password security: enable leaked-password protection where available and keep the project's strong password policy.
3. Authentication → Security and Protection → MFA: enable TOTP verification. For production staff accounts, make MFA mandatory according to the project's policy.
4. Authentication → Sessions: configure a maximum session lifetime and an inactivity timeout. A 12-hour maximum lifetime and 30-minute inactivity timeout are sensible starting values; tighten further for privileged staff if operationally practical.
5. Authentication → Rate limits: keep login, password recovery, OTP and MFA limits enabled.
6. Never expose a Supabase service/secret key in Vercel client-side environment variables. Only `VITE_SUPABASE_URL` and the publishable/anon key belong in the browser.
7. Keep payment provider secrets only in Supabase Edge Function secrets. Browser code should receive status/reference information, never gateway credentials.

## Production test matrix

- Wrong password repeatedly → rate limit / generic failure, no account enumeration.
- Staff without MFA → can browse permitted read-only pages but sensitive writes are denied server-side.
- Staff with verified TOTP → can perform permitted sensitive actions.
- Idle for 15+ minutes → current browser session is signed out.
- Security → Sign out all devices → other refresh sessions are revoked.
- Password change → reauthentication required.
- Direct Supabase requests made by a user with a different role/property assignment → RLS/RPC denial.
- Uploaded private documents → storage object policy must require the same owner/tenant/staff authorization as the document row.
- Payments → no raw card number, CVV or gateway secret is ever stored in the browser/database.
