import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import test from "node:test";
import assert from "node:assert/strict";

// Executes the shipped SQL in local PostgreSQL. Auth identities and the storage
// service's base schema are fixtures; this is not a live Supabase integration test.
test("private vault and receipt policies enforce owner access and save revisions", async (t) => {
  const db = new PGlite();
  const alice = "11111111-1111-4111-8111-111111111111";
  const bob = "22222222-2222-4222-8222-222222222222";
  const outsider = "33333333-3333-4333-8333-333333333333";
  const unverified = "44444444-4444-4444-8444-444444444444";
  const vault = {
    accounts: [],
    entries: [],
    receipts: [],
    debts: [],
    name: "test",
  };
  await db.exec(`
    create role anon;create role authenticated;create role supabase_auth_admin;
    create schema auth;create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select jsonb_build_object('aal',current_setting('request.jwt.claim.aal',true),'session_id',current_setting('request.jwt.claim.session_id',true))$$;
    create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now(),refreshed_at timestamptz,user_agent text,not_after timestamptz,aal text default 'aal2');
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id bigint generated always as identity primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$select string_to_array(name,'/')$$;
    grant usage on schema public,auth,storage to anon,authenticated;
    grant select,insert,update,delete on storage.objects to anon,authenticated;
    grant usage on all sequences in schema storage to anon,authenticated;
  `);
  await db.exec(
    await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  );
  await db.exec(await readFile(new URL("../supabase/access-hardening.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../supabase/session-security.sql", import.meta.url), "utf8"));
  for (const [id, email, verified] of [
    [alice, "alice@example.invalid", true],
    [bob, "bob@example.invalid", true],
    [outsider, "outsider@example.invalid", true],
    [unverified, "unverified@example.invalid", false],
  ]) {
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      email,
      verified ? new Date().toISOString() : null,
    ]);
    if (id !== outsider)
      await db.query("insert into kora_private.allowed_emails values($1)", [
        email,
      ]);
    await db.query("insert into auth.sessions(id,user_id,user_agent) values($1,$1,$2)", [id, "Test browser"]);
  }
  const acting = async (role, id, fn, aal = "aal2") => {
    await db.exec("set role " + role);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      id || "",
    ]);
    await db.query("select set_config('request.jwt.claim.aal',$1,false)", [aal]);
    await db.query("select set_config('request.jwt.claim.session_id',$1,false)", [id || ""]);
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  };
  const save = (rev) =>
    db.query("select public.save_kora_vault($1,$2) as revision", [
      rev,
      JSON.stringify(vault),
    ]);
  try {
    await t.test("verified users only see their own sessions, and revoked sessions lose wallet access", async () => {
      const id = "55555555-5555-4555-8555-555555555555";
      await db.query("insert into auth.sessions(id,user_id,user_agent) values($1,$2,$3)", [id, alice, "Other browser"]);
      await acting("authenticated", alice, async () => {
        const { rows } = await db.query("select * from public.kora_sessions()");
        assert.equal(rows.length, 2);
        assert.equal(rows.filter(row => row.is_current).length, 1);
        await db.query("select set_config('request.jwt.claim.session_id',$1,false)", [bob]);
        await assert.rejects(() => save(0), /Access denied/);
        await db.query("select set_config('request.jwt.claim.session_id',$1,false)", [id]);
        assert.equal((await db.query("select public.kora_allowed() as allowed")).rows[0].allowed, true);
      });
      await db.query("delete from auth.sessions where id=$1", [id]);
      await acting("authenticated", alice, async () => {
        await db.query("select set_config('request.jwt.claim.session_id',$1,false)", [id]);
        await assert.rejects(() => save(0), /Access denied/);
      });
    });
    await t.test("signup hook rejects strangers and is callable only by Auth", async () => {
      const hook = email => db.query("select public.kora_before_signup($1) as result", [JSON.stringify({user:{email}})]);
      await acting("supabase_auth_admin", null, async () => {
        assert.deepEqual((await hook("ALICE@example.invalid")).rows[0].result, {});
        assert.equal((await hook("outsider@example.invalid")).rows[0].result.error.http_code, 403);
      });
      await acting("authenticated", alice, () => assert.rejects(() => hook("alice@example.invalid"), /permission denied/));
    });
    await t.test("a stolen password alone cannot read or write wallet data or receipts", () =>
      acting("authenticated", alice, async () => {
        assert.equal((await db.query("select public.kora_invited() as invited")).rows[0].invited, true);
        assert.equal((await db.query("select public.kora_allowed() as allowed")).rows[0].allowed, false);
        assert.equal((await db.query("select * from public.kora_vaults")).rows.length, 0);
        await assert.rejects(() => save(0), /Access denied/);
        await assert.rejects(() => db.query("insert into storage.objects(bucket_id,name) values('kora-receipts',$1)", [alice + "/photo.jpg"]), /row-level security/);
      }, "aal1"));
    await t.test("anonymous requests cannot read or save vaults", () =>
      acting("anon", null, async () => {
        await assert.rejects(
          () => db.query("select * from public.kora_vaults"),
          /permission denied/,
        );
        await assert.rejects(() => save(0), /permission denied/);
      }),
    );
    await t.test(
      "invited owner can save/read but cannot write tables directly",
      () =>
        acting("authenticated", alice, async () => {
          assert.equal((await save(0)).rows[0].revision, 1);
          assert.equal(
            (await db.query("select * from public.kora_vaults")).rows[0]
              .user_id,
            alice,
          );
          await assert.rejects(
            () => db.query("update public.kora_vaults set revision=99"),
            /permission denied/,
          );
        }),
    );
    await t.test("another invited user cannot read the first vault", () =>
      acting("authenticated", bob, async () => {
        assert.equal(
          (await db.query("select * from public.kora_vaults")).rows.length,
          0,
        );
        assert.equal((await save(0)).rows[0].revision, 1);
        const rows = (await db.query("select * from public.kora_vaults")).rows;
        assert.equal(rows.length, 1);
        assert.equal(rows[0].user_id, bob);
      }),
    );
    await t.test(
      "uninvited and unverified identities cannot save",
      async () => {
        for (const id of [outsider, unverified])
          await acting("authenticated", id, async () => {
            assert.equal(
              (await db.query("select * from public.kora_vaults")).rows.length,
              0,
            );
            await assert.rejects(() => save(0), /Access denied/);
          });
      },
    );
    await t.test("stale writes cannot replace a newer revision", () =>
      acting("authenticated", alice, async () => {
        assert.equal((await save(1)).rows[0].revision, 2);
        await assert.rejects(() => save(1), /Sync conflict/);
        await assert.rejects(() => save(0), /Sync conflict/);
        assert.equal(
          (await db.query("select revision from public.kora_vaults")).rows[0]
            .revision,
          2,
        );
      }),
    );
    await t.test(
      "receipt bucket is private and owners can upload their own path",
      async () => {
        assert.equal(
          (
            await db.query(
              "select public from storage.buckets where id='kora-receipts'",
            )
          ).rows[0].public,
          false,
        );
        await acting("authenticated", alice, () =>
          db.query(
            "insert into storage.objects(bucket_id,name)values('kora-receipts',$1)",
            [alice + "/photo.jpg"],
          ),
        );
      },
    );
    await t.test(
      "other users cannot read, delete or upload into an owner receipt folder",
      () =>
        acting("authenticated", bob, async () => {
          assert.equal(
            (await db.query("select * from storage.objects")).rows.length,
            0,
          );
          assert.equal(
            (await db.query("delete from storage.objects returning id")).rows
              .length,
            0,
          );
          await assert.rejects(
            () =>
              db.query(
                "insert into storage.objects(bucket_id,name)values('kora-receipts',$1)",
                [alice + "/forged.jpg"],
              ),
            /row-level security/,
          );
        }),
    );
    await t.test(
      "anonymous and uninvited users cannot access receipt photos",
      async () => {
        for (const [role, id] of [
          ["anon", null],
          ["authenticated", outsider],
        ])
          await acting(role, id, async () => {
            assert.equal(
              (await db.query("select * from storage.objects")).rows.length,
              0,
            );
            await assert.rejects(
              () =>
                db.query(
                  "insert into storage.objects(bucket_id,name)values('kora-receipts',$1)",
                  [(id || alice) + "/forged.jpg"],
                ),
              /row-level security/,
            );
          });
      },
    );
  } finally {
    await db.close();
  }
});
