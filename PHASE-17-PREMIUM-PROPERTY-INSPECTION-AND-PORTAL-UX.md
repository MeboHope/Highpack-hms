# Phase 17 — Premium Property Inspection & Portal UX

## What changed
- Fixed Admin Dashboard **Property Performance → Inspect** so every property opens its own administrator property inspection workspace at `/admin/properties/:propertyId` instead of returning to the generic registry.
- Admin property registry view/property name/action now opens the same specific inspection workspace.
- Added a dedicated admin property inspection page with:
  - property hero/gallery image
  - exact occupancy metrics
  - unit inventory for that property
  - recent reservations
  - recent leases
  - property profile and operational model
  - direct links to units/reservations
- Refined Owner Properties with a premium portfolio hero and more polished property cards.
- Refined public marketplace cards and marketplace background treatment.
- Refined public navigation/header treatment and dashboard-facing presentation without changing business workflows.

## Preserved
All existing workflows remain intact, including server-side pagination, financial command centre, payments, M-Pesa STK Push, manual PayBill, bank transfers, Equity graceful dormant mode, KRA graceful dormant mode, documents/compliance, leases, short-stay, sales/marketplace and universal property/land support.

## Validation
Run locally:

```powershell
npm ci
npm run build
npm run lint
npm run dev
```

Do not run `npm audit fix --force`.
