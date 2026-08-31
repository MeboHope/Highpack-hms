# HighPark Consult — clean compilation fix

This build removes the duplicate legacy component tree that was causing the 345 TypeScript errors.

The project had two incompatible property models:
- the active Supabase schema uses `properties.name`, `status`, and `property_units` for bedrooms/rent/etc.
- an older component tree expected `properties.title`, `listing_type`, `selling_price`, `availability_status`, `is_featured`, etc.

Those old components are not imported by the active `src/App.tsx`, so they have been removed rather than weakening the database types or adding fake columns.

Use this project as a whole. Do not copy the removed legacy PropertyManagement/PropertyCard files back into `src/components`.

## Run

```powershell
npm install
npm run build
npm run dev
```

Keep your local `.env.local` with your own Supabase values.

Run migration `20260831095400_0004_secure_public_registration.sql` in Supabase after the initial migrations.
