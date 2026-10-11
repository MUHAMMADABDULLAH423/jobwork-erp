-- ============================================================================
-- Job-Work Factory ERP — database schema (single tenant)
-- Run this file once in the Supabase SQL editor (or via the Supabase CLI).
-- ============================================================================

-- UUID generation
create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Vendors — the fixed vendors who send material for job-work processing
-- ----------------------------------------------------------------------------
create table if not exists vendors (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Rate cards — Abdull's FIXED rate per (vendor, item, process).
-- Editable from the Vendors page. The rate is SNAPSHOT onto each outward
-- challan line at entry time, so later rate changes never alter old bills.
-- ----------------------------------------------------------------------------
create table if not exists rate_cards (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  item_name text not null,
  process_name text not null,
  rate numeric not null check (rate >= 0),
  unit text not null default 'pcs',
  updated_at timestamptz not null default now(),
  unique (vendor_id, item_name, process_name)
);
create index if not exists rate_cards_vendor_idx on rate_cards (vendor_id);

-- ----------------------------------------------------------------------------
-- Inward challans — material RECEIVED from a vendor with THEIR challan number.
-- status: pending (nothing returned yet) → partial → completed.
-- ----------------------------------------------------------------------------
create table if not exists inward_challans (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  vendor_challan_no text not null,
  challan_date date not null,
  item_name text not null,
  qty numeric not null check (qty > 0),
  unit text not null default 'pcs',
  process_required text not null,
  status text not null default 'pending'
    check (status in ('pending', 'partial', 'completed')),
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists inward_vendor_idx on inward_challans (vendor_id);
create index if not exists inward_date_idx on inward_challans (challan_date);
create index if not exists inward_status_idx on inward_challans (status);

-- ----------------------------------------------------------------------------
-- Challan counter — single row backing the auto-generated outward challan
-- numbers (JW-0001, JW-0002, ...). next_challan_no() increments it
-- transactionally, so concurrent users never get the same number.
-- ----------------------------------------------------------------------------
create table if not exists challan_counter (
  id int primary key,
  next_value int not null default 1,
  constraint challan_counter_single_row check (id = 1)
);
insert into challan_counter (id, next_value)
values (1, 1)
on conflict (id) do nothing;

create or replace function next_challan_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
begin
  update challan_counter
     set next_value = next_value + 1
   where id = 1
  returning next_value - 1 into v;
  return 'JW-' || lpad(v::text, 4, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- Outward challans — OUR challan issued to the vendor after the work is done.
-- rate is a SNAPSHOT taken from the rate card at entry time.
-- amount is always kept = qty * rate by the trigger below.
-- ----------------------------------------------------------------------------
create table if not exists outward_challans (
  id uuid primary key default gen_random_uuid(),
  challan_no text unique not null,
  vendor_id uuid not null references vendors(id) on delete cascade,
  inward_id uuid references inward_challans(id) on delete set null,
  challan_date date not null,
  vendor_challan_ref text,
  item_name text not null,
  qty numeric not null check (qty > 0),
  unit text not null default 'pcs',
  process_done text not null,
  rate numeric not null check (rate >= 0),
  amount numeric not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists outward_vendor_idx on outward_challans (vendor_id);
create index if not exists outward_date_idx on outward_challans (challan_date);
create index if not exists outward_inward_idx on outward_challans (inward_id);

-- Keep amount = qty * rate on every insert/update (single source of truth).
create or replace function set_outward_amount()
returns trigger
language plpgsql
as $$
begin
  NEW.amount := round(NEW.qty * NEW.rate, 2);
  return NEW;
end;
$$;

drop trigger if exists trg_outward_amount on outward_challans;
create trigger trg_outward_amount
before insert or update of qty, rate on outward_challans
for each row execute function set_outward_amount();

-- Keep the linked inward challan's status in sync with outward entries:
-- no outward qty  -> 'pending', total outward >= inward qty -> 'completed',
-- otherwise 'partial'. Handles inserts, updates, deletes and link changes.
create or replace function sync_inward_status()
returns trigger
language plpgsql
as $$
declare
  target_id uuid;
  total_out numeric;
  required_qty numeric;
begin
  for target_id in
    select distinct x.iid
      from (
        select NEW.inward_id as iid where TG_OP in ('INSERT', 'UPDATE')
        union
        select OLD.inward_id as iid where TG_OP in ('UPDATE', 'DELETE')
      ) x
     where x.iid is not null
  loop
    select coalesce(sum(o.qty), 0), i.qty
      into total_out, required_qty
      from inward_challans i
      left join outward_challans o on o.inward_id = i.id
     where i.id = target_id
     group by i.qty;

    if required_qty is not null then
      update inward_challans
         set status = case
                        when total_out <= 0 then 'pending'
                        when total_out >= required_qty then 'completed'
                        else 'partial'
                      end
       where id = target_id;
    end if;
  end loop;

  if TG_OP = 'DELETE' then
    return OLD;
  else
    return NEW;
  end if;
end;
$$;

drop trigger if exists trg_sync_inward_status on outward_challans;
create trigger trg_sync_inward_status
after insert or update of inward_id, qty or delete on outward_challans
for each row execute function sync_inward_status();

-- ----------------------------------------------------------------------------
-- Month bills — per-vendor, per-month billing snapshots.
-- draft  → lines are recomputed live from outward_challans on every view/save
--          (late entries get picked up automatically).
-- final  → the lines snapshot is frozen and shown as-is.
-- ----------------------------------------------------------------------------
create table if not exists month_bills (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references vendors(id) on delete cascade,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  total_qty numeric not null default 0,
  total_amount numeric not null default 0,
  status text not null default 'draft'
    check (status in ('draft', 'final')),
  lines jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (vendor_id, month)
);
create index if not exists month_bills_vendor_idx on month_bills (vendor_id);

-- ----------------------------------------------------------------------------
-- Row Level Security — single-tenant app: any authenticated user gets full
-- access to every table. (No tenant_id column needed.)
-- ----------------------------------------------------------------------------
alter table vendors enable row level security;
alter table rate_cards enable row level security;
alter table inward_challans enable row level security;
alter table outward_challans enable row level security;
alter table month_bills enable row level security;

drop policy if exists "full access for authenticated" on vendors;
create policy "full access for authenticated" on vendors
  for all to authenticated using (true) with check (true);

drop policy if exists "full access for authenticated" on rate_cards;
create policy "full access for authenticated" on rate_cards
  for all to authenticated using (true) with check (true);

drop policy if exists "full access for authenticated" on inward_challans;
create policy "full access for authenticated" on inward_challans
  for all to authenticated using (true) with check (true);

drop policy if exists "full access for authenticated" on outward_challans;
create policy "full access for authenticated" on outward_challans
  for all to authenticated using (true) with check (true);

drop policy if exists "full access for authenticated" on month_bills;
create policy "full access for authenticated" on month_bills
  for all to authenticated using (true) with check (true);
