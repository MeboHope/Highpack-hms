# Expense Admin Ledger Fix — v5

The admin expense ledger now uses a dedicated `get_admin_expense_ledger()` SECURITY DEFINER RPC. It validates that the signed-in profile is an administrator and then reads every persisted expense directly from the authoritative `expenses` table, with property and owner names hydrated in the same server-side query.

This avoids the previous dependency on browser-side `expenses` RLS visibility, generic manager RPC behaviour, and nested PostgREST relationships. The generic `get_managed_expenses()` path remains as a compatibility fallback for databases that have not yet applied the new migration.

Owner expense recording is unchanged and remains backed by `create_owner_expense()`.
