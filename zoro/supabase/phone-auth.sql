-- Optional phone sign-in still requires TOTP and a valid session before wallet access.
create or replace function public.kora_invited() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u where u.id=(select auth.uid())
    and ((u.email is not null and u.email_confirmed_at is not null)
      or (u.phone is not null and u.phone_confirmed_at is not null)));
$$;
