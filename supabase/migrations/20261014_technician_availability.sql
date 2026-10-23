-- ============================================================
-- Technician availability (manual hours + block-out dates)
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
-- technician_id is the technician's Supabase Auth user id.
-- ============================================================

create table if not exists public.technician_availability (
  id            uuid primary key default gen_random_uuid(),
  technician_id uuid not null references auth.users (id) on delete cascade,
  weekday       smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time    time not null,
  end_time      time not null,
  created_at    timestamptz not null default now(),
  check (end_time > start_time)
);

create table if not exists public.technician_block_outs (
  id            uuid primary key default gen_random_uuid(),
  technician_id uuid not null references auth.users (id) on delete cascade,
  block_date    date not null,
  note          text,
  created_at    timestamptz not null default now(),
  unique (technician_id, block_date)
);

create index if not exists technician_availability_tech_idx
  on public.technician_availability (technician_id);
create index if not exists technician_block_outs_tech_idx
  on public.technician_block_outs (technician_id, block_date);

-- Row Level Security: a signed-in technician can only see and change their own rows.
-- The publishable key with no session gets no access.
alter table public.technician_availability enable row level security;
alter table public.technician_block_outs   enable row level security;

create policy "technicians manage own weekly hours"
  on public.technician_availability
  for all
  to authenticated
  using (technician_id = auth.uid())
  with check (technician_id = auth.uid());

create policy "technicians manage own block-outs"
  on public.technician_block_outs
  for all
  to authenticated
  using (technician_id = auth.uid())
  with check (technician_id = auth.uid());
