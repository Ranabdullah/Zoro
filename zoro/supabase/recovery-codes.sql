begin;
create table if not exists kora_private.recovery_codes (
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null, primary key(user_id,code_hash)
);
create table if not exists kora_private.recovery_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  failures integer not null default 0, blocked_until timestamptz
);
revoke all on kora_private.recovery_codes,kora_private.recovery_limits from public,anon,authenticated;
create or replace function public.zoro_generate_recovery_codes() returns setof text
language plpgsql security definer set search_path='' as $$
declare code text;
begin
  if not public.kora_allowed() then raise exception 'Approved authenticator sign-in required'; end if;
  delete from kora_private.recovery_codes where user_id=auth.uid();
  delete from kora_private.recovery_limits where user_id=auth.uid();
  for i in 1..8 loop
    code:=replace(gen_random_uuid()::text,'-','');
    insert into kora_private.recovery_codes values(auth.uid(),encode(sha256(convert_to(code,'UTF8')),'hex'));
    return next code;
  end loop;
end; $$;
-- Only the recovery Edge Function's server credential may call these functions.
create or replace function public.zoro_consume_recovery_code(actor uuid, recovery_code text) returns boolean
language plpgsql security definer set search_path='' as $$
declare limiter kora_private.recovery_limits;
begin
  if actor is null or not exists(select 1 from auth.users where id=actor) then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,10));
  insert into kora_private.recovery_limits(user_id)values(actor)on conflict do nothing;
  select * into limiter from kora_private.recovery_limits where user_id=actor for update;
  if limiter.blocked_until>now() then return false; end if;
  delete from kora_private.recovery_codes where user_id=actor and code_hash=encode(sha256(convert_to(lower(trim(recovery_code)),'UTF8')),'hex');
  if found then delete from kora_private.recovery_limits where user_id=actor; return true; end if;
  update kora_private.recovery_limits set failures=failures+1,blocked_until=case when (failures+1)%5=0 then now()+interval '1 hour' else null end where user_id=actor;
  return false;
end; $$;
create or replace function public.zoro_finish_account_recovery(actor uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  delete from public.zoro_device_preferences where user_id=actor;
  delete from public.zoro_devices where user_id=actor;
  delete from kora_private.recovery_codes where user_id=actor;
end; $$;
revoke all on function public.zoro_generate_recovery_codes(),public.zoro_consume_recovery_code(uuid,text),public.zoro_finish_account_recovery(uuid) from public,anon,authenticated;
grant execute on function public.zoro_generate_recovery_codes() to authenticated;
grant execute on function public.zoro_consume_recovery_code(uuid,text),public.zoro_finish_account_recovery(uuid) to service_role;
commit;
