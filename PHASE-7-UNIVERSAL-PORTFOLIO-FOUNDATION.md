# Phase 7 — Universal Portfolio & Asset Foundation

This phase expands HighPark Consult PMS beyond traditional house management.

## Supported asset directions

- Residential houses and apartments
- Commercial buildings and offices
- Mixed-use properties
- Land and plots
- Development projects
- Property and land sale workflows
- Long-term rental/letting
- Short-stay / Airbnb-style operations
- Multiple short-stay channels (direct, Airbnb, Booking.com, Expedia, Vrbo, other)

## Included

### Universal property classification
`properties` now includes:
- `asset_class`
- `operation_model`
- `ownership_type`
- `title_number`
- `parcel_number`
- `total_land_area`
- `land_area_unit`
- `zoning`
- `year_built`

### Land register
New `land_parcels` table for parcel-level records including title/parcel references, land use, tenure, area, zoning, asking price and sale status.

### Short-stay foundation
New `short_stay_listings` and `short_stay_bookings` tables provide a channel-neutral foundation for Airbnb-style operations, including nightly rates, cleaning fees, stay rules, check-in/out times, guest counts and booking lifecycle.

### UI
- Admin: `/admin/portfolio`
- Owner: `/owner/portfolio`
- Server-side pagination
- Search by property, location, title and parcel reference
- Asset class and operating-model filters
- Asset profile editor

## Supabase
Run the migration:
`supabase/migrations/20260906130000_0027_universal_asset_portfolio_foundation.sql`

The migration explicitly grants authenticated table privileges while retaining RLS authorization.

## Next direction
The next phases can build the operational layers on top of this foundation: short-stay calendar and availability, guest check-in/out, channel synchronization fields, land/plot sales pipeline, valuations, documents/title workflows, commissions, and portfolio-wide analytics.
