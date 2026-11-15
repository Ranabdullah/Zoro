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
  globalThis.location = {
    href: "https://app.example/?reset=password",
    origin: "https://app.example",
  };
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
      resetPasswordForEmail: async (email, options) => {
        calls.push([url, "recovery-email", { email, ...options }]);
        return {};
      },
      updateUser: async (changes) => {
        calls.push([url, "update-user", changes]);
        return {};
      },
      onAuthStateChange: (callback) => {
        auth.listener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
    };
    const client = {
      supabaseUrl: url,
      supabaseKey: key,
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
    assert.equal(cloud.isPasswordRecovery(), false);
    await assert.rejects(
      () => cloud.resetPassword("not-authorized"),
      /fresh recovery link/,
    );
    clients.get(root).auth.listener("PASSWORD_RECOVERY");
    assert.equal(cloud.isPasswordRecovery(), true);
    await cloud.resetPassword("new-test-password");
    await cloud.requestPasswordReset("root@example.invalid");
    assert.equal(
      calls.find((c) => c[1] === "recovery-email")[2].redirectTo,
      "https://app.example/?reset=password",
    );
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
    await cloud.requestPasswordReset("own@example.invalid");
    const customReset = new URL(
      calls.find((c) => c[0] === own && c[1] === "recovery-email")[2]
        .redirectTo,
    );
    assert.equal(customReset.searchParams.get("backend"), own);
    assert.equal(
      customReset.searchParams.get("public_key"),
      "sb_publishable_ownabcdefghijkl",
    );
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
    delete globalThis.location;
    delete globalThis.zoroTestFactory;
  }
});
