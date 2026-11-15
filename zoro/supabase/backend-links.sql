-- Remembers a user-owned project's public connection settings with the Zoro ID.
create table if not exists public.zoro_backend_links (
  user_id uuid primary key references auth.users(id) on delete cascade,
  project_url text not null check (project_url ~ '^https://[a-z0-9]{10,40}\.supabase\.co$'),
  publishable_key text not null check (publishable_key ~ '^sb_publishable_[A-Za-z0-9_-]{10,180}$'),
  updated_at timestamptz not null default now()
);
alter table public.zoro_backend_links enable row level security;
revoke all on public.zoro_backend_links from anon, authenticated;
grant select on public.zoro_backend_links to authenticated;
create policy "Owner reads backend link" on public.zoro_backend_links
  for select to authenticated using (user_id = auth.uid() and public.kora_allowed());
create or replace function public.zoro_save_backend_link(project_url text, publishable_key text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.kora_allowed() then raise exception 'Verified sign-in required'; end if;
  insert into public.zoro_backend_links(user_id, project_url, publishable_key)
  values(auth.uid(), project_url, publishable_key)
  on conflict(user_id) do update set project_url=excluded.project_url,
    publishable_key=excluded.publishable_key, updated_at=now();
end; $$;
create or replace function public.zoro_clear_backend_link() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.kora_allowed() then raise exception 'Verified sign-in required'; end if;
  delete from public.zoro_backend_links where user_id = auth.uid();
end; $$;
revoke all on function public.zoro_save_backend_link(text,text), public.zoro_clear_backend_link() from public, anon;
grant execute on function public.zoro_save_backend_link(text,text), public.zoro_clear_backend_link() to authenticated;
