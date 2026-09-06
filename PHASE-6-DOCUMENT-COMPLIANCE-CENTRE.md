# HighPark Consult PMS — Phase 6: Document & Compliance Centre

## What was added
- Secure private Supabase Storage bucket: `pms-documents`.
- New `documents` metadata table with categories, review status, property/lease/tenant links, uploader and review notes.
- Row-level security for admin, owner/agent, tenant and uploader access.
- Signed URLs for private document opening/download.
- Admin document verification/rejection workflow.
- Admin, owner and tenant document workspaces.
- Search, category/status filters and server-side pagination (20 records/page).
- Automatic audit logging for document changes using the Phase 5 audit trigger.
- Upload validation: PDF, images, Word and Excel; maximum 10 MB.

## New routes
- `/admin/documents`
- `/owner/documents`
- `/tenant/documents`

## Supabase migration
Run:
`supabase/migrations/20260906100000_0026_document_compliance_centre.sql`

Run this migration after the Phase 5 migration `20260904120000_0025_activity_audit_centre.sql`.

## Important
Do not run `npm audit fix --force`. Validate with `npm ci`, `npm run build`, `npm run lint`, then `npm run dev`.
