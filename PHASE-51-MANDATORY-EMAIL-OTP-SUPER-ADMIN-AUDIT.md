# Phase 51 — Mandatory Email OTP Login, Professional Audit Trail & Super Admin Command Center

## What was implemented

### 1. Mandatory email verification at every login

The website login is now a two-stage process:

1. User enters email + password.
2. HighPark validates the password server-side without exposing the temporary session to the browser.
3. A fresh six-digit OTP is generated and emailed to the account's email address.
4. The user enters the OTP.
5. Only after successful OTP verification is the final Supabase session created.
6. The challenge is one-time, short-lived, attempt-limited and bound to the browser's login nonce.

The final Auth custom-access-token hook also blocks direct password/OTP/magic-link token issuance unless a verified login challenge exists. This is the server-side control that prevents someone from bypassing the website UI and calling Supabase Auth directly.

Supabase documents Custom Access Token Hooks as a mechanism that runs before a JWT is issued and can use the authentication method to customize token issuance. citeturn14search0turn14search2

### 2. Security email provider

The OTP delivery Edge Function uses Resend. Configure these Supabase Function secrets:

```text
RESEND_API_KEY=<your Resend API key>
SECURITY_OTP_FROM_EMAIL=HighPark Consult <security@your-verified-domain>
LOGIN_OTP_PEPPER=<long random secret>
SUPABASE_ANON_KEY=<Supabase publishable/anon key if not already available as an Edge Function secret>
```

The Resend sender domain must be verified before production email delivery is used.

### 3. Professional audit trail

`audit_logs` now records:

- timestamp
- authenticated user
- action/event
- entity type and entity ID
- previous/new values where available
- IP address
- user-agent
- session ID
- severity
- source
- structured metadata

Database-triggered events automatically read request headers for IP and user-agent context. Supabase documents `request.headers` and the `X-Forwarded-For` approach for capturing client IP information in Postgres request context. citeturn5search0

Authentication security events include:

- `LOGIN_OTP_SENT`
- `LOGIN_OTP_FAILED`
- `LOGIN_OTP_VERIFIED`

Supabase Auth itself also provides an Auth Audit Log containing sign-ins, sign-outs, password changes/resets, verification events and IP/user-agent metadata. Enable **Authentication → Audit Logs → Write audit logs to the database** in the Supabase dashboard if you want those Auth events retained in `auth.audit_log_entries` as well. citeturn11search5

### 4. Professional Admin audit interface

Admin Activity now supports filtering by:

- record/entity type
- action
- severity
- source
- IP address
- free-text search

The table now displays IP, session ID, user-agent, source and severity rather than only showing the business-record change.

### 5. Super Admin Command Center

A dedicated page has been added:

```text
/admin/super-admin
```

It is restricted to `is_super_admin = true` and provides:

- Super Admin identity/control-plane overview
- active staff count
- audit-event count
- administrator-account count
- staff/RBAC management shortcut
- user-management shortcut
- security/MFA shortcut
- audit shortcut
- system-settings shortcut

A Super Admin Command Center entry has also been added to the administrator navigation.

### 6. Login-protected Data API

Authenticated access to the application's protected public-schema tables is now subject to a restrictive login-OTP gate. Anonymous public marketplace reads remain available where their existing policies allow them.

This provides defense in depth: the UI asks for the code, the Auth token issuance hook requires the verified challenge, and database RLS additionally requires a valid verified-login state.

## Important production configuration

### Enable the Auth Hook in Supabase

The migration creates the hook function and the local `supabase/config.toml` declaration. For the hosted Supabase project, also enable the hook in:

**Supabase Dashboard → Authentication → Hooks → Custom Access Token**

Select:

```text
public.custom_access_token_hook
```

Supabase's current documentation places Custom Access Token Hooks in the Auth Hooks configuration and documents the required `supabase_auth_admin` execution grant. citeturn14search2

### Configure the OTP sender

Deploy the function:

```powershell
supabase functions deploy secure-login --no-verify-jwt
```

Then set secrets:

```powershell
supabase secrets set RESEND_API_KEY="YOUR_RESEND_API_KEY"
supabase secrets set SECURITY_OTP_FROM_EMAIL="HighPark Consult <security@yourdomain.com>"
supabase secrets set LOGIN_OTP_PEPPER="GENERATE_A_LONG_RANDOM_SECRET"
supabase secrets set SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_KEY"
```

Do not put any of these secrets in the React `.env` file or browser bundle.

## Verification sequence

Run:

```powershell
npm ci
npm run build
npm run lint
supabase db push --include-all
supabase functions deploy secure-login --no-verify-jwt
```

Then test:

1. Open `/login`.
2. Enter valid credentials.
3. Confirm no application session is established before OTP verification.
4. Confirm the email arrives.
5. Enter the six-digit code.
6. Confirm the user reaches the correct role workspace.
7. Confirm `LOGIN_OTP_SENT` and `LOGIN_OTP_VERIFIED` appear in Activity & Alerts.
8. Confirm the IP address and user-agent are populated.
9. Try an incorrect OTP five times; the challenge must lock.
10. Try direct password authentication from a separate client without first completing the OTP challenge; the custom access-token hook must reject token issuance once enabled.
11. Open `/admin/super-admin` using a Super Admin account.
12. Confirm an ordinary admin/staff account receives Access Denied.

## Security note

Email OTP is an additional authentication factor based on control of the verified email account. High-risk Super Admin accounts should continue to use the existing authenticator-app MFA as an additional layer. Supabase's MFA implementation supports authenticator-app/TOTP factors and assurance levels, which should remain enabled for privileged staff. citeturn0search2


## Phase 51.1 login deadlock repair

The mandatory email-OTP Auth Hook intentionally blocks password token issuance until OTP verification. The secure-login preflight therefore must not call `signInWithPassword`, because that would invoke the same hook before a challenge exists. The repaired function uses the server-only `verify_login_password` SECURITY DEFINER RPC to validate the existing Supabase Auth bcrypt hash without issuing a JWT. The browser still receives no session until the OTP is verified.
