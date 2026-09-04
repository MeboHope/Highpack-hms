# HighPark PMS — Premium Admin Enhancement

Implemented on top of the verified Admin Units / pagination version.

## Added
- Admin global search in the top bar.
- Ctrl+K / Cmd+K shortcut to open global search.
- Live server queries for properties, units and users.
- Search result navigation into the relevant admin/public record area.
- Admin Dashboard "Needs attention" action queue for pending reservations, payment reviews, open maintenance, and leases expiring within 45 days.

## Preserved
- Existing Admin Units inventory fix.
- Existing server-side pagination.
- Existing Owner Expenses loading/saving implementation.
- Existing database migrations.

## Validation
Run in the project folder:

    npm ci
    npm run build
    npm run lint

No database migration is required for these UI/query additions.
