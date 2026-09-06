# Phase 10.1 — Production Hardening

This patch is applied on top of Phase 10 M-Pesa Live Integration.

## Changes
- Moved navigation configuration out of `DashboardLayout.tsx` so Fast Refresh only sees component exports there.
- Moved `useAuth`, `useRouter`, and `useToast` hooks into `src/context/hooks.ts` so provider modules remain component-focused.
- Added Vite manual chunks for React, Supabase, and Lucide to reduce the main application bundle.
- Kept the M-Pesa callback strongly typed; no `any` suppression was added.
- Preserved payment, receipt, expense ledger, pagination, universal asset, short-stay, and sales functionality.

## Validation
Run locally:

```powershell
npm ci
npm run build
npm run lint
npm run dev
```

Do not use `npm audit fix --force` on this production baseline.
