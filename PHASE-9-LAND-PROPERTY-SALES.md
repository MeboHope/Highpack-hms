# Phase 9 — Land & Property Sales

Adds a controlled sales/disposals workflow for land, plots, built properties and development opportunities.

## Database
- `sale_listings`: sale inventory, asking price, negotiability, reservation amount and due-diligence flags.
- `sale_offers`: buyer offers and review status.
- `sale_transactions`: completion pipeline, deposits and transfer references.
- RLS, indexes, grants, timestamps and admin/owner dashboard RPC.

## UI
- Admin: `/admin/sales`
- Owner: `/owner/sales`
- Premium sale pipeline dashboard with pagination, filters, listing creation and status workflow.

## Important
This phase does **not** claim live payment settlement, bank reconciliation or KRA/eTIMS integration. Those remain separate production integrations.
