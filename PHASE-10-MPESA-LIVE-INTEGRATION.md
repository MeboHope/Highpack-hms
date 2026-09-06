# HighPark Consult PMS — Phase 10: M-Pesa Live Integration

This phase moves the existing payment foundation from a placeholder STK flow to a real Safaricom Daraja integration path.

## Included
- Secure server-side Daraja OAuth and STK Push Edge Function.
- Server-side callback processing.
- CheckoutRequestID / MerchantRequestID / M-Pesa receipt tracking.
- Exact invoice-to-payment relationship.
- Provider amount validation before verification.
- Automatic rent invoice balance settlement after a successful callback.
- Customer notification after confirmed payment.
- Payment status remains pending until Safaricom callback confirmation.
- Tenant payment UI sends the phone number to the Edge Function rather than pretending the payment succeeded.

## Supabase secrets
Configure these as Edge Function secrets, never as VITE_ browser variables:

- DARAJA_CONSUMER_KEY
- DARAJA_CONSUMER_SECRET
- DARAJA_PASSKEY
- DARAJA_SHORTCODE=4080693
- DARAJA_CALLBACK_URL=https://<project-ref>.supabase.co/functions/v1/mpesa-callback
- DARAJA_ENVIRONMENT=production (or sandbox for testing)

Supabase automatically supplies SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY to Edge Functions.

## Deploy
```powershell
supabase functions deploy mpesa-stk
supabase functions deploy mpesa-callback
```

Configure the same callback URL in the approved Safaricom Daraja application. Do not enable production collection until Safaricom has approved the shortcode/application and the callback URL is reachable over HTTPS.

## Important
This is an actual integration implementation, but live collection still requires the customer's own Safaricom Daraja credentials and approved production configuration. No credentials are embedded in the project.

## Production checklist
1. Apply migration `20260906180000_0035_mpesa_live_payment_integration.sql`.
2. Deploy both Edge Functions.
3. Configure the five Daraja secrets plus callback URL.
4. Confirm the callback URL is publicly reachable over HTTPS.
5. Test in `sandbox` first where the Daraja application supports it.
6. Confirm successful callbacks settle the exact invoice and create the notification.
7. Confirm failed/cancelled callbacks never mark a payment verified.
8. Only then switch `DARAJA_ENVIRONMENT=production` and use the approved production shortcode.

Bank transfers remain manual in this phase. KRA/eTIMS remains a separate compliance integration and is not represented as completed.
