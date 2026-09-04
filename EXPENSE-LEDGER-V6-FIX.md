# Expense ledger v6 fix

This version fixes the persistence/read mismatch where a newly recorded expense
could appear temporarily in the UI and disappear after reload.

## Required database step

Run:

`supabase/migrations/20260903120000_0018_admin_expense_ledger_v2.sql`

in the Supabase SQL Editor.

The application now calls `get_admin_expense_ledger_v2()` for the admin ledger.
It is a SECURITY DEFINER function and therefore does not depend on the browser
RLS SELECT policy for `expenses`. It verifies the authenticated user's profile
role is `admin`, then reads every persisted expense directly from the authoritative
`expenses` table.

The previous `get_admin_expense_ledger()` remains as a compatibility fallback.

## Test

1. Owner records an expense.
2. Confirm it appears on Owner > Expenses.
3. Refresh Owner > Expenses and confirm it remains.
4. Log in as Admin.
5. Open Admin > Expenses.
6. Confirm the same expense is present.
7. Refresh Admin > Expenses and confirm it remains.

If step 2 fails after refresh, the issue is in the owner database/RLS path.
If step 2 succeeds but step 5 fails, the admin RPC migration has not been applied
or the admin account's `profiles.role` is not `admin`.
