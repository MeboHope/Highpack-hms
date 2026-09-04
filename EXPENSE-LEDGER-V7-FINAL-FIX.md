# Expense ledger v7 — final admin persistence/read repair

The admin expense page now uses `get_admin_expense_ledger_final()`, a simple
`jsonb` SECURITY DEFINER RPC. It validates the signed-in profile as an admin,
reads the authoritative `public.expenses` table, and hydrates property/owner
names in the same server-side query.

The migration also replaces the recursive/self-referencing admin check inside
the `expenses` SELECT RLS policy with `is_admin_user()`, a SECURITY DEFINER role
helper. This repairs direct admin reads as a fallback and avoids the 403 path.

## Apply in Supabase

Run:

`supabase/migrations/20260903130000_0019_admin_expense_ledger_final.sql`

Then hard-refresh the application and test:

1. Owner records an expense.
2. Owner refreshes Expenses — the expense remains.
3. Admin opens Expenses — the same expense is visible.
4. Admin refreshes Expenses — the expense remains.

No existing expense rows are deleted or recreated by this migration.
