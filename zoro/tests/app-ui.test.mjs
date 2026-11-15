import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { Window } from "happy-dom";

test("public signup, recovery and empty-wallet onboarding render without copying sample records", async () => {
  const win = new Window({
    url: "https://app.example/",
    settings: {
      disableJavaScriptFileLoading: true,
      disableJavaScriptEvaluation: true,
    },
  });
  const old = new Map();
  const names = [
    "window",
    "document",
    "navigator",
    "location",
    "history",
    "localStorage",
    "sessionStorage",
    "FormData",
    "FileReader",
    "CSS",
    "HTMLElement",
    "Event",
  ];
  for (const name of names) {
    old.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value: win[name],
    });
  }
  const oldFetch = globalThis.fetch,
    oldInterval = globalThis.setInterval,
    oldTimeout = globalThis.setTimeout;
  globalThis.fetch = async () => ({ ok: false });
  globalThis.setInterval = () => 0;
  globalThis.setTimeout = (fn) => {
    return oldTimeout(fn, 0);
  };
  const errors = [];
  win.addEventListener("error", (e) => errors.push(e.error));
  win.document.write(
    (
      await readFile(new URL("../dist/index.html", import.meta.url), "utf8")
    ).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ""),
  );
  for (const dialog of win.document.querySelectorAll("dialog")) {
    dialog.showModal = () => {
      dialog.open = true;
    };
    dialog.close = () => {
      dialog.open = false;
      dialog.dispatchEvent(new win.Event("close"));
    };
  }
  const fake = `export const configured=true,signInOptions={google:false,phone:false};
    export async function session(){return null} export async function login(){return {id:'test-user',email:'test@example.invalid'}}
    export async function secondFactor(){return null} export async function deviceGate(){return {available:false,approved:true}}
    export async function savedBackend(){return null} export async function load(){return null}
    export async function signedInSessions(){return []} export async function devices(){throw Error('Migration unavailable')}
    export const usingOwnBackend=()=>false,backendHost=()=> 'https://sampleproject.supabase.co',isPasswordRecovery=()=>false;
    export async function requestPasswordReset(){return} export async function logout(){return}
  `;
  try {
    const built = await build({
      entryPoints: [fileURLToPath(new URL("../dist/app.js", import.meta.url))],
      bundle: true,
      format: "esm",
      write: false,
      logLevel: "silent",
      external: ["./reports.js", "./excel-sync.js"],
      plugins: [
        {
          name: "fake-cloud",
          setup(b) {
            b.onResolve({ filter: /^\.\/cloud\.js$/ }, () => ({
              path: "cloud",
              namespace: "fake",
            }));
            b.onLoad({ filter: /.*/, namespace: "fake" }, () => ({
              contents: fake,
              loader: "js",
            }));
          },
        },
      ],
    });
    await import(
      "data:text/javascript;base64," +
        Buffer.from(built.outputFiles[0].text).toString("base64")
    );
    const tick = () => new Promise((resolve) => oldTimeout(resolve, 15));
    await tick();
    const $ = (s) => win.document.querySelector(s);
    assert.equal($("#wallet-tour").open, true);
    $('[data-action="skip-tour"]').click();
    await tick();
    $('[data-action="register"]').click();
    await tick();
    assert.ok($("#login-form"));
    assert.ok($("#content").textContent.includes("Create your Zoro account"));
    $('[data-action="forgot-password"]').click();
    await tick();
    assert.ok($("#recovery-form"));
    $("#settings-dialog").close();
    $("#auth-mode").click();
    await tick();
    $("#f-email").value = "test@example.invalid";
    $("#f-password").value = "test-password-only";
    $("#login-form").dispatchEvent(
      new win.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
    assert.ok($("#content").textContent.includes("Your wallet starts here."));
    assert.equal(
      win.document.querySelectorAll(".wallet-stack .wallet-card").length,
      0,
    );
    assert.equal($("#wallet-tour").open, false);
    assert.ok($("#content").textContent.includes("Show me the tutorial"));
    $('[data-page="Settings"]').click();
    await tick();
    $('[data-action="local-security"]').click();
    await tick();
    $("#local-pin").value = "654321";
    $("#local-pin-confirm").value = "654321";
    $("#local-pin-form").dispatchEvent(
      new win.Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => oldTimeout(resolve, 250));
    assert.equal($("#local-security-error").textContent, "");
    assert.ok(
      [...Array(win.localStorage.length).keys()]
        .map((i) => win.localStorage.key(i))
        .some((k) => k.startsWith("zoro-local-lock:")),
    );
    $("#settings-dialog").close();
    $('[data-action="local-security"]').click();
    await tick();
    $("#local-lock-now").click();
    await tick();
    assert.equal(win.document.body.classList.contains("screen-locked"), true);
    $("#unlock-pin").value = "654321";
    $("#unlock-pin-form").dispatchEvent(
      new win.Event("submit", { bubbles: true, cancelable: true }),
    );
    await new Promise((resolve) => oldTimeout(resolve, 250));
    assert.equal(win.document.body.classList.contains("screen-locked"), false);
    assert.equal(errors.length, 0);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.setInterval = oldInterval;
    globalThis.setTimeout = oldTimeout;
    await win.happyDOM.abort();
    for (const [name, descriptor] of old) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else delete globalThis[name];
    }
  }
});
