# HighPark Consult — Dashboard Upgrade Notes

This build adds portfolio drill-down behaviour, apartment floor summaries, premium branding, a persistent subtle HighPark watermark, animated About statistics, stronger media upload handling, transactional reservation creation, lease activation from owner reservations, and payment-verification hardening.

## Supabase migrations
Run migrations 0001 through 0007 in order. Migration 0006 configures the `property-media` storage bucket and adds the `create_reservation` RPC. Migration 0007 prevents browser-side users from marking payments successful/verified.

## Production payments
The frontend now creates a pending payment record and does not simulate a successful payment. A production M-Pesa/card webhook or server-side Edge Function must update payment status/verification using the service role. Do not put gateway secrets in Vite/frontend environment variables.

## KRA
The application can calculate and report tax per property, but direct KRA filing/payment is not implemented by this frontend-only build. It requires an official KRA integration/API arrangement, server-side credentials, taxpayer configuration, audit trail, and confirmation of the applicable tax regime.
