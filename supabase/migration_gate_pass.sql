-- ============================================================================
-- Job-Work Factory ERP — migration: gate passes
-- Run this file once in the Supabase SQL editor (after schema.sql).
-- Gate passes are the factory gate movement slips for material coming in
-- (inward) or going out (outward): vehicle no, driver, linked challan.
-- ============================================================================

create table if not exists gate_passes (
  id uuid primary key default gen_random_uuid(),
  gp_no text unique not null,
  gp_date date not null,
  type text not null check (type in ('inward', 'outward')),
  vendor_id uuid not null references vendors(id) on delete cascade,
  inward_id uuid references inward_challans(id) on delete set null,
  outward_id uuid references outward_challans(id) on delete set null,
  vehicle_no text,
  driver_name text,
  item_name text not null,
  qty numeric not null check (qty > 0),
  unit text not null default 'pcs',
  purpose text,
  remarks text,
  created_at timestamptz not null default now()
);
create index if not exists gp_vendor_idx on gate_passes (vendor_id);
create index if not exists gp_date_idx on gate_passes (gp_date);

-- Counter backing auto gate-pass numbers (GP-0001, GP-0002, ...).
create table if not exists gate_pass_counter (
  id int primary key,
  next_value int not null default 1,
  constraint gate_pass_counter_single_row check (id = 1)
);
insert into gate_pass_counter (id, next_value)
values (1, 1)
on conflict (id) do nothing;

create or replace function next_gate_pass_no()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v int;
begin
  update gate_pass_counter
     set next_value = next_value + 1
   where id = 1
  returning next_value - 1 into v;
  return 'GP-' || lpad(v::text, 4, '0');
end;
$$;

alter table gate_passes enable row level security;

drop policy if exists "full access for authenticated" on gate_passes;
create policy "full access for authenticated" on gate_passes
  for all to authenticated using (true) with check (true);
