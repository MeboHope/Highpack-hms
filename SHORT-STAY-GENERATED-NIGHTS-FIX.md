# Short-Stay Generated `nights` Fix

The short-stay booking schema may define `short_stay_bookings.nights` as a PostgreSQL `GENERATED ALWAYS` column.

A previous compatibility migration attempted to update that column and PostgreSQL correctly rejected it with:

`column "nights" can only be updated to DEFAULT`

The corrected migrations now detect whether `nights` is generated. Generated columns are left untouched because PostgreSQL calculates them automatically from `check_in` and `check_out`. Legacy installations with an ordinary `nights` column are safely backfilled.

## What to do

1. Replace the previous Phase 9 project with this corrected package.
2. If you manually ran migration `0034` and it failed, run the corrected `0034` again in the Supabase SQL editor.
3. Do not manually update `short_stay_bookings.nights`.
4. After the migration completes, refresh the Supabase schema cache and reload the application.
