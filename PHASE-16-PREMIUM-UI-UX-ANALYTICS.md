# HighPark Consult PMS — Phase 16 Premium UI/UX & Analytics

This release is a visual/product-design upgrade built on Phase 15 V3. It preserves the existing operational workflows and adds a reusable premium visual language plus analytics surfaces.

## Included
- Premium global dashboard canvas, cards, buttons, tables, forms and interaction states.
- More polished DashboardLayout with a consistent workspace surface.
- Analytics visuals on Admin, Owner and Tenant financial/operational workspaces.
- Visual mixes for payments, expenses, maintenance, portfolio classification, sales pipeline and short-stay bookings.
- Tenant rent centre visual balance/payment analytics.
- Universal terminology such as Saved Opportunities instead of house-only wording.
- Existing pagination and server-side data loading are preserved.
- Existing M-Pesa STK Push, manual PayBill, bank transfer, Equity dormant mode and KRA dormant mode are preserved.
- Existing document/compliance, lease lifecycle, short-stay and sales workflows are preserved.
- Admin Settings write-permission migration remains included.

## Design principle
Charts are used where they help answer an operational question; detailed ledgers remain tables with pagination. This keeps the application premium without turning every page into a dashboard wall.

## Validation
The source package was checked structurally after the UI changes. A full dependency reinstall/build could not be completed in the build container because `npm ci` exceeded the container transport timeout. The user's Phase 15 V3 project had already passed `npm run build` and `npm run lint`; after installing this release locally, run the normal validation commands before deployment.

Recommended validation:

```powershell
npm ci
npm run build
npm run lint
supabase link --project-ref xhcsanlaslsilqnfanrk
supabase db push --include-all
npm run dev
```

Do not run `npm audit fix --force`.
