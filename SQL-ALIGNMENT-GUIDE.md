# HighPark Consult House PMS — SQL Alignment Guide

This source tree is intentionally aligned to the Supabase schema in `supabase/migrations`.

## Property model

The `properties` table uses:
- `name` (not `title`)
- `property_type`
- `county`, `sub_county`, `town`, `estate`, `street`, `address`
- `number_of_units`
- `amenities`, `parking`, `security_info`, `water_availability`, `electricity`, `internet`, `pets_allowed`
- `photos`, `videos`
- `status`: `pending_verification | verified | rejected | suspended`
- `owner_id`

Unit-level data belongs in `property_units`, including:
- `unit_number`, `floor`, `house_type`
- `bedrooms`, `bathrooms`
- `monthly_rent`, `security_deposit`, `reservation_fee`
- `service_charge`, `water_charge`, `parking_fee`, `other_charges`
- `status`, `furnishing`, `amenities`, `photos`, `videos`, `description`

## Important legacy fields NOT used

Do not reintroduce components that expect these old/non-SQL fields on `Property`:
- `title`
- `listing_type`
- `selling_price`
- `monthly_rent`
- `security_deposit`
- `availability_status`
- `is_published`
- `is_featured`
- `bedrooms`
- `bathrooms`
- `parking_spaces`
- `floor_size`
- `furnished`

Those values either belong to `property_units` or are represented by the current schema differently.

## UI component contracts

`Badge` accepts `status` and `children`; it does not accept `className`.
`EmptyState` accepts `description`, not `message`.

The active app imports the SQL-aligned pages from `src/pages` and does not use the removed legacy dashboard component tree.

## Routes

- Owner dashboard: `/owner`
- Owner properties: `/owner/properties`
- Owner units: `/owner/units/:propertyId`
- Owner reservations: `/owner/reservations`
- Owner expenses: `/owner/expenses`
- Owner tax: `/owner/tax`
- Owner maintenance: `/owner/maintenance`
- Owner tenants: `/owner/tenants`
- Owner payments: `/owner/payments`
- Owner reports: `/owner/reports`
- Owner settings: `/owner/settings`
- Admin dashboard: `/admin`
- Admin properties: `/admin/properties`
- Admin users: `/admin/users`
- Admin reservations: `/admin/reservations`
- Admin payments: `/admin/payments`
- Admin settings: `/admin/settings`

## Supabase order

Run the migrations in filename order. Keep the supplied migration files together with this source tree so the frontend and database stay on the same model.
