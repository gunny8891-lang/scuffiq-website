-- ============================================================
-- Deposits paid through a quote's payment link
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
-- Lets the balance after the job be the full price minus the deposit.
-- ============================================================

alter table public.quote_submissions
  add column if not exists deposit_paid_pence integer not null default 0;
