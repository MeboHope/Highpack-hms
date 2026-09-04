# Owner Expenses — Definitive Fix

## What was fixed

The Owner → Expenses screen was receiving HTTP 400 from the legacy `get_managed_expenses()` RPC and then HTTP 403 from the direct `expenses` REST fallback. The direct fallback also depended on an RLS policy that did not reliably recognize property ownership.

This release makes `get_managed_expenses()` the canonical owner ledger RPC and changes it to return a simple `jsonb` array instead of a composite `RETURNS TABLE` result. It scopes rows by the property's real owner and by `expense.owner_id`, so older correctly-owned records remain visible.

The `expenses` SELECT policy is also repaired for owner-by-property access. The policy uses `SECURITY DEFINER` helpers so it does not recurse through other tables' RLS policies.

## Required Supabase step

Run this migration once in Supabase SQL Editor:

`supabase/migrations/20260903160000_0021_owner_expense_ledger_definitive.sql`

Do not run the old expense migrations again.

## Verification

After running the migration, while signed in as the owner, run:

```sql
SELECT proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_function_result(p.oid) AS result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'get_managed_expenses';
```

The result should show:

`get_managed_expenses | | jsonb`

Then refresh the PMS. The Owner Expenses page should call only:

`/rest/v1/rpc/get_managed_expenses`

and that request should return HTTP 200.

There should no longer be a direct `/rest/v1/expenses?...` request from `loadManagedExpenses`.
