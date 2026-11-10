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
export async function google() {
  const { error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: location.origin + "/" },
  });
  if (error) throw error;
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
export async function load() {
  const actor = user?.id;
  if (!actor) throw Error("Please sign in again.");
  const allowed = await client.rpc("kora_allowed");
  if (allowed.error || !allowed.data)
    throw Error(
      "This email has not been invited. Ask the app owner to enable it.",
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
