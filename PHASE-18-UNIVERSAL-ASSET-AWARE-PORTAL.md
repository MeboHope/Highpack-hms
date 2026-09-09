# Phase 18 — Universal Asset-Aware Portal + Premium Owner/Admin UX

## Purpose
The PMS is now treated as a universal real-estate and asset-management platform rather than a house-only system.

## Client/Tenant workspace
- Added reusable `src/lib/assetContext.ts`.
- Current client dashboard derives presentation from the selected/active asset's `asset_class` and `operation_model`.
- Supports residential rental, commercial/mixed-use, short-stay, land, sale/acquisition and general lease contexts.
- Dashboard now presents a current-asset hero and asset-specific terminology instead of assuming every relationship is a house tenancy.
- Existing rent, lease, reservation, payment and document workflows remain intact.
- Tenant navigation now uses `Explore Assets` and `My Asset` where appropriate.

## Owner workspace
- Reframed dashboard and operational copy around assets, occupants, collections and portfolio operations.
- Preserved all existing owner functionality and analytics.

## Admin workspace
- Reframed global dashboard and lifecycle language around universal assets and occupants.
- Property inspection remains direct and asset-specific.
- Existing property, unit, payment, lease, maintenance, compliance and financial controls are preserved.

## No payment changes
M-Pesa STK Push, manual PayBill, bank transfer, Equity dormant mode, cash collection, receipts and KRA dormant mode are not altered by this phase.
