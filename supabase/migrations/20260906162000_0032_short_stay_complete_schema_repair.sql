-- Phase 8 repair 0032: complete short-stay schema compatibility repair.
-- Use this after a previous partial short-stay migration attempt.
-- Adds every application-required column without deleting existing data.

create extension if not exists pgcrypto;

-- Listings table
create table if not exists public.short_stay_listings (
  id uuid primary key default gen_random_uuid()
);

alter table public.short_stay_listings add column if not exists property_id uuid;
alter table public.short_stay_listings add column if not exists unit_id uuid;
alter table public.short_stay_listings add column if not exists listing_name text;
alter table public.short_stay_listings add column if not exists listing_code text;
alter table public.short_stay_listings add column if not exists listing_status text default 'draft';
alter table public.short_stay_listings add column if not exists booking_mode text default 'entire_place';
alter table public.short_stay_listings add column if not exists nightly_rate numeric(14,2) default 0;
alter table public.short_stay_listings add column if not exists weekend_rate numeric(14,2) default 0;
alter table public.short_stay_listings add column if not exists cleaning_fee numeric(14,2) default 0;
alter table public.short_stay_listings add column if not exists security_deposit numeric(14,2) default 0;
alter table public.short_stay_listings add column if not exists service_fee_percent numeric(5,2) default 0;
alter table public.short_stay_listings add column if not exists minimum_nights integer default 1;
alter table public.short_stay_listings add column if not exists maximum_nights integer default 30;
alter table public.short_stay_listings add column if not exists max_guests integer default 2;
alter table public.short_stay_listings add column if not exists check_in_time time default '14:00';
alter table public.short_stay_listings add column if not exists check_out_time time default '10:00';
alter table public.short_stay_listings add column if not exists house_rules text;
alter table public.short_stay_listings add column if not exists cancellation_policy text;
alter table public.short_stay_listings add column if not exists direct_booking_enabled boolean default true;
alter table public.short_stay_listings add column if not exists channel_airbnb boolean default false;
alter table public.short_stay_listings add column if not exists channel_booking_com boolean default false;
alter table public.short_stay_listings add column if not exists channel_expedia boolean default false;
alter table public.short_stay_listings add column if not exists channel_vrbo boolean default false;
alter table public.short_stay_listings add column if not exists external_listing_ref text;
alter table public.short_stay_listings add column if not exists created_by uuid;
alter table public.short_stay_listings add column if not exists created_at timestamptz default now();
alter table public.short_stay_listings add column if not exists updated_at timestamptz default now();

-- Make pre-existing partial rows valid for the application.
update public.short_stay_listings set listing_name = coalesce(nullif(listing_name,''), 'Short-stay listing') where listing_name is null or listing_name='';
update public.short_stay_listings set listing_status = coalesce(listing_status,'draft'), booking_mode=coalesce(booking_mode,'entire_place'), nightly_rate=coalesce(nightly_rate,0), weekend_rate=coalesce(weekend_rate,0), cleaning_fee=coalesce(cleaning_fee,0), security_deposit=coalesce(security_deposit,0), service_fee_percent=coalesce(service_fee_percent,0), minimum_nights=coalesce(minimum_nights,1), maximum_nights=coalesce(maximum_nights,30), max_guests=coalesce(max_guests,2), check_in_time=coalesce(check_in_time,'14:00'), check_out_time=coalesce(check_out_time,'10:00'), direct_booking_enabled=coalesce(direct_booking_enabled,true), channel_airbnb=coalesce(channel_airbnb,false), channel_booking_com=coalesce(channel_booking_com,false), channel_expedia=coalesce(channel_expedia,false), channel_vrbo=coalesce(channel_vrbo,false), created_at=coalesce(created_at,now()), updated_at=coalesce(updated_at,now());

-- Generate codes for old rows that don't have one.
update public.short_stay_listings
set listing_code = 'ST-' || upper(substr(replace(id::text,'-',''),1,10))
where listing_code is null or listing_code='';

create unique index if not exists idx_short_stay_listings_code_unique on public.short_stay_listings(listing_code) where listing_code is not null;

-- Bookings table
create table if not exists public.short_stay_bookings (
  id uuid primary key default gen_random_uuid()
);
alter table public.short_stay_bookings add column if not exists listing_id uuid;
alter table public.short_stay_bookings add column if not exists property_id uuid;
alter table public.short_stay_bookings add column if not exists unit_id uuid;
alter table public.short_stay_bookings add column if not exists guest_id uuid;
alter table public.short_stay_bookings add column if not exists guest_name text;
alter table public.short_stay_bookings add column if not exists guest_phone text;
alter table public.short_stay_bookings add column if not exists guest_email text;
alter table public.short_stay_bookings add column if not exists channel text default 'direct';
alter table public.short_stay_bookings add column if not exists external_booking_ref text;
alter table public.short_stay_bookings add column if not exists check_in date;
alter table public.short_stay_bookings add column if not exists check_out date;
alter table public.short_stay_bookings add column if not exists guests integer default 1;
alter table public.short_stay_bookings add column if not exists nights integer;
alter table public.short_stay_bookings add column if not exists nightly_rate numeric(14,2) default 0;
alter table public.short_stay_bookings add column if not exists cleaning_fee numeric(14,2) default 0;
alter table public.short_stay_bookings add column if not exists taxes numeric(14,2) default 0;
alter table public.short_stay_bookings add column if not exists service_fee numeric(14,2) default 0;
alter table public.short_stay_bookings add column if not exists total_amount numeric(14,2) default 0;
alter table public.short_stay_bookings add column if not exists amount_paid numeric(14,2) default 0;
alter table public.short_stay_bookings add column if not exists status text default 'pending';
alter table public.short_stay_bookings add column if not exists payment_status text default 'unpaid';
alter table public.short_stay_bookings add column if not exists special_requests text;
alter table public.short_stay_bookings add column if not exists created_by uuid;
alter table public.short_stay_bookings add column if not exists created_at timestamptz default now();
alter table public.short_stay_bookings add column if not exists updated_at timestamptz default now();

-- Backfill only fields that can be safely derived.
update public.short_stay_bookings set guests=coalesce(guests,1), nightly_rate=coalesce(nightly_rate,0), cleaning_fee=coalesce(cleaning_fee,0), taxes=coalesce(taxes,0), service_fee=coalesce(service_fee,0), total_amount=coalesce(total_amount,0), amount_paid=coalesce(amount_paid,0), channel=coalesce(channel,'direct'), status=coalesce(status,'pending'), payment_status=coalesce(payment_status,'unpaid'), created_at=coalesce(created_at,now()), updated_at=coalesce(updated_at,now()) where true;

-- Keep application reads working even where a legacy table did not have generated nights.
update public.short_stay_bookings set nights = greatest(1, check_out-check_in) where nights is null and check_in is not null and check_out is not null;

-- Rate calendar and turnovers may also have been partially created.
create table if not exists public.short_stay_rate_calendar (id uuid primary key default gen_random_uuid());
alter table public.short_stay_rate_calendar add column if not exists listing_id uuid;
alter table public.short_stay_rate_calendar add column if not exists stay_date date;
alter table public.short_stay_rate_calendar add column if not exists nightly_rate numeric(14,2) default 0;
alter table public.short_stay_rate_calendar add column if not exists minimum_nights integer default 1;
alter table public.short_stay_rate_calendar add column if not exists available boolean default true;
alter table public.short_stay_rate_calendar add column if not exists closed_for_arrival boolean default false;
alter table public.short_stay_rate_calendar add column if not exists closed_for_departure boolean default false;
alter table public.short_stay_rate_calendar add column if not exists created_at timestamptz default now();
alter table public.short_stay_rate_calendar add column if not exists updated_at timestamptz default now();

create table if not exists public.short_stay_turnovers (id uuid primary key default gen_random_uuid());
alter table public.short_stay_turnovers add column if not exists booking_id uuid;
alter table public.short_stay_turnovers add column if not exists listing_id uuid;
alter table public.short_stay_turnovers add column if not exists scheduled_for timestamptz;
alter table public.short_stay_turnovers add column if not exists status text default 'pending';
alter table public.short_stay_turnovers add column if not exists assigned_to uuid;
alter table public.short_stay_turnovers add column if not exists notes text;
alter table public.short_stay_turnovers add column if not exists created_at timestamptz default now();
alter table public.short_stay_turnovers add column if not exists updated_at timestamptz default now();

-- Relationship constraints, only when absent.
do $$
begin
  if not exists (select 1 from pg_constraint where conname='short_stay_listings_property_id_fkey') then
    alter table public.short_stay_listings add constraint short_stay_listings_property_id_fkey foreign key(property_id) references public.properties(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='short_stay_listings_unit_id_fkey') then
    alter table public.short_stay_listings add constraint short_stay_listings_unit_id_fkey foreign key(unit_id) references public.property_units(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname='short_stay_bookings_listing_id_fkey') then
    alter table public.short_stay_bookings add constraint short_stay_bookings_listing_id_fkey foreign key(listing_id) references public.short_stay_listings(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname='short_stay_bookings_property_id_fkey') then
    alter table public.short_stay_bookings add constraint short_stay_bookings_property_id_fkey foreign key(property_id) references public.properties(id) on delete cascade;
  end if;
end $$;

create index if not exists idx_short_stay_listings_property on public.short_stay_listings(property_id);
create index if not exists idx_short_stay_listings_status on public.short_stay_listings(listing_status);
create index if not exists idx_short_stay_bookings_property on public.short_stay_bookings(property_id);
create index if not exists idx_short_stay_bookings_dates on public.short_stay_bookings(listing_id,check_in,check_out);
create index if not exists idx_short_stay_rates_date on public.short_stay_rate_calendar(listing_id,stay_date);
create index if not exists idx_short_stay_turnovers_date on public.short_stay_turnovers(scheduled_for,status);

-- Required privileges; RLS remains responsible for row-level access.
grant select,insert,update,delete on public.short_stay_listings to authenticated;
grant select,insert,update,delete on public.short_stay_bookings to authenticated;
grant select,insert,update,delete on public.short_stay_rate_calendar to authenticated;
grant select,insert,update,delete on public.short_stay_turnovers to authenticated;
