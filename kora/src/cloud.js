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
    throw Error("Could not send a confirmation email. Check the address or contact the app owner.");
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
export async function secondFactor() {
  const invited = await client.rpc("kora_invited");
  if (invited.error || invited.data !== true)
    throw Error("This email must be verified and invited before it can open Kora.");
  const { data: level, error } = await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) throw Error("Could not check your sign-in security.");
  if (level.currentLevel === "aal2" && level.nextLevel === "aal2") return null;
  const { data: factors, error: factorError } = await client.auth.mfa.listFactors();
  if (factorError) throw Error("Could not load your authenticator.");
  if (factors.totp.length) return { id: factors.totp[0].id };
  if (level.nextLevel === "aal2")
    throw Error("Contact the app owner to restore authenticator access.");
  for (const factor of factors.all.filter((item) => item.factor_type === "totp" && item.status === "unverified")) {
    const { error: cleanupError } = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (cleanupError) throw Error("Could not restart authenticator setup.");
  }
  const { data, error: enrollError } = await client.auth.mfa.enroll({
    factorType: "totp", issuer: "Kora", friendlyName: "Kora authenticator",
  });
  if (enrollError) throw Error("Could not set up an authenticator. Try signing in again.");
  return { id: data.id, secret: data.totp.secret };
}
export async function verifyFactor(id, code) {
  const { error } = await client.auth.mfa.challengeAndVerify({ factorId: id, code });
  if (error) throw Error("Could not verify the code. Try a fresh code from your authenticator.");
}
export async function load() {
  const actor = user?.id;
  if (!actor) throw Error("Please sign in again.");
  const allowed = await client.rpc("kora_allowed");
  if (allowed.error || !allowed.data)
    throw Error(
      "Wallet access requires an invitation and a verified authenticator.",
    );
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
  await client.storage.from("kora-receipts").remove([name]);
}
export async function receiptUrl(name) {
  const { data, error } = await client.storage
    .from("kora-receipts")
    .download(name);
  if (error) throw Error("Receipt unavailable. Please refresh and try again.");
  return URL.createObjectURL(data);
}
