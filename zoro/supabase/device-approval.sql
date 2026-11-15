-- Optional per-user new-browser approval. Run after session-security/public-registration.
begin;
create table if not exists public.zoro_device_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  approval_required boolean not null default false
);
create table if not exists public.zoro_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id text not null,
  token_hash text not null,
  label text not null,
  reported_location text not null default 'Unavailable',
  status text not null check(status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique(user_id,session_id)
);
alter table public.zoro_device_preferences enable row level security;
alter table public.zoro_devices enable row level security;
revoke all on public.zoro_device_preferences, public.zoro_devices from public,anon,authenticated;
create or replace function public.zoro_base_allowed() returns boolean
language sql stable security definer set search_path='' as $$
  select coalesce((select auth.jwt()->>'aal')='aal2',false) and public.kora_invited()
    and exists(select 1 from auth.sessions s where s.user_id=(select auth.uid())
      and s.id::text=(select auth.jwt()->>'session_id') and (s.not_after is null or s.not_after>now()));
$$;
create or replace function public.kora_allowed() returns boolean
language sql stable security definer set search_path='' as $$
  select public.zoro_base_allowed() and (
    not exists(select 1 from public.zoro_device_preferences p where p.user_id=(select auth.uid()) and p.approval_required)
    or exists(select 1 from public.zoro_devices d where d.user_id=(select auth.uid())
      and d.session_id=(select auth.jwt()->>'session_id') and d.status='approved')
  );
$$;
create or replace function public.zoro_device_gate(device_token text, device_label text, location_label text default 'Unavailable') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); sid text:=auth.jwt()->>'session_id'; hashed text; required boolean; device public.zoro_devices;
begin
  if not public.zoro_base_allowed() then raise exception 'Verified authenticator sign-in required'; end if;
  if device_token !~ '^[a-f0-9]{64}$' or device_token is null then raise exception 'Invalid device token'; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text,0));
  hashed:=encode(sha256(convert_to(device_token,'UTF8')),'hex');
  select coalesce((select p.approval_required from public.zoro_device_preferences p where p.user_id=actor),false) into required;
  select * into device from public.zoro_devices where user_id=actor and session_id=sid;
  if device.id is null then
    insert into public.zoro_devices(user_id,session_id,token_hash,label,reported_location,status)
    values(actor,sid,hashed,left(coalesce(device_label,'Browser'),120),left(coalesce(location_label,'Unavailable'),160),
      case when not required or exists(select 1 from public.zoro_devices where user_id=actor and token_hash=hashed and status='approved') then 'approved' else 'pending' end)
    returning * into device;
  elsif device.token_hash<>hashed then
    raise exception 'Browser token changed. Sign out and sign in again';
  else
    update public.zoro_devices set last_seen=now() where id=device.id;
  end if;
  return jsonb_build_object('available',true,'enabled',required,'approved',device.status='approved','status',device.status,'id',device.id);
end; $$;
create or replace function public.zoro_list_devices() returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not public.kora_allowed() then raise exception 'Approved sign-in required'; end if;
  select jsonb_build_object('enabled',coalesce((select approval_required from public.zoro_device_preferences where user_id=auth.uid()),false),
    'devices',coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'location',reported_location,'status',status,'requested_at',requested_at,'last_seen',last_seen,'is_current',session_id=auth.jwt()->>'session_id') order by requested_at desc),'[]'::jsonb)) into result
  from public.zoro_devices where user_id=auth.uid() and requested_at>now()-interval '30 days';
  return result;
end; $$;
create or replace function public.zoro_set_device_approval(required boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.kora_allowed() or not exists(select 1 from public.zoro_devices where user_id=auth.uid() and session_id=auth.jwt()->>'session_id' and status='approved') then raise exception 'Approved sign-in required'; end if;
  insert into public.zoro_device_preferences values(auth.uid(),required)
  on conflict(user_id) do update set approval_required=excluded.approval_required;
end; $$;
create or replace function public.zoro_review_device(request_id uuid, approve boolean) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.kora_allowed() then raise exception 'Approved sign-in required'; end if;
  update public.zoro_devices set status=case when approve then 'approved' else 'rejected' end
    where id=request_id and user_id=auth.uid() and status='pending' and requested_at>now()-interval '15 minutes';
  if not found then raise exception 'Request expired or unavailable'; end if;
end; $$;
create or replace function public.zoro_revoke_device(request_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare token text;
begin
  if not public.kora_allowed() then raise exception 'Approved sign-in required'; end if;
  select token_hash into token from public.zoro_devices where id=request_id and user_id=auth.uid() and session_id<>auth.jwt()->>'session_id';
  if token is null then raise exception 'Cannot revoke this browser here'; end if;
  if exists(select 1 from public.zoro_devices where user_id=auth.uid() and token_hash=token and session_id=auth.jwt()->>'session_id') then raise exception 'Use sign out to revoke this browser'; end if;
  update public.zoro_devices set status='rejected' where user_id=auth.uid() and token_hash=token;
end; $$;
revoke all on function public.zoro_base_allowed(),public.zoro_device_gate(text,text,text),public.zoro_list_devices(),public.zoro_set_device_approval(boolean),public.zoro_review_device(uuid,boolean),public.zoro_revoke_device(uuid) from public,anon;
grant execute on function public.zoro_base_allowed(),public.zoro_device_gate(text,text,text),public.zoro_list_devices(),public.zoro_set_device_approval(boolean),public.zoro_review_device(uuid,boolean),public.zoro_revoke_device(uuid) to authenticated;
commit;
