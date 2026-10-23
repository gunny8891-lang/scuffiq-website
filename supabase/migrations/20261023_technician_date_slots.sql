-- ============================================================
-- Technician availability by specific date (AM / PM)
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
-- A row here means the technician is free that half-day on that date.
-- ============================================================

create table if not exists public.technician_date_slots (
  id            uuid primary key default gen_random_uuid(),
  technician_id uuid not null references auth.users (id) on delete cascade,
  slot_date     date not null,
  period        text not null check (period in ('am', 'pm')),
  created_at    timestamptz not null default now(),
  unique (technician_id, slot_date, period)
);

create index if not exists technician_date_slots_tech_idx
  on public.technician_date_slots (technician_id, slot_date);

alter table public.technician_date_slots enable row level security;

create policy "technicians manage own date slots"
  on public.technician_date_slots
  for all
  to authenticated
  using (technician_id = auth.uid())
  with check (technician_id = auth.uid());
