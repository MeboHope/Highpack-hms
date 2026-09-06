-- Phase 8: Short-stay / Airbnb-style operations
create extension if not exists pgcrypto;

create table if not exists public.short_stay_listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.property_units(id) on delete set null,
  listing_name text not null,
  listing_code text unique,
  listing_status text not null default 'draft' check (listing_status in ('draft','active','paused','archived')),
  booking_mode text not null default 'entire_place' check (booking_mode in ('entire_place','private_room','shared_space')),
  nightly_rate numeric(14,2) not null default 0 check (nightly_rate >= 0),
  weekend_rate numeric(14,2) not null default 0 check (weekend_rate >= 0),
  cleaning_fee numeric(14,2) not null default 0 check (cleaning_fee >= 0),
  security_deposit numeric(14,2) not null default 0 check (security_deposit >= 0),
  service_fee_percent numeric(5,2) not null default 0 check (service_fee_percent between 0 and 100),
  minimum_nights integer not null default 1 check (minimum_nights between 1 and 365),
  maximum_nights integer not null default 30 check (maximum_nights between 1 and 365),
  max_guests integer not null default 2 check (max_guests between 1 and 100),
  check_in_time time not null default '14:00',
  check_out_time time not null default '10:00',
  house_rules text,
  cancellation_policy text,
  direct_booking_enabled boolean not null default true,
  channel_airbnb boolean not null default false,
  channel_booking_com boolean not null default false,
  channel_expedia boolean not null default false,
  channel_vrbo boolean not null default false,
  external_listing_ref text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.short_stay_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.short_stay_listings(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.property_units(id) on delete set null,
  guest_id uuid references public.profiles(id) on delete set null,
  guest_name text not null,
  guest_phone text,
  guest_email text,
  channel text not null default 'direct' check (channel in ('direct','airbnb','booking_com','expedia','vrbo','other')),
  external_booking_ref text,
  check_in date not null,
  check_out date not null,
  guests integer not null default 1 check (guests > 0),
  nights integer generated always as (greatest(1, (check_out - check_in))) stored,
  nightly_rate numeric(14,2) not null default 0,
  cleaning_fee numeric(14,2) not null default 0,
  taxes numeric(14,2) not null default 0,
  service_fee numeric(14,2) not null default 0,
  total_amount numeric(14,2) not null default 0,
  amount_paid numeric(14,2) not null default 0,
  status text not null default 'pending' check (status in ('pending','confirmed','checked_in','checked_out','cancelled','no_show')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','partial','paid','refunded')),
  special_requests text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (check_out > check_in)
);

create table if not exists public.short_stay_rate_calendar (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.short_stay_listings(id) on delete cascade,
  stay_date date not null,
  nightly_rate numeric(14,2) not null check (nightly_rate >= 0),
  minimum_nights integer not null default 1 check (minimum_nights between 1 and 365),
  available boolean not null default true,
  closed_for_arrival boolean not null default false,
  closed_for_departure boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(listing_id, stay_date)
);

create table if not exists public.short_stay_turnovers (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references public.short_stay_bookings(id) on delete cascade,
  listing_id uuid not null references public.short_stay_listings(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','assigned','in_progress','completed','cancelled')),
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Compatibility repair: if this migration was previously attempted against a partially-created
-- short-stay table, ensure the relationship columns exist before indexes/policies are created.
alter table if exists public.short_stay_listings
  add column if not exists property_id uuid;
alter table if exists public.short_stay_bookings
  add column if not exists property_id uuid;

-- Add the foreign keys only when they are not already present.
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
create index if not exists idx_short_stay_listings_status on public.short_stay_listings(listing_status);
create index if not exists idx_short_stay_bookings_dates on public.short_stay_bookings(listing_id, check_in, check_out);
create index if not exists idx_short_stay_bookings_status on public.short_stay_bookings(status);
create index if not exists idx_short_stay_rates_date on public.short_stay_rate_calendar(listing_id, stay_date);
create index if not exists idx_short_stay_turnovers_date on public.short_stay_turnovers(scheduled_for, status);

create or replace function public.set_short_stay_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_short_stay_listings_updated_at on public.short_stay_listings;
create trigger trg_short_stay_listings_updated_at before update on public.short_stay_listings for each row execute function public.set_short_stay_updated_at();
drop trigger if exists trg_short_stay_bookings_updated_at on public.short_stay_bookings;
create trigger trg_short_stay_bookings_updated_at before update on public.short_stay_bookings for each row execute function public.set_short_stay_updated_at();
drop trigger if exists trg_short_stay_rates_updated_at on public.short_stay_rate_calendar;
create trigger trg_short_stay_rates_updated_at before update on public.short_stay_rate_calendar for each row execute function public.set_short_stay_updated_at();
drop trigger if exists trg_short_stay_turnovers_updated_at on public.short_stay_turnovers;
create trigger trg_short_stay_turnovers_updated_at before update on public.short_stay_turnovers for each row execute function public.set_short_stay_updated_at();

alter table public.short_stay_listings enable row level security;
alter table public.short_stay_bookings enable row level security;
alter table public.short_stay_rate_calendar enable row level security;
alter table public.short_stay_turnovers enable row level security;

grant select, insert, update, delete on public.short_stay_listings to authenticated;
grant select, insert, update, delete on public.short_stay_bookings to authenticated;
grant select, insert, update, delete on public.short_stay_rate_calendar to authenticated;
grant select, insert, update, delete on public.short_stay_turnovers to authenticated;

drop policy if exists short_stay_listings_admin on public.short_stay_listings;
create policy short_stay_listings_admin on public.short_stay_listings for all to authenticated using ((select role from public.profiles where id=auth.uid())='admin') with check ((select role from public.profiles where id=auth.uid())='admin');
drop policy if exists short_stay_listings_owner on public.short_stay_listings;
create policy short_stay_listings_owner on public.short_stay_listings for all to authenticated using (exists (select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists (select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));

drop policy if exists short_stay_bookings_admin on public.short_stay_bookings;
create policy short_stay_bookings_admin on public.short_stay_bookings for all to authenticated using ((select role from public.profiles where id=auth.uid())='admin') with check ((select role from public.profiles where id=auth.uid())='admin');
drop policy if exists short_stay_bookings_owner on public.short_stay_bookings;
create policy short_stay_bookings_owner on public.short_stay_bookings for all to authenticated using (exists (select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid())) with check (exists (select 1 from public.properties p where p.id=property_id and p.owner_id=auth.uid()));
drop policy if exists short_stay_bookings_guest on public.short_stay_bookings;
create policy short_stay_bookings_guest on public.short_stay_bookings for select to authenticated using (guest_id=auth.uid());

drop policy if exists short_stay_rates_admin on public.short_stay_rate_calendar;
create policy short_stay_rates_admin on public.short_stay_rate_calendar for all to authenticated using ((select role from public.profiles where id=auth.uid())='admin') with check ((select role from public.profiles where id=auth.uid())='admin');
drop policy if exists short_stay_rates_owner on public.short_stay_rate_calendar;
create policy short_stay_rates_owner on public.short_stay_rate_calendar for all to authenticated using (exists (select 1 from public.short_stay_listings l join public.properties p on p.id=l.property_id where l.id=listing_id and p.owner_id=auth.uid())) with check (exists (select 1 from public.short_stay_listings l join public.properties p on p.id=l.property_id where l.id=listing_id and p.owner_id=auth.uid()));

drop policy if exists short_stay_turnovers_admin on public.short_stay_turnovers;
create policy short_stay_turnovers_admin on public.short_stay_turnovers for all to authenticated using ((select role from public.profiles where id=auth.uid())='admin') with check ((select role from public.profiles where id=auth.uid())='admin');
drop policy if exists short_stay_turnovers_owner on public.short_stay_turnovers;
create policy short_stay_turnovers_owner on public.short_stay_turnovers for all to authenticated using (exists (select 1 from public.short_stay_listings l join public.properties p on p.id=l.property_id where l.id=listing_id and p.owner_id=auth.uid())) with check (exists (select 1 from public.short_stay_listings l join public.properties p on p.id=l.property_id where l.id=listing_id and p.owner_id=auth.uid()));

-- Useful dashboard summary for admin/owners.
create or replace function public.get_short_stay_dashboard(p_owner_id uuid default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare v_role text; v_total integer; v_active integer; v_bookings integer; v_revenue numeric;
begin
 select role into v_role from profiles where id=auth.uid();
 if v_role not in ('admin','owner','agent') then raise exception 'Not authorized'; end if;
 select count(*) into v_total from short_stay_listings l join properties p on p.id=l.property_id where (v_role='admin' or p.owner_id=auth.uid()) and (p_owner_id is null or p.owner_id=p_owner_id);
 select count(*) into v_active from short_stay_listings l join properties p on p.id=l.property_id where l.listing_status='active' and (v_role='admin' or p.owner_id=auth.uid()) and (p_owner_id is null or p.owner_id=p_owner_id);
 select count(*) into v_bookings from short_stay_bookings b join properties p on p.id=b.property_id where b.status in ('pending','confirmed','checked_in') and (v_role='admin' or p.owner_id=auth.uid()) and (p_owner_id is null or p.owner_id=p_owner_id);
 select coalesce(sum(b.total_amount),0) into v_revenue from short_stay_bookings b join properties p on p.id=b.property_id where b.status in ('confirmed','checked_in','checked_out') and b.created_at >= date_trunc('month', current_date) and (v_role='admin' or p.owner_id=auth.uid()) and (p_owner_id is null or p.owner_id=p_owner_id);
 return jsonb_build_object('listings',v_total,'active_listings',v_active,'upcoming_bookings',v_bookings,'month_revenue',v_revenue);
end; $$;
grant execute on function public.get_short_stay_dashboard(uuid) to authenticated;
