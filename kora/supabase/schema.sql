-- Run once in a NEW Supabase project's SQL editor. No secrets belong here.
begin;
create schema if not exists kora_private;
revoke all on schema kora_private from public, anon, authenticated;
create table kora_private.allowed_emails(email text primary key check(email=lower(email)));
alter table kora_private.allowed_emails enable row level security;
-- Add approved emails with the separate invite.sql example.

create function public.kora_allowed() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists(select 1 from auth.users u join kora_private.allowed_emails a
    on a.email=lower(u.email) where u.id=(select auth.uid()) and u.email_confirmed_at is not null);
$$;
revoke all on function public.kora_allowed() from public, anon;
grant execute on function public.kora_allowed() to authenticated;

create table public.kora_vaults (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now()
);
alter table public.kora_vaults enable row level security;
revoke all on public.kora_vaults from public, anon, authenticated;
grant select on public.kora_vaults to authenticated;
create policy "Owner reads approved private vault" on public.kora_vaults for select to authenticated
using(user_id=(select auth.uid()) and (select public.kora_allowed()));

-- A compare-and-swap write prevents lost updates across PC and phone.
-- No client-selected user ID, no anonymous access, no direct writes.
create function public.save_kora_vault(expected_revision bigint,new_payload jsonb)
returns bigint language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); next_revision bigint;
begin
  if actor is null or not public.kora_allowed() then raise exception 'Access denied'; end if;
  if expected_revision < 0 or expected_revision is null then raise exception 'Invalid revision'; end if;
  if new_payload is null or jsonb_typeof(new_payload) <> 'object'
     or octet_length(new_payload::text)>2097152
     or jsonb_typeof(new_payload->'accounts') is distinct from 'array'
     or jsonb_typeof(new_payload->'entries') is distinct from 'array'
     or jsonb_typeof(new_payload->'receipts') is distinct from 'array'
     or jsonb_typeof(new_payload->'debts') is distinct from 'array'
  then raise exception 'Invalid record format'; end if;
  if expected_revision=0 then
    insert into public.kora_vaults(user_id,payload,revision) values(actor,new_payload,1)
    on conflict do nothing returning revision into next_revision;
  else
    update public.kora_vaults set payload=new_payload,revision=revision+1,updated_at=now()
    where user_id=actor and revision=expected_revision returning revision into next_revision;
  end if;
  if next_revision is null then raise exception 'Sync conflict'; end if;
  return next_revision;
end;
$$;
revoke all on function public.save_kora_vault(bigint,jsonb) from public, anon;
grant execute on function public.save_kora_vault(bigint,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('kora-receipts','kora-receipts',false,2097152,array['image/jpeg']);
create policy "Owner reads receipt" on storage.objects for select to authenticated
using(bucket_id='kora-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.kora_allowed()));
create policy "Owner uploads receipt" on storage.objects for insert to authenticated
with check(bucket_id='kora-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.kora_allowed()));
create policy "Owner removes receipt" on storage.objects for delete to authenticated
using(bucket_id='kora-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.kora_allowed()));
commit;
