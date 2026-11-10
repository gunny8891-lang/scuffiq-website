-- ============================================================
-- Lock quote_submissions against the public (anon) key
-- NOT APPLIED. Review, then run in the Supabase SQL editor.
--
-- The anon key ships in js/supabase.js, so anyone can see it. Before this,
-- that key could read every quote (names, emails, phones) and change them.
-- The website and worker do not need anon access to this table: the worker
-- uses the service key, and admin / technician pages sign in first.
-- ============================================================

alter table public.quote_submissions enable row level security;

-- Remove any policy that grants access to the anon or public role
do $$
declare r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'quote_submissions'
      and (roles @> array['anon']::name[] or roles @> array['public']::name[])
  loop
    execute format('drop policy %I on public.quote_submissions', r.policyname);
  end loop;
end $$;

-- Belt and braces: take the table privileges away from anon directly
revoke all on public.quote_submissions from anon;

-- Check afterwards: this should return [] (not customer rows)
--   curl "https://scohjgsjjxbkpfuhlmrz.supabase.co/rest/v1/quote_submissions?select=customer_email&limit=1" \
--     -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
