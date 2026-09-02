# HighPark Consult — Payment Integration Foundation

This build prepares the PMS for secure payment integration **before** live Safaricom Daraja credentials are available.

## Already configured

- HighPark M-Pesa PayBill: **4080693**
- M-Pesa account number: **0470281425369**
- Equity PayBill: **247247**
- Equity account prefix: **382000** (customer reference can be `382000#HOUSE_NO`)
- Account name: **HIGHPARK CONSULT LTD**

These are business identifiers, not API secrets.

## Security model

The browser creates only pending payment intents through controlled database functions. It cannot mark a payment successful or verified.

Live M-Pesa confirmation must come from the Safaricom callback/webhook and be processed by a Supabase Edge Function using the service-role key. Never put `DARAJA_CONSUMER_SECRET`, `DARAJA_PASSKEY`, or the Supabase service-role key in `.env.local` variables prefixed with `VITE_`.

## Apply the database migration

Run migrations through the Supabase CLI or SQL editor, in migration order. The new migration is:

`supabase/migrations/20260902170000_0010_payment_server_workflow.sql`

## When Daraja credentials are available

Set Edge Function secrets (server-side only):

- `DARAJA_CONSUMER_KEY`
- `DARAJA_CONSUMER_SECRET`
- `DARAJA_PASSKEY`
- `DARAJA_SHORTCODE=4080693`

Then deploy the functions:

```powershell
supabase functions deploy mpesa-stk
supabase functions deploy mpesa-callback
```

Configure Safaricom's callback URL to point to the deployed `mpesa-callback` function. Complete the STK Push implementation only after HighPark's Daraja app has the correct production permissions and callback configuration.

## What remains intentionally disabled

- No browser-side "payment successful" claim.
- No fake STK push.
- No hard-coded Daraja secret/passkey.
- No automatic KRA filing/payment without KRA's approved integration credentials/process.

This prevents the PMS from appearing to have verified a payment when it has not actually been confirmed by the provider.
