# Equity / Jenga API setup

HighPark uses the Equity/Finserve Jenga API as the bank-side collection integration. The integration is server-side only; never put Jenga credentials in `VITE_*` variables or browser code.

## Official flow used
- Payment Link API: creates a single restricted KES payment request and can notify the tenant by email/SMS.
- Account Alerts: configure a CREDIT alert in JengaHQ for the HighPark Equity collection account and point it to the `equity-account-alert` Supabase Edge Function. The callback payload includes transaction reference, amount, bill/reference, status and bank account.
- The PMS reconciles a successful credit against the matching pending Equity payment and then verifies the payment through the existing receipt/invoice workflow.

Equity/Jenga requires a JengaHQ account, API key, merchant code, consumer secret and an RSA public key registered in the portal. The private key stays in Supabase secrets.

## Supabase secrets
Set these with `supabase secrets set` (never commit them):

- `EQUITY_JENGA_ENVIRONMENT=sandbox` (use `production` only after go-live approval)
- `EQUITY_JENGA_API_KEY`
- `EQUITY_JENGA_MERCHANT_CODE`
- `EQUITY_JENGA_CONSUMER_SECRET`
- `EQUITY_JENGA_PRIVATE_KEY` (PKCS#8 private-key PEM; newline escapes are accepted)

If you generated the RSA key with `openssl genrsa`, convert it before storing the secret:
`openssl pkcs8 -topk8 -in privatekey.pem -nocrypt -outform PEM -out pkcs8_privatekey.pem`

The payment-link function requires a configured Jenga subscription for the Payment Link API. The account-alert callback requires the Equity/Jenga portal to be configured for CREDIT alerts on the collection account.

## Deploy

`supabase functions deploy equity-payment-link`

`supabase functions deploy equity-account-alert --no-verify-jwt`

The callback must be publicly reachable because Equity/Jenga calls it server-to-server. Do not put credentials in the frontend.

## Important production note
The Account Alerts callback is deliberately strict about matching a pending Equity payment by the unique external reference and exact amount. During Equity onboarding, confirm the provider's callback-signature verification requirements and enable them if your Jenga subscription supplies a verifiable callback signature. Do not treat arbitrary unmatched callbacks as payments.
