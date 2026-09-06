# Phase 9 Universal Marketplace Repair & Asset Onboarding

This package supersedes the earlier Phase 9 ZIP for the current Supabase deployment.

## Database repair

Apply migration `supabase/migrations/20260906173000_0034_universal_schema_and_public_marketplace_repair.sql`.

It is intentionally compatibility-first and uses `ADD COLUMN IF NOT EXISTS` so partially-applied Phase 7/8/9 schemas are repaired without deleting existing data. It repairs the short-stay fields required by the application, creates/repairs the sales tables, grants authenticated table access, and publishes `get_public_universal_catalog()`.

The migration ends with `NOTIFY pgrst, 'reload schema'` to refresh the PostgREST schema cache.

## Application changes

- Owner Add Property is now **Add Property / Asset**.
- Asset class: built property, land/plot, mixed-use, development project, other.
- Operating model: long-term rental, short-stay/hospitality, sale, lease/commercial letting, land sale, mixed.
- Title, parcel, tenure, land area, zoning and year-built/completion fields.
- Full Kenyan location/address and map fields.
- Built-asset operating fields, amenities, utilities and security.
- Land-specific use, access, boundaries and utilities.
- Sale price/reservation setup can automatically create a draft sale listing.
- Short-stay pricing can automatically create a draft hospitality listing.
- Photos, videos and audio tours remain supported.
- Public home/search/detail pages now use the universal marketplace catalogue and no longer assume every listing is a house.
- Public marketplace supports property, land, commercial, development, sale and short-stay opportunity terminology.

## Required deployment order

1. Run the new `0034` migration in Supabase.
2. Confirm the migration completes successfully.
3. Refresh the local app and sign in again.
4. Verify `/owner/properties`, `/admin/short-stay`, `/admin/sales`, `/properties`, and an individual `/property/<id>` page.

Do not skip the migration: the two reported schema-cache errors are database-side errors and the frontend cannot create missing Supabase tables/columns by itself.
