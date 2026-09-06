-- Phase 9: Universal land & property sales operations
create table if not exists public.sale_listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties(id) on delete cascade,
  listing_code text,
  sale_type text not null default 'property' check (sale_type in ('land','property','development')),
  listing_status text not null default 'draft' check (listing_status in ('draft','active','reserved','sold','withdrawn')),
  asking_price numeric(14,2) not null default 0 check (asking_price >= 0),
  negotiable boolean not null default true,
  reservation_amount numeric(14,2) not null default 0 check (reservation_amount >= 0),
  title_verified boolean not null default false,
  survey_verified boolean not null default false,
  due_diligence_notes text,
  marketing_summary text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sale_listings add column if not exists property_id uuid;
alter table public.sale_listings add column if not exists listing_code text;
alter table public.sale_listings add column if not exists sale_type text not null default 'property';
alter table public.sale_listings add column if not exists listing_status text not null default 'draft';
alter table public.sale_listings add column if not exists asking_price numeric(14,2) not null default 0;
alter table public.sale_listings add column if not exists negotiable boolean not null default true;
alter table public.sale_listings add column if not exists reservation_amount numeric(14,2) not null default 0;
alter table public.sale_listings add column if not exists title_verified boolean not null default false;
alter table public.sale_listings add column if not exists survey_verified boolean not null default false;
alter table public.sale_listings add column if not exists due_diligence_notes text;
alter table public.sale_listings add column if not exists marketing_summary text;
alter table public.sale_listings add column if not exists created_by uuid;
alter table public.sale_listings add column if not exists created_at timestamptz not null default now();
alter table public.sale_listings add column if not exists updated_at timestamptz not null default now();

update public.sale_listings sl set listing_code = 'SALE-' || upper(substr(replace(sl.id::text,'-',''),1,8)) where listing_code is null;
create unique index if not exists sale_listings_code_uidx on public.sale_listings(listing_code);
create index if not exists sale_listings_property_idx on public.sale_listings(property_id, listing_status);
create index if not exists sale_listings_status_idx on public.sale_listings(listing_status, created_at desc);

create table if not exists public.sale_offers (
  id uuid primary key default gen_random_uuid(),
  sale_listing_id uuid not null references public.sale_listings(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_name text,
  buyer_phone text,
  offer_amount numeric(14,2) not null default 0 check (offer_amount >= 0),
  offer_status text not null default 'submitted' check (offer_status in ('submitted','under_review','accepted','rejected','withdrawn')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sale_offers_listing_idx on public.sale_offers(sale_listing_id, created_at desc);
create index if not exists sale_offers_status_idx on public.sale_offers(offer_status, created_at desc);

create table if not exists public.sale_transactions (
  id uuid primary key default gen_random_uuid(),
  sale_listing_id uuid not null references public.sale_listings(id) on delete restrict,
  buyer_id uuid references public.profiles(id) on delete set null,
  buyer_name text,
  buyer_phone text,
  agreed_price numeric(14,2) not null default 0 check (agreed_price >= 0),
  deposit_amount numeric(14,2) not null default 0 check (deposit_amount >= 0),
  transaction_status text not null default 'pending' check (transaction_status in ('pending','deposit_paid','due_diligence','completion_pending','completed','cancelled')),
  completion_date date,
  transfer_reference text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists sale_transactions_listing_idx on public.sale_transactions(sale_listing_id, created_at desc);
create index if not exists sale_transactions_status_idx on public.sale_transactions(transaction_status, created_at desc);

-- Link legacy/partial rows safely where possible.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'sale_listings_property_id_fkey') then
    alter table public.sale_listings add constraint sale_listings_property_id_fkey foreign key (property_id) references public.properties(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sale_listings_sale_type_check') then
    alter table public.sale_listings add constraint sale_listings_sale_type_check check (sale_type in ('land','property','development'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sale_listings_status_check') then
    alter table public.sale_listings add constraint sale_listings_status_check check (listing_status in ('draft','active','reserved','sold','withdrawn'));
  end if;
end $$;

create or replace function public.set_sale_listing_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
drop trigger if exists sale_listings_updated_at on public.sale_listings;
create trigger sale_listings_updated_at before update on public.sale_listings for each row execute function public.set_sale_listing_updated_at();
drop trigger if exists sale_offers_updated_at on public.sale_offers;
create trigger sale_offers_updated_at before update on public.sale_offers for each row execute function public.set_sale_listing_updated_at();
drop trigger if exists sale_transactions_updated_at on public.sale_transactions;
create trigger sale_transactions_updated_at before update on public.sale_transactions for each row execute function public.set_sale_listing_updated_at();

alter table public.sale_listings enable row level security;
alter table public.sale_offers enable row level security;
alter table public.sale_transactions enable row level security;

drop policy if exists sale_listings_select on public.sale_listings;
create policy sale_listings_select on public.sale_listings for select to authenticated using (
  listing_status = 'active' or
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.properties pr where pr.id = sale_listings.property_id and pr.owner_id = auth.uid())
);
drop policy if exists sale_listings_manage on public.sale_listings;
create policy sale_listings_manage on public.sale_listings for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.properties pr where pr.id = sale_listings.property_id and pr.owner_id = auth.uid())
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.properties pr where pr.id = sale_listings.property_id and pr.owner_id = auth.uid())
);

drop policy if exists sale_offers_select on public.sale_offers;
create policy sale_offers_select on public.sale_offers for select to authenticated using (
  buyer_id = auth.uid() or
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.sale_listings sl join public.properties pr on pr.id = sl.property_id where sl.id = sale_offers.sale_listing_id and pr.owner_id = auth.uid())
);
drop policy if exists sale_offers_insert on public.sale_offers;
create policy sale_offers_insert on public.sale_offers for insert to authenticated with check (buyer_id = auth.uid() or buyer_id is null);
drop policy if exists sale_offers_manage on public.sale_offers;
create policy sale_offers_manage on public.sale_offers for update using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.sale_listings sl join public.properties pr on pr.id = sl.property_id where sl.id = sale_offers.sale_listing_id and pr.owner_id = auth.uid())
);

drop policy if exists sale_transactions_select on public.sale_transactions;
create policy sale_transactions_select on public.sale_transactions for select to authenticated using (
  buyer_id = auth.uid() or
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.sale_listings sl join public.properties pr on pr.id = sl.property_id where sl.id = sale_transactions.sale_listing_id and pr.owner_id = auth.uid())
);
drop policy if exists sale_transactions_manage on public.sale_transactions;
create policy sale_transactions_manage on public.sale_transactions for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.sale_listings sl join public.properties pr on pr.id = sl.property_id where sl.id = sale_transactions.sale_listing_id and pr.owner_id = auth.uid())
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') or
  exists (select 1 from public.sale_listings sl join public.properties pr on pr.id = sl.property_id where sl.id = sale_transactions.sale_listing_id and pr.owner_id = auth.uid())
);

do $$ begin
  if to_regprocedure('public.capture_audit_log()') is not null then
    drop trigger if exists sale_listings_audit on public.sale_listings;
    create trigger sale_listings_audit after insert or update or delete on public.sale_listings for each row execute function public.capture_audit_log();
    drop trigger if exists sale_offers_audit on public.sale_offers;
    create trigger sale_offers_audit after insert or update or delete on public.sale_offers for each row execute function public.capture_audit_log();
    drop trigger if exists sale_transactions_audit on public.sale_transactions;
    create trigger sale_transactions_audit after insert or update or delete on public.sale_transactions for each row execute function public.capture_audit_log();
  end if;
end $$;

grant select, insert, update, delete on public.sale_listings, public.sale_offers, public.sale_transactions to authenticated;


create or replace function public.get_sale_operations_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','owner')) then raise exception 'Not authorized'; end if;
  select jsonb_build_object(
    'active_listings', (select count(*) from sale_listings sl join properties p on p.id=sl.property_id where sl.listing_status='active' and (exists(select 1 from profiles x where x.id=auth.uid() and x.role='admin') or p.owner_id=auth.uid())),
    'reserved_listings', (select count(*) from sale_listings sl join properties p on p.id=sl.property_id where sl.listing_status='reserved' and (exists(select 1 from profiles x where x.id=auth.uid() and x.role='admin') or p.owner_id=auth.uid())),
    'sold_listings', (select count(*) from sale_listings sl join properties p on p.id=sl.property_id where sl.listing_status='sold' and (exists(select 1 from profiles x where x.id=auth.uid() and x.role='admin') or p.owner_id=auth.uid())),
    'pending_offers', (select count(*) from sale_offers so join sale_listings sl on sl.id=so.sale_listing_id join properties p on p.id=sl.property_id where so.offer_status in ('submitted','under_review') and (exists(select 1 from profiles x where x.id=auth.uid() and x.role='admin') or p.owner_id=auth.uid())),
    'pipeline_value', coalesce((select sum(st.agreed_price) from sale_transactions st join sale_listings sl on sl.id=st.sale_listing_id join properties p on p.id=sl.property_id where st.transaction_status not in ('completed','cancelled') and (exists(select 1 from profiles x where x.id=auth.uid() and x.role='admin') or p.owner_id=auth.uid())),0)
  ) into r;
  return r;
end $$;
grant execute on function public.get_sale_operations_dashboard() to authenticated;
