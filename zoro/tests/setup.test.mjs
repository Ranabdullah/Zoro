import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {setupSql} from "../scripts/setup.mjs";
test("the downloadable combined SQL installs the complete schema on an empty PostgreSQL fixture",async()=>{
  const db=new PGlite();
  try{
    await db.exec(`create role anon;create role authenticated;create role service_role;create role supabase_auth_admin;
      create schema auth;create schema storage;
      create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,phone text,phone_confirmed_at timestamptz);
      create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.jwt()returns jsonb language sql stable as $$select '{}'::jsonb$$;
      create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),refreshed_at timestamptz,user_agent text,not_after timestamptz,aal text);
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
      create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(name text)returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
      grant usage on schema public,auth,storage to anon,authenticated;`);
    const expected=await setupSql(),shipped=(await readFile(new URL("../supabase/setup.sql",import.meta.url),"utf8")).replace(/\r\n/g,"\n");
    assert.equal(shipped,expected);
    await db.exec(shipped);
    assert.equal((await db.query("select public from storage.buckets where id='kora-receipts'")).rows[0].public,false);
    for(const table of ['kora_vaults','zoro_backend_links','zoro_devices','zoro_device_preferences'])assert.equal((await db.query("select relrowsecurity from pg_class where oid=('public.'||$1)::regclass",[table])).rows[0].relrowsecurity,true);
    assert.equal((await db.query("select public.kora_allowed() as allowed")).rows[0].allowed,false);
  }finally{await db.close();}
});
