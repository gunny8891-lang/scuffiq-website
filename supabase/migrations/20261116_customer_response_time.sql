-- ============================================================
-- When a response was last sent to the customer from admin
-- NOT APPLIED. Run this BEFORE deploying the worker and admin changes.
-- ============================================================

alter table public.quote_submissions
  add column if not exists customer_response_at timestamptz,
  add column if not exists customer_response_type text;
