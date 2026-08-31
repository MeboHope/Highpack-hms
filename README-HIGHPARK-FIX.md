# HighPark Consult Ltd — corrected House PMS project

## What was corrected
- Restored the active RouterContext/AuthContext architecture.
- Restored `Header` and `Footer` exports from `src/components/Layout.tsx`.
- Navbar and footer use the exact logo at `src/assets/highpark-logo.jpg`.
- Removed visible Nyumba branding from active pages.
- Standardized public authentication to `/login` and `/register`.
- Public registration is tenant-only; no owner/admin role selector is exposed.
- Added strong client-side password requirements: 10+ characters, upper, lower, number, special character.
- Hardened Supabase profile creation so new public accounts are always `customer`.
- Added a database trigger preventing non-admin users from changing account roles.
- Added protected route handling for tenant/owner/admin/account pages.
- Added robust authentication initialization error handling to avoid a permanent blank loading screen.
- Added compatibility files under `src/lib/`.
- Preserved the old unused `src/components/admin` and `src/components/public` implementations, but excluded them from the active TypeScript program because they target a different schema/API than the active `src/pages/*` application.

## Environment
Create `.env.local` in the project root (same level as package.json):

VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

Do not put a Supabase service-role/secret key in the Vite frontend.

## Install and build

npm install
npm run build
npm run dev

## Supabase security migration

Apply:

supabase/migrations/20260831095400_0004_secure_public_registration.sql

This migration makes the database enforce tenant-only public profile creation and blocks unauthorized role changes.

For production, also configure Supabase Auth to enforce at least the same password strength and enable email confirmation as required by the deployment policy.
