-- Apply after schema.sql, then enable public.kora_before_signup as the
-- Before User Created hook in Supabase Authentication.
begin;
create or replace function public.kora_invited() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u join kora_private.allowed_emails a
    on a.email = lower(u.email)
    where u.id = (select auth.uid()) and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.kora_invited() from public, anon;
grant execute on function public.kora_invited() to authenticated;

create or replace function public.kora_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and public.kora_invited();
$$;
revoke all on function public.kora_allowed() from public, anon;
grant execute on function public.kora_allowed() to authenticated;

create or replace function public.kora_before_signup(event jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when exists (
    select 1 from kora_private.allowed_emails
    where email = lower(event->'user'->>'email')
  ) then '{}'::jsonb
  else '{"error":{"http_code":403,"message":"Registration requires an invitation."}}'::jsonb end;
$$;
revoke all on function public.kora_before_signup(jsonb) from public, anon, authenticated;
grant execute on function public.kora_before_signup(jsonb) to supabase_auth_admin;
commit;
