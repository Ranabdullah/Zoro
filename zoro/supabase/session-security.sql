-- Run after access-hardening.sql.
begin;
create or replace function public.kora_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and public.kora_invited()
    and exists (
      select 1 from auth.sessions s where s.user_id = (select auth.uid())
      and s.id::text = (select auth.jwt()->>'session_id')
      and (s.not_after is null or s.not_after > now())
    );
$$;

create or replace function public.kora_sessions()
returns table (started_at timestamptz, last_refresh timestamptz, browser_agent text, is_current boolean)
language sql stable security definer set search_path = '' as $$
  select s.created_at, s.refreshed_at, left(s.user_agent, 240),
         s.id::text = (select auth.jwt()->>'session_id')
  from auth.sessions s
  where public.kora_allowed() and s.user_id = (select auth.uid())
    and (s.not_after is null or s.not_after > now())
    and s.aal::text = 'aal2'
  order by s.created_at desc;
$$;
revoke all on function public.kora_sessions() from public, anon;
grant execute on function public.kora_sessions() to authenticated;
commit;
