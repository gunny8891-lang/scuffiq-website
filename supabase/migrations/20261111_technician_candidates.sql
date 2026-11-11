-- ============================================================
-- Technician candidates: people we may invite to join ScuffIQ
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
-- Only the signed-in admin (hello@scuffiq.com) can read or change these rows.
-- ============================================================

create table if not exists public.technician_candidates (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  name        text,
  business    text,
  area        text,
  postcode    text,
  email       text,
  phone       text,
  source      text,
  status      text not null default 'to_contact'
              check (status in ('to_contact','invited','applied','vetted','onboarded','declined')),
  notes       text
);

alter table public.technician_candidates enable row level security;

create policy "admin manages technician candidates"
  on public.technician_candidates
  for all
  to authenticated
  using ((auth.jwt() ->> 'email') = 'hello@scuffiq.com')
  with check ((auth.jwt() ->> 'email') = 'hello@scuffiq.com');
