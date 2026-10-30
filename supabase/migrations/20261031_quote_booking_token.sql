-- ============================================================
-- Booking link token on each quote
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
--
-- The booking link in the confirmed-quote email carries this token, so
-- only the customer who received the email can see slots and book.
-- Existing quotes each get their own random token.
-- ============================================================

alter table public.quote_submissions
  add column if not exists booking_token uuid default gen_random_uuid();

create unique index if not exists quote_submissions_booking_token_idx
  on public.quote_submissions (booking_token);
