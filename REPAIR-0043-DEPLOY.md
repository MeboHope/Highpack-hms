# Runtime repair 0043

This repair addresses three confirmed runtime defects:

1. KRA eTIMS settings/log tables had RLS policies but lacked `authenticated` table grants.
2. `create_deposit_payment` referenced `system_settings.value`, but the actual column is `reservation_fee_policy`.
3. The Equity payment-link Edge Function used the caller's RLS client for payment/profile operations. It now uses the service-role client after authenticating the caller, and returns the provider response when Jenga rejects a request.
4. The Equity Payment Link amount is sent as a two-decimal string and the exact same representation is used for the Jenga signature, matching current Jenga documentation.

Deploy:

```powershell
supabase link --project-ref xhcsanlaslsilqnfanrk
supabase db push --include-all
supabase functions deploy equity-payment-link
supabase functions deploy equity-account-alert --no-verify-jwt
supabase functions deploy mpesa-stk
supabase functions deploy mpesa-callback --no-verify-jwt
npm run build
npm run lint
```

Do not run `npm audit fix --force`.

Equity/Jenga still requires its own valid Supabase secrets and merchant onboarding credentials. The function now exposes the provider HTTP status/code/message instead of hiding the failure behind a generic non-2xx message.
