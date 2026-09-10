# Phase 24 — Universal Asset-Aware Display Layer

## Purpose

This phase fixes the presentation problem where every property was being treated as a residential unit-based property on dashboards. The application now determines the appropriate display model from the asset class, operating model and property type before rendering property metrics.

## Display models

- Residential rental — units, vacancy, occupancy, tenants, rent and floors.
- Commercial rental — spaces, vacancy, occupancy, tenants, rent and floors.
- Mixed-use — spaces, occupancy, tenants and rent.
- Short-stay / hospitality — active listings, nightly rate, guest capacity and booking-oriented information.
- Land / plots — plot count, land area, dimensions, title/parcel, tenure and zoning. No residential occupancy/unit metrics.
- Development project — project/land information and sale/development signals rather than residential occupancy.
- Sale asset — sale mode, asking price, ownership and property/land information rather than rental occupancy.
- Whole asset — core asset/location/ownership information without invented unit metrics.

## Areas updated

- Owner Dashboard
- Admin Dashboard
- Owner property cards
- Admin property registry
- Admin property inspection
- Public marketplace cards
- Public home featured property cards
- Public property details
- Tenant workspace asset classification
- Dashboard workspace asset labelling
- Dashboard performance data enrichment from live property, land, sale and short-stay records
- Rentable-property financial profitability display excludes non-rentable assets

## Data handling

The existing `get_dashboard_property_performance` RPC remains the financial/unit rollup source. The frontend now enriches its rows from the live universal property, land parcel, sale listing and short-stay listing tables so older records are classified correctly without requiring a new database migration for this phase.

No database migration is required for Phase 24. The Phase 23 / V4 database migrations remain the deployed schema foundation.

## Validation

The changed TypeScript/TSX files were syntax-checked with the TypeScript transpiler API. The local tool environment did not have a complete dependency installation available for a fresh production build, so run `npm ci`, `npm run build` and `npm run lint` in the extracted project before deployment.
