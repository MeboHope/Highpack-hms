# HighPark Consult — Premium Production Upgrade

## Included
- Premium blue/gold hero treatment, larger logo and subtle site-wide watermark.
- Exact company contact presentation with phone, postal address, email and WhatsApp icons.
- Database-backed About/Home counters with count-up animation.
- More reliable public property loading: properties and units are loaded separately so a relationship/query issue does not blank the marketplace.
- Clickable owner/admin/tenant dashboard statistics and property drill-downs.
- Apartment floor support via `number_of_floors`, with per-floor available/occupied/reserved unit summaries.
- Owner property media manager now supports photos, walkthrough videos and audio/voice tours.
- Reservation RPC fallback for environments where the transactional RPC migration has not yet been deployed; the SQL migration remains the preferred production path.
- Pre-move-in maintenance/service requests can be tied to an active reservation; active leases continue to work normally.
- Admin Settings now fails safely to defaults instead of showing an endless spinner.

## Required Supabase migration
Run all migrations in `supabase/migrations` in order, including:
`20260902070000_0007_premium_property_media_floor_support.sql`

This migration adds:
- `properties.number_of_floors`
- `properties.audio`
- audio MIME types to the `property-media` bucket
- storage policies for owner/admin media management
- reservation-linked maintenance insert policy

## Local environment
Keep your existing `.env.local` in your local working copy. Do not commit it. Use `.env.example` as the template.

## Payment/KRA production note
Browser-side payment success must not be trusted for production. M-Pesa and other payment providers should confirm transactions through server-side callbacks/webhooks before a payment is marked successful or a reservation is treated as paid. KRA filing/payment should also be implemented through an officially supported integration and secure server-side credentials; this upgrade does not claim direct KRA filing is enabled.
