import { createClient } from "@supabase/supabase-js";
import { backendConfig } from "../dist/backend-config.js";
const cfg = window.ZORO_CONFIG || window.KORA_CONFIG || {};
const recoveryParams = new URL(location.href).searchParams;
const recoveryCfg =
  recoveryParams.get("reset") === "password" && recoveryParams.has("backend")
    ? backendConfig(
        recoveryParams.get("backend"),
        recoveryParams.get("public_key"),
      )
    : null;
export const configured = Boolean(cfg.url && cfg.key);
export const signInOptions = {
  google: cfg.google === true,
  phone: cfg.phone === true,
};
let passwordRecovery = false;
export const isPasswordRecovery = () =>
  passwordRecovery && recoveryParams.get("reset") === "password";
export async function requestPasswordReset(email) {
  const callback = new URL(location.origin + "/");
  callback.searchParams.set("reset", "password");
  if (usingOwnBackend()) {
    callback.searchParams.set("backend", client.supabaseUrl);
    callback.searchParams.set("public_key", client.supabaseKey);
  }
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: callback.href,
  });
  if (error)
    throw Error(
      "Could not send recovery email. Try later or contact the app owner.",
    );
}
export async function resetPassword(password) {
  if (!isPasswordRecovery())
    throw Error("Open a fresh recovery link in the browser that requested it.");
  const { error } = await client.auth.updateUser({ password });
  if (error)
    throw Error(
      "Could not reset the password. Complete your authenticator check and use a fresh recovery link.",
    );
}
export async function googleLogin() {
  if (usingOwnBackend())
    throw Error(
      "Sign into your own project with its email login. Google login is configured for the main project only.",
    );
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + "/" },
  });
  if (error)
    throw Error("Google sign-in is unavailable. Contact the app owner.");
}
export async function phoneCode(phone) {
  const { error } = await client.auth.signInWithOtp({ phone });
  if (error)
    throw Error(
      "Could not send an SMS code. Check the international number and try later.",
    );
}
export async function verifyPhone(phone, token) {
  const { data, error } = await client.auth.verifyOtp({
    phone,
    token,
    type: "sms",
  });
  if (error)
    throw Error("The SMS code was not accepted. Request a fresh code.");
  user = data.user;
  if (!usingOwnBackend()) rootUser = user;
  return user;
}
const rootClient = configured
  ? createClient(cfg.url, cfg.key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: !recoveryCfg,
        persistSession: true,
        storage: sessionStorage,
      },
    })
  : null;
let client = recoveryCfg
    ? createClient(recoveryCfg.url, recoveryCfg.key, {
        auth: {
          flowType: "pkce",
          detectSessionInUrl: true,
          persistSession: true,
          storage: sessionStorage,
        },
      })
    : rootClient,
  user = null,
  rootUser = null,
  pendingBackend = null;
function watchRecovery(target) {
  target?.auth.onAuthStateChange?.((event) => {
    if (event === "PASSWORD_RECOVERY" && target === client)
      passwordRecovery = true;
  });
}
watchRecovery(client);
export const usingOwnBackend = () => client !== rootClient;
export const backendHost = () =>
  pendingBackend?.url || client?.supabaseUrl || cfg.url;
export async function savedBackend() {
  const { data, error } = await rootClient
    .from("zoro_backend_links")
    .select("project_url,publishable_key")
    .eq("user_id", rootUser.id)
    .maybeSingle();
  if (error)
    throw Error(
      "Could not load your backend choice. Check the connection and backend-links migration.",
    );
  return data ? backendConfig(data.project_url, data.publishable_key) : null;
}
export async function activateBackend(config, remember = false) {
  const checked = backendConfig(config.url, config.key);
  if (checked.url === cfg.url)
    throw Error("This is already the default Zoro project.");
  client = createClient(checked.url, checked.key, {
    auth: {
      flowType: "pkce",
      detectSessionInUrl: false,
      persistSession: true,
      storage: sessionStorage,
    },
  });
  watchRecovery(client);
  pendingBackend = remember ? checked : null;
  const { data, error } = await client.auth.getSession();
  if (error) throw Error("Could not open this project's sign-in session.");
  user = data.session?.user || null;
  return user;
}
export async function rememberBackend() {
  if (!pendingBackend) return;
  // Confirm schema and authenticated owner access before remembering this choice.
  const allowed = await client.rpc("kora_allowed");
  if (allowed.error || allowed.data !== true)
    throw Error(
      "Install the Zoro setup SQL and complete email verification and MFA in your own project first.",
    );
  const { error } = await rootClient.rpc("zoro_save_backend_link", {
    project_url: pendingBackend.url,
    publishable_key: pendingBackend.key,
  });
  if (error)
    throw Error(
      "Could not remember this backend. Sign back into Zoro and retry. No wallet data was moved.",
    );
  pendingBackend = null;
}
export async function useDefaultBackend() {
  const { error } = await rootClient.rpc("zoro_clear_backend_link");
  if (error)
    throw Error(
      "Could not change the backend choice. Sign into Zoro again and retry.",
    );
  if (usingOwnBackend()) await client.auth.signOut({ scope: "local" });
  client = rootClient;
  user = rootUser;
  pendingBackend = null;
  return user;
}
export async function session() {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  user = data.session?.user || null;
  if (!usingOwnBackend()) rootUser = user;
  return user;
}
export async function register(email, password) {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin + "/" },
  });
  if (error) {
    if (error.code === "weak_password")
      throw Error("Choose a stronger password and try again.");
    if (error.status === 429)
      throw Error("Too many attempts. Please wait before trying again.");
    throw Error(
      "Registration could not be completed. Check the email address or contact Zoro support if the confirmation email cannot be sent.",
    );
  }
  if (data.session) {
    await logout();
    throw Error("Email verification must be enabled by the app owner.");
  }
}
export async function login(email, password) {
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (error)
    throw Error("Unable to sign in. Check your details and try again.");
  user = data.user;
  if (!usingOwnBackend()) rootUser = user;
  return user;
}
export async function logout() {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
  if (usingOwnBackend()) await rootClient.auth.signOut({ scope: "local" });
  client = rootClient;
  rootUser = null;
  pendingBackend = null;
  user = null;
  passwordRecovery = false;
}
export async function signedInSessions() {
  const { data, error } = await client.rpc("kora_sessions");
  if (error) throw Error("Could not load your signed-in sessions.");
  return data;
}
function browserToken() {
  const key = "zoro-browser-token:" + backendHost() + ":" + user.id;
  let value = localStorage.getItem(key);
  if (!/^[a-f0-9]{64}$/.test(value || "")) {
    value = [...crypto.getRandomValues(new Uint8Array(32))]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(key, value);
  }
  return value;
}
export async function deviceGate() {
  let place = "Unavailable";
  try {
    const response = await fetch("/api/location", { cache: "no-store" });
    if (response.ok) {
      const result = await response.json();
      if (typeof result.location === "string") place = result.location;
    }
  } catch {}
  const { data, error } = await client.rpc("zoro_device_gate", {
    device_token: browserToken(),
    device_label: navigator.userAgent.slice(0, 120),
    location_label: place,
  });
  if (error?.code === "PGRST202") return { available: false, approved: true };
  if (error)
    throw Error(
      "Could not verify this browser's approval. Sign in again or contact the owner.",
    );
  return data;
}
export async function devices() {
  const { data, error } = await client.rpc("zoro_list_devices");
  if (error)
    throw Error(
      "Device approvals need device-approval.sql installed in this backend.",
    );
  return data;
}
export async function setDeviceApproval(required) {
  const { error } = await client.rpc("zoro_set_device_approval", { required });
  if (error)
    throw Error("Could not change approval settings. Use an approved browser.");
}
export async function reviewDevice(id, approve) {
  const { error } = await client.rpc("zoro_review_device", {
    request_id: id,
    approve,
  });
  if (error)
    throw Error(
      "The request expired or could not be reviewed. Refresh the list.",
    );
}
export async function revokeDevice(id) {
  const { error } = await client.rpc("zoro_revoke_device", { request_id: id });
  if (error)
    throw Error(
      "Could not revoke this browser. Use Sign out for the current browser.",
    );
}
export async function signOutOthers() {
  const { error } = await client.auth.signOut({ scope: "others" });
  if (error) throw Error("Could not sign out the other sessions.");
}
export async function changePassword(currentPassword, password) {
  const { error } = await client.auth.updateUser({
    current_password: currentPassword,
    password,
  });
  if (error) {
    if (error.code === "reauthentication_needed")
      throw Error("Sign out and sign in again before changing your password.");
    throw Error(
      "Could not change the password. Check your current password and choose a different, strong password.",
    );
  }
}
export async function secondFactor() {
  const invited = await client.rpc("kora_invited");
  if (invited.error || invited.data !== true)
    throw Error("Confirm your email or phone before opening your Zoro wallet.");
  const { data: level, error } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw Error("Could not check your sign-in security.");
  if (level.currentLevel === "aal2" && level.nextLevel === "aal2") return null;
  const { data: factors, error: factorError } =
    await client.auth.mfa.listFactors();
  if (factorError) throw Error("Could not load your authenticator.");
  if (factors.totp.length) return { id: factors.totp[0].id };
  if (level.nextLevel === "aal2")
    throw Error("Contact the app owner to restore authenticator access.");
  for (const factor of factors.all.filter(
    (item) => item.factor_type === "totp" && item.status === "unverified",
  )) {
    const { error: cleanupError } = await client.auth.mfa.unenroll({
      factorId: factor.id,
    });
    if (cleanupError) throw Error("Could not restart authenticator setup.");
  }
  const { data, error: enrollError } = await client.auth.mfa.enroll({
    factorType: "totp",
    issuer: "Zoro",
    friendlyName: "Zoro authenticator",
  });
  if (enrollError)
    throw Error("Could not set up an authenticator. Try signing in again.");
  return { id: data.id, secret: data.totp.secret };
}
export async function verifyFactor(id, code) {
  const { error } = await client.auth.mfa.challengeAndVerify({
    factorId: id,
    code,
  });
  if (error)
    throw Error(
      "Could not verify the code. Try a fresh code from your authenticator.",
    );
}
export async function recoveryCodes() {
  const { data, error } = await client.rpc("zoro_generate_recovery_codes");
  if (error)
    throw Error(
      "Recovery codes require recovery-codes.sql and an approved authenticator session.",
    );
  return data;
}
export async function recoverAccount(code) {
  const { data, error } = await client.functions.invoke("recover-account", {
    body: { code },
  });
  if (error || !data?.ok)
    throw Error(
      data?.error ||
        "Account recovery is unavailable or the code was not accepted. Check the recovery service setup.",
    );
  await logout();
}
export async function load() {
  const actor = user?.id;
  if (!actor) throw Error("Please sign in again.");
  const allowed = await client.rpc("kora_allowed");
  if (allowed.error || !allowed.data)
    throw Error("Wallet access requires a verified email and authenticator.");
  const { data, error } = await client
    .from("kora_vaults")
    .select("payload,revision")
    .eq("user_id", actor)
    .maybeSingle();
  if (error)
    throw Error(
      "Cannot load your records. Check your connection and account access.",
    );
  return data ? { ...data.payload, __revision: data.revision } : null;
}
export async function save(payload) {
  const { __revision = 0, ...records } = payload;
  const { data, error } = await client.rpc("save_kora_vault", {
    expected_revision: __revision,
    new_payload: records,
  });
  if (error) {
    if (error.message.includes("conflict"))
      throw Error(
        "Another device saved changes. Refresh your records, then try again. Your entry has not been saved.",
      );
    throw Error(
      "Could not save online. Your entry has not been saved. Check your connection or account access.",
    );
  }
  return data;
}
export async function upload(blob) {
  const name = `${user.id}/${crypto.randomUUID()}.jpg`;
  const { error } = await client.storage
    .from("kora-receipts")
    .upload(name, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw Error("Receipt upload failed. Please try again.");
  return name;
}
export async function removeFile(name) {
  const { error } = await client.storage.from("kora-receipts").remove([name]);
  if (error)
    throw Error(
      "Some stored receipt images could not be removed. Contact support before treating the deletion as complete.",
    );
}
export async function receiptBlob(name) {
  const { data, error } = await client.storage
    .from("kora-receipts")
    .download(name);
  if (error)
    throw Error("Could not back up a receipt. Deletion has not started.");
  return data;
}
export async function deleteOwnAccount() {
  if (!user) throw Error("Sign in again before deleting your account.");
  while (true) {
    const { data, error } = await client.storage
      .from("kora-receipts")
      .list(user.id, { limit: 100 });
    if (error)
      throw Error("Could not list receipt files. Account deletion stopped.");
    if (!data.length) break;
    const files = data
      .filter((file) => file.id)
      .map((file) => user.id + "/" + file.name);
    if (!files.length)
      throw Error(
        "Unexpected receipt folder. Contact support before deleting this account.",
      );
    const removed = await client.storage.from("kora-receipts").remove(files);
    if (removed.error)
      throw Error("Could not remove receipt files. Account deletion stopped.");
  }
  const { error } = await client.rpc("zoro_delete_own_account");
  if (error)
    throw Error(
      "Could not delete this account. Contact support. Some receipt files may already have been removed.",
    );
  await client.auth.signOut({ scope: "local" });
  if (usingOwnBackend()) {
    const cleared = await rootClient.rpc("zoro_clear_backend_link");
    if (cleared.error)
      throw Error(
        "Your project wallet account was deleted, but its Zoro link could not be cleared. Sign into Zoro and use Return to Zoro cloud.",
      );
    await rootClient.auth.signOut({ scope: "local" });
  }
  client = rootClient;
  rootUser = null;
  pendingBackend = null;
  user = null;
}
export async function receiptUrl(name) {
  const { data, error } = await client.storage
    .from("kora-receipts")
    .download(name);
  if (error) throw Error("Receipt unavailable. Please refresh and try again.");
  return URL.createObjectURL(data);
}
