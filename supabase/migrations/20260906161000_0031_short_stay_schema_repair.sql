-- Phase 8 repair: makes the short-stay migration safe to rerun after a partial attempt.
-- Run this if 0030 previously failed with: column "property_id" does not exist.

alter table if exists public.short_stay_listings
  add column if not exists property_id uuid;
alter table if exists public.short_stay_bookings
  add column if not exists property_id uuid;

do $$
begin
  if to_regclass('public.short_stay_listings') is not null
     and not exists (select 1 from pg_constraint where conname = 'short_stay_listings_property_id_fkey') then
    alter table public.short_stay_listings
      add constraint short_stay_listings_property_id_fkey
      foreign key (property_id) references public.properties(id) on delete cascade;
  end if;
  if to_regclass('public.short_stay_bookings') is not null
     and not exists (select 1 from pg_constraint where conname = 'short_stay_bookings_property_id_fkey') then
    alter table public.short_stay_bookings
      add constraint short_stay_bookings_property_id_fkey
      foreign key (property_id) references public.properties(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_short_stay_listings_property on public.short_stay_listings(property_id);
create index if not exists idx_short_stay_bookings_property on public.short_stay_bookings(property_id);
