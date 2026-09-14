# Phase 37 V5 — Staff Invitation Authentication Fix

## Root cause
The Edge Function received the browser Authorization header, but it attempted to validate the token with a Supabase client whose Auth session storage is not available inside the Edge Function runtime. This produced `Auth session missing!`.

## Fix
`staff-admin` now extracts the Bearer access token from the request and validates it explicitly with `admin.auth.getUser(accessToken)` using the service-role client. The caller profile is also read through the trusted client, avoiding browser-session/RLS coupling.

## Deployment
```powershell
supabase link --project-ref xhcsanlaslsilqnfanrk
supabase functions deploy staff-admin
```

No database migration is required for this fix.
