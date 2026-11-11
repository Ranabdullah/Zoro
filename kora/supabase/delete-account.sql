-- Self-service account removal. Receipt objects must be removed through
-- Storage's API before deleting the Auth identity.
create or replace function public.zoro_delete_own_account() returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.kora_allowed() then
    raise exception 'Verified sign-in required';
  end if;
  if exists (
    select 1 from storage.objects
    where bucket_id = 'kora-receipts'
      and (storage.foldername(name))[1] = actor::text
  ) then
    raise exception 'Remove receipt objects before deleting this account';
  end if;
  delete from auth.users where id = actor;
end;
$$;
revoke all on function public.zoro_delete_own_account() from public, anon;
grant execute on function public.zoro_delete_own_account() to authenticated;
