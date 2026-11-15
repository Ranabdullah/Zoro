-- Apply after session-security.sql. The historical function name is retained
-- for compatibility with builds that already call it.
begin;
create or replace function public.kora_invited() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u
    where u.id = (select auth.uid())
      and u.email is not null and u.email_confirmed_at is not null
  );
$$;

-- Remove the invitation check even before the dashboard hook is disabled.
create or replace function public.kora_before_signup(event jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select '{}'::jsonb;
$$;
commit;
