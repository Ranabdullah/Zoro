import {
  createPin,
  checkPin,
  enrollBiometric,
  verifyBiometric,
  biometricSupport,
} from "./local-security.js";
let ctx,
  unlocked = "",
  activeKey = "",
  lockDialog = null,
  lastActive = Date.now();
const $ = (s) => document.querySelector(s);
function key() {
  return ctx?.online()
    ? "zoro-local-lock:" + ctx.backend() + ":" + ctx.userId()
    : "";
}
function read() {
  try {
    return JSON.parse(localStorage.getItem(key()) || "null");
  } catch {
    return null;
  }
}
function message(text) {
  const el = $("#local-security-error");
  if (el) el.textContent = text;
}
export function initializeSecurityUI(context) {
  ctx = context;
  document.addEventListener("pointerdown", () => (lastActive = Date.now()), {
    passive: true,
  });
  document.addEventListener("keydown", () => (lastActive = Date.now()));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && ctx.online() && read()) lockScreen();
  });
  setInterval(() => {
    if (ctx.online() && read() && Date.now() - lastActive > 5 * 60 * 1000)
      lockScreen();
  }, 15000);
}
export function checkLocalLock() {
  const current = key();
  if (!current) return;
  if (activeKey !== current) {
    activeKey = current;
    unlocked = "";
  }
  if (read() && unlocked !== current) lockScreen();
}
export function showLocalSecurity() {
  if (!ctx.online())
    return ctx.toast("Sign into your own wallet before setting a device lock.");
  const record = read();
  ctx.dialog(
    "Device screen lock",
    `<p>This optional lock hides Zoro when this tab is backgrounded or idle for five minutes. Your password, authenticator and server-side account rules remain separate. Browser storage can be cleared; this is not physical-device account binding.</p><p>${record ? "A local lock is configured on this browser." : "No local lock is configured."}</p><form id="local-pin-form"><label for="local-pin">New PIN (6–12 digits)</label><input id="local-pin" name="pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,12}" required><label for="local-pin-confirm">Repeat PIN</label><input id="local-pin-confirm" name="confirm" type="password" inputmode="numeric" autocomplete="new-password" required><button class="primary submit">Set local PIN</button></form><p>For Touch ID, Face ID, Windows Hello or the device's authenticator, use the button below. The device chooses its available verification method; biometric data never goes to Zoro. A passkey may sync through your platform account.</p><button class="secondary" id="local-biometric" ${biometricSupport() ? "" : "disabled"}>Enable device authenticator</button>${record ? '<button class="secondary" id="local-lock-now">Lock now</button><button class="secondary" id="local-lock-remove">Remove local lock</button>' : ""}<p id="local-security-error" role="alert"></p>`,
  );
  $("#local-pin-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const button = form.querySelector("button");
    button.disabled = true;
    try {
      const v = new FormData(form);
      if (v.get("pin") !== v.get("confirm")) throw Error("PINs do not match.");
      const pin = await createPin(v.get("pin"));
      localStorage.setItem(key(), JSON.stringify({ ...read(), pin }));
      unlocked = key();
      form.reset();
      ctx.toast("Local PIN saved on this browser.");
    } catch (error) {
      message(error.message);
    } finally {
      button.disabled = false;
    }
  };
  $("#local-biometric").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const biometric = await enrollBiometric(ctx.userId());
      await verifyBiometric(biometric);
      localStorage.setItem(key(), JSON.stringify({ ...read(), biometric }));
      unlocked = key();
      ctx.toast("Device authenticator verified and enabled.");
    } catch (error) {
      message(
        error.name === "NotAllowedError"
          ? "Device authentication was cancelled or unavailable."
          : error.message,
      );
    } finally {
      if ($("#local-biometric")) $("#local-biometric").disabled = false;
    }
  };
  if (record) {
    $("#local-lock-now").onclick = () => {
      ctx.closeDialog();
      lockScreen();
    };
    $("#local-lock-remove").onclick = async () => {
      try {
        await prove(record);
        localStorage.removeItem(key());
        ctx.toast("Local lock removed.");
        showLocalSecurity();
      } catch (error) {
        message(error.message);
      }
    };
  }
}
async function prove(record, pin) {
  if (record.biometric) return verifyBiometric(record.biometric);
  if (pin && record.pin && (await checkPin(pin, record.pin))) return;
  const entered = prompt("Enter your current local PIN to remove this lock.");
  if (!entered || !(await checkPin(entered, record.pin)))
    throw Error("PIN not accepted.");
}
export function lockScreen() {
  const record = read();
  if (!ctx?.online() || !record || lockDialog?.open) return;
  unlocked = "";
  lockDialog = document.createElement("dialog");
  lockDialog.id = "zoro-screen-lock";
  lockDialog.setAttribute("aria-labelledby", "screen-lock-title");
  lockDialog.innerHTML = `<h2 id="screen-lock-title">Zoro is locked</h2><p>Unlock this screen to see your wallet.</p>${record.pin ? '<form id="unlock-pin-form"><label for="unlock-pin">Local PIN</label><input id="unlock-pin" type="password" inputmode="numeric" autocomplete="off" pattern="[0-9]{6,12}" required><button class="primary submit">Unlock</button></form>' : ""}${record.biometric ? '<button class="secondary" id="unlock-biometric">Use device authenticator</button>' : ""}<button class="secondary" id="unlock-signout">Sign out instead</button><p id="unlock-error" role="alert"></p>`;
  document.body.append(lockDialog);
  document.body.classList.add("screen-locked");
  for (const child of document.body.children)
    if (child !== lockDialog && child.tagName !== "SCRIPT") child.inert = true;
  lockDialog.addEventListener("cancel", (e) => e.preventDefault());
  lockDialog.showModal();
  const finish = () => {
    unlocked = key();
    lastActive = Date.now();
    document.body.classList.remove("screen-locked");
    for (const child of document.body.children) child.inert = false;
    lockDialog.close();
    lockDialog.remove();
    lockDialog = null;
  };
  let running = false;
  const attempt = async (action) => {
    if (running) return;
    running = true;
    try {
      const rateKey = key() + ":attempts",
        rate = JSON.parse(localStorage.getItem(rateKey) || "{}");
      if (rate.until > Date.now())
        throw Error("Too many attempts. Wait 30 seconds.");
      await action();
      localStorage.removeItem(rateKey);
      finish();
    } catch (error) {
      const rateKey = key() + ":attempts",
        rate = JSON.parse(localStorage.getItem(rateKey) || "{}");
      const count = (rate.count || 0) + 1;
      localStorage.setItem(
        rateKey,
        JSON.stringify({
          count,
          until: count % 5 === 0 ? Date.now() + 30000 : 0,
        }),
      );
      $("#unlock-error").textContent =
        error.name === "NotAllowedError"
          ? "Device authentication cancelled."
          : error.message;
    } finally {
      running = false;
    }
  };
  if (record.pin)
    $("#unlock-pin-form").onsubmit = (e) => {
      e.preventDefault();
      const pin = $("#unlock-pin").value;
      $("#unlock-pin").value = "";
      attempt(async () => {
        if (!(await checkPin(pin, record.pin)))
          throw Error("PIN not accepted.");
      });
    };
  if (record.biometric)
    $("#unlock-biometric").onclick = () =>
      attempt(() => verifyBiometric(record.biometric));
  $("#unlock-signout").onclick = async () => {
    if (running) return;
    running = true;
    try {
      await ctx.signout();
      finish();
      activeKey = "";
      unlocked = "";
    } catch (error) {
      $("#unlock-error").textContent = error.message;
    } finally {
      running = false;
    }
  };
}
