# HighPark Consult PMS — Phase 48 V2 Repair

This package preserves the Phase 48 short-stay public booking flow and living-motion UX, restores the Phase 47 security-surface migration 0062, and fixes the TypeScript build error caused by `formatKES` not being imported by `AccountPages.tsx`.

## Included
- Phase 47 security surface hardening migration 0062 retained.
- Phase 48 public short-stay booking migration 0063 retained.
- Public short-stay detail CTA supports direct booking or stay-availability request.
- Authenticated guest `/stays` booking history page retained.
- Broad scroll-driven living-motion/reveal system retained.
- `formatKES` import repaired in `src/pages/AccountPages.tsx`.

## Verification
- ZIP contents are integrity-tested before delivery.
- Run in the extracted project:
  - `npm ci`
  - `npm run build`
  - `npm run lint`
  - `supabase db push --include-all`

Do not run `npm audit fix --force` as part of this repair; dependency upgrades are a separate change and may introduce breaking changes.
