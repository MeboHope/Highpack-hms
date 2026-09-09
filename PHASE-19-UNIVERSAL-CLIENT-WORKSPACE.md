# Phase 19 — Universal Client Workspace

This phase introduces persistent asset context across tenant/client and owner workspaces while preserving existing financial, payment, document, lease, pagination, short-stay and marketplace workflows.

## Tenant / Client
- Active lease assets are loaded as a portfolio rather than a single implicit home.
- The selected asset persists in local storage and the URL query string.
- Dashboard financial and activity summaries are scoped to the selected asset.
- Asset-aware labels come from `src/lib/assetContext.ts`.
- `AssetSwitcher` provides a consistent premium selector.

## Owner
- Owner dashboard now has a persistent active portfolio asset selector.
- A selected asset pulse surfaces inventory, occupancy, expected collection and collected amount without replacing the full portfolio view.

## Preservation
- Existing payment workflows, M-Pesa STK Push, manual PayBill fallback, bank transfer review, Equity graceful dormant mode, KRA dormant mode, document centre, lease lifecycle, short-stay, sales/marketplace and pagination are retained.
