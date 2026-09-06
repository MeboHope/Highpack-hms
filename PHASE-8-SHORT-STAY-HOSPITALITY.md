# Phase 8 — Short-Stay & Hospitality Operations

HighPark Consult PMS is now being extended into a universal real-estate platform. Phase 8 adds the operating foundation for furnished short stays and Airbnb-style hospitality while preserving long-term rentals, land, sales and existing financial/document workflows.

## Included
- Admin and Owner Short-Stay Operations workspace
- Listing register with server-side pagination
- Direct, Airbnb, Booking.com, Expedia and Vrbo channel flags
- Nightly/weekend/cleaning pricing
- Minimum/maximum stay and guest limits
- Booking register with check-in/check-out lifecycle
- Guest and channel information
- Payment status tracking
- Rate calendar table foundation
- Housekeeping/turnover task foundation
- Short-stay dashboard KPIs
- Universal public-site wording for homes, land, commercial property and stays
- Premium receipt PDF redesigned as a compact professional receipt

## Supabase migration
Apply:
`supabase/migrations/20260906160000_0030_short_stay_operations.sql`

It creates:
- `short_stay_listings`
- `short_stay_bookings`
- `short_stay_rate_calendar`
- `short_stay_turnovers`
- `get_short_stay_dashboard(...)`

All four tables have explicit `authenticated` grants and RLS policies.

## Routes
- `/admin/short-stay`
- `/owner/short-stay`

## Validation
Run locally after extracting:
```powershell
npm ci
npm run build
npm run lint
npm run dev
```
Do not use `npm audit fix --force`.
