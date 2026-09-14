# Phase 33 — Production Readiness & Client Experience

This phase builds on the verified HighPark Consult marketplace/navigation state and the Phase 32 messaging repair.

## Included

- Professional 404 / unknown-route experience instead of silently returning visitors to the homepage.
- Route-aware browser titles and consistent public-page description metadata.
- Mobile property-details quick actions for Message plus the most relevant next step (viewing for standard rental opportunities, enquiry for sale/land/short-stay opportunities).
- Recently viewed opportunities stored locally on the customer's device, with a clear-history action. No new database table or messaging change is introduced.
- Additional mobile bottom spacing so the quick-action rail never hides property content.
- Existing messaging tables, RLS policies and messaging RPCs are left untouched; the Phase 32 SQL repair remains part of the project.

## Protected areas

This phase intentionally does not redesign or replace the established messaging workflow, payments, expenses, land/plot metadata, AI catalogue, owner operations, tenant operations or admin workflows.

## Verification

The source package was prepared from the latest Phase 32 project. A local dependency installation/build could not be completed in the generation environment because the package installation timed out, so run `npm ci`, `npm run build`, and `npm run lint` in the project folder before deployment.

Expected result from the previously verified baseline is a successful build with the existing lint warnings only.
