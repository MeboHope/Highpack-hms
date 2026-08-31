# HighPark Consult Ltd — Deployment Package

This package is intentionally aligned with the SQL migrations in `supabase/migrations/`.

## 1. Supabase migration order
Run the migrations in this exact order:

1. `20260830124717_0001_initial_schema.sql`
2. `20260830130652_0002_make_owner_nullable.sql`
3. `20260830130722_0003_seed_demo_data.sql`
4. `20260831095400_0004_secure_public_registration.sql`

Do not replace the database schema with a different `properties` schema containing fields such as `title`, `listing_type`, `selling_price`, `is_published`, `is_featured`, or `availability_status`. This application uses the schema defined above: `properties.name`, `properties.property_type`, `properties.status`, and `property_units.monthly_rent`, etc.

## 2. Frontend environment variables
Create `.env.local` for local development:

```text
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

For production, configure the same two variables in the hosting provider's environment-variable settings. Do not commit `.env.local`.

## 3. Account model
Public registration creates a `customer` profile only. The UI labels this account as a Tenant.

Owner and Admin accounts are not created through the public registration form. Existing owner/admin accounts must be provisioned separately and assigned their role securely in Supabase.

## 4. Dashboard routes
- Tenant: `/tenant`
- Owner: `/owner`
- Admin: `/admin`

The application chooses the dashboard from the authenticated profile role.

## 5. Build
From the project root:

```bash
npm install
npm run build
```

The deployment target should publish the generated `dist` directory.

## 6. Important schema rule
The TypeScript models in `src/lib/supabase.ts` are deliberately based on the SQL migrations included in this package. Do not copy TypeScript models from an older version of the project that uses a different Property shape.
