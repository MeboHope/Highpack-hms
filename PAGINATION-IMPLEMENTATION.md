# Server-side pagination

Implemented September 3, 2026.

The owner and admin operational list screens now request 20 records per page using Supabase range pagination (`range(from, to)`) or dedicated SECURITY DEFINER paginated RPCs. The reusable `Pagination` component provides Previous/Next and numbered page navigation.

Paginated screens include Owner Properties, Units, Reservations, Expenses, Tax, Maintenance, Tenants and Payments, plus Admin Properties, Users, Reservations, Payments, Units, Tax, Expenses and Maintenance.

## Database migration

Apply `supabase/migrations/20260903170000_0022_server_side_pagination.sql` after the existing migrations. It adds `get_managed_expenses_page` and `get_managed_maintenance_page`.

## Expense ledger safety

The existing `get_managed_expenses()` function and the previously fixed expense creation/read policies were not replaced. The new pagination RPC is additive and uses the same owner/admin authorization model.
