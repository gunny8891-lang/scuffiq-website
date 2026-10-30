-- ============================================================
-- Customer booking: open slots, bookings and date requests
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
--
-- Access: customers never read these tables directly. The quote
-- worker reads and writes them with the service role key (kept as a
-- Cloudflare secret). Row Level Security is on with no public policies,
-- so the publishable key in the browser can't see or change any rows.
-- ============================================================

-- Half-day slots you set as available, e.g. 2026-11-04 AM.
create table if not exists public.booking_slots (
  id         uuid primary key default gen_random_uuid(),
  slot_date  date not null,
  period     text not null check (period in ('am', 'pm')),
  status     text not null default 'open' check (status in ('open', 'held', 'booked', 'closed')),
  created_at timestamptz not null default now(),
  unique (slot_date, period)
);

-- A customer's booking for one slot, tied to their quote.
create table if not exists public.bookings (
  id                uuid primary key default gen_random_uuid(),
  quote_id          uuid references public.quote_submissions (id) on delete set null,
  slot_id           uuid not null references public.booking_slots (id),
  status            text not null default 'pending_payment'
                      check (status in ('pending_payment', 'paid', 'cancelled', 'no_show')),
  customer_name     text not null,
  customer_email    text not null,
  customer_phone    text,
  deposit_pence     integer not null check (deposit_pence >= 0),
  stripe_session_id text,
  stripe_payment_id text,
  created_at        timestamptz not null default now(),
  cancelled_at      timestamptz
);

create index if not exists bookings_quote_idx on public.bookings (quote_id);
create index if not exists bookings_slot_idx on public.bookings (slot_id);

-- A customer asks for a date that isn't shown. No payment is taken.
create table if not exists public.booking_requests (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid references public.quote_submissions (id) on delete set null,
  requested_date  date not null,
  period          text check (period in ('am', 'pm')),
  note            text,
  status          text not null default 'new' check (status in ('new', 'confirmed', 'declined')),
  created_at      timestamptz not null default now()
);

alter table public.booking_slots    enable row level security;
alter table public.bookings         enable row level security;
alter table public.booking_requests enable row level security;
