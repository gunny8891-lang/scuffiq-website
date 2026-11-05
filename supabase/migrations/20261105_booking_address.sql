-- ============================================================
-- Booking address and parking confirmation
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
-- ============================================================

alter table public.bookings
  add column if not exists address text,
  add column if not exists parking_confirmed boolean not null default false;
