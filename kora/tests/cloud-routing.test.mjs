import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

test("custom backend uses separate credentials and remembers only public settings after verification", async () => {
  const root = "https://rootprojectabcdefgh.supabase.co",
    own = "https://ownprojectabcdefghi.supabase.co";
  const calls = [];
  const clients = new Map();
  globalThis.window = {
    ZORO_CONFIG: { url: root, key: "sb_publishable_rootabcdefghijkl" },
  };
  globalThis.sessionStorage = {};
  globalThis.zoroTestFactory = (url, key) => {
    const auth = {
      getSession: async () => ({
        data: { session: url === root ? { user: { id: "root-id" } } : null },
      }),
      signInWithPassword: async (credentials) => {
        calls.push([url, "login", credentials]);
        return { data: { user: { id: url === root ? "root-id" : "own-id" } } };
      },
      signOut: async () => {
        calls.push([url, "logout"]);
        return {};
      },
    };
    const client = {
      supabaseUrl: url,
      auth,
      rpc: async (name, args) => {
        calls.push([url, name, args]);
        return { data: name === "kora_allowed" ? true : null };
      },
    };
    clients.set(url, client);
    return client;
  };
  try {
    const result = await build({
      entryPoints: [fileURLToPath(new URL("../src/cloud.js", import.meta.url))],
      bundle: true,
      format: "esm",
      write: false,
      plugins: [
        {
          name: "fake-sdk",
          setup(b) {
            b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
              path: "sdk",
              namespace: "fake",
            }));
            b.onLoad({ filter: /.*/, namespace: "fake" }, () => ({
              contents:
                "export const createClient = (...args) => globalThis.zoroTestFactory(...args);",
              loader: "js",
            }));
          },
        },
      ],
    });
    const cloud = await import(
      "data:text/javascript;base64," +
        Buffer.from(result.outputFiles[0].text).toString("base64")
    );
    await cloud.session();
    await cloud.login("root@example.invalid", "root-secret");
    await cloud.activateBackend(
      { url: own, key: "sb_publishable_ownabcdefghijkl" },
      true,
    );
    assert.equal(
      calls.filter((c) => c[0] === own && c[1] === "login").length,
      0,
    );
    await cloud.login("own@example.invalid", "own-secret");
    await cloud.rememberBackend();
    const choice = calls.find((c) => c[1] === "zoro_save_backend_link");
    assert.equal(choice[0], root);
    assert.deepEqual(choice[2], {
      project_url: own,
      publishable_key: "sb_publishable_ownabcdefghijkl",
    });
    assert.equal(
      calls.find((c) => c[0] === own && c[1] === "login")[2].password,
      "own-secret",
    );
    assert.equal((await cloud.useDefaultBackend()).id, "root-id");
    assert.equal(cloud.usingOwnBackend(), false);
  } finally {
    delete globalThis.window;
    delete globalThis.sessionStorage;
    delete globalThis.zoroTestFactory;
  }
});
