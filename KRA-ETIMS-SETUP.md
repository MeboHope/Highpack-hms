# KRA eTIMS / OSCU — Phase 14

This phase prepares HighPark PMS for KRA eTIMS system-to-system invoicing. KRA documents OSCU/VSCU as the system-to-system routes and requires onboarding/testing/certification before production use.

Sandbox: `https://etims-api-sbx.kra.go.ke/etims-api/`
Production: `https://etims-api.kra.go.ke/etims-api/`

Required Supabase secrets:
- `KRA_ETIMS_ENVIRONMENT=sandbox`
- `KRA_ETIMS_PIN=<HighPark KRA PIN>`
- `KRA_ETIMS_CMC_KEY=<communication key issued by KRA after OSCU activation>`

The PMS settings table also stores the taxpayer PIN, branch, KRA item code/classification, tax type and tax rate. Do not assume rent is VAT-taxable; configure this from HighPark's accountant/tax adviser and KRA classification.

KRA eTIMS is electronic invoicing/compliance. This phase does not invent an automatic KRA tax-remittance API. Actual tax payment automation will be added only after the applicable KRA/iTax payment API/access is confirmed.
