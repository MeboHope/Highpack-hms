# HighPark PMS build fixes

This package includes the following TypeScript/ESLint fixes:

- Normalizes Supabase `properties(...)` relationship results in `AdminUnits` because PostgREST may infer the nested relationship as an array.
- Removes unused Admin icon imports.
- Removes the unused `propertyId` parameter from `ReservationModal`.
- Keeps the existing production-payment architecture: reservations use the transactional RPC and pending payment intents; successful/verified payment must come from server-side provider verification/webhooks.

After extracting, run `npm ci`, then `npm run build` and `npm run lint`.
