import { createClient } from "@supabase/supabase-js";
const cfg = window.KORA_CONFIG || {};
export const configured = Boolean(cfg.url && cfg.key);
const client = configured
  ? createClient(cfg.url, cfg.key, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        storage: sessionStorage,
      },
    })
  : null;
let user = null;
export async function session() {
  if (!client) return null;
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  user = data.session?.user || null;
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
  return user;
}
export async function logout() {
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw error;
  user = null;
}
export async function signedInSessions() {
  const { data, error } = await client.rpc("kora_sessions");
  if (error) throw Error("Could not load your signed-in sessions.");
  return data;
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
    throw Error("Confirm your email before opening your Zoro wallet.");
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
  user = null;
}
export async function receiptUrl(name) {
  const { data, error } = await client.storage
    .from("kora-receipts")
    .download(name);
  if (error) throw Error("Receipt unavailable. Please refresh and try again.");
  return URL.createObjectURL(data);
}
